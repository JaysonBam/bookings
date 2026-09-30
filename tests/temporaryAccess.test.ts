import assert from 'node:assert/strict'
import test from 'node:test'
import {
  codePassword, createTemporaryAccessHandler, formatCode, generateCode, INVALID_CODE_MESSAGE,
  normalizeCode, sha256, type AccessBackend,
} from '../supabase/functions/temporary-access/core.ts'
import { createAccessBackend } from '../supabase/functions/temporary-access/backend.ts'
import { canUseCollections, hasAppAccess } from '../src/lib/accountAccess.ts'
import type { ProfileRow } from '../src/api/supabase/types.ts'

const CODE = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'.slice(0, 26)
const request = (body: unknown, token?: string) => new Request('https://example.test/access', {
  method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
})
function mock(overrides: Partial<AccessBackend> = {}) {
  const calls: string[] = []
  const backend: AccessBackend = {
    getStaffUser: async (token) => token === 'admin' ? { id: 'admin-id' } : null,
    createUser: async () => { calls.push('create'); return 'guest-id' },
    deleteUser: async () => { calls.push('delete') },
    registerCode: async () => { calls.push('register'); return 'code-id' },
    consumeAttempt: async () => { calls.push('limit'); return true },
    findCode: async () => ({ user_id: 'guest-id', auth_email: 'guest@temporary.invalid' }),
    signIn: async () => ({ access_token: 'access', refresh_token: 'refresh', user: { id: 'guest-id' } }),
    recordLogin: async () => true,
    discardSession: async () => { calls.push('discard') },
    ...overrides,
  }
  return { handle: createTemporaryAccessHandler(backend), calls }
}

test('strong codes round-trip with case, spaces and grouping; malformed codes are rejected', async () => {
  const codes = new Set(Array.from({ length: 1000 }, generateCode))
  assert.equal(codes.size, 1000)
  for (const code of codes) {
    assert.equal(code.length, 26)
    assert.equal(normalizeCode(`  ${formatCode(code).toLowerCase()}  `), code)
  }
  for (const invalid of [undefined, null, {}, '', '123456', CODE.slice(1), 'I'.repeat(26), 'O'.repeat(26), 'U'.repeat(26), 'é'.repeat(26), '0'.repeat(81)]) {
    assert.equal(normalizeCode(invalid), null)
  }
  assert.match(await sha256(CODE), /^[a-f0-9]{64}$/)
  assert.notEqual(await codePassword(CODE), await sha256(CODE))
  assert.equal((await codePassword(CODE)).length, 70)
})

test('generation requires current staff permission, never a client-supplied user ID or role', async () => {
  for (const token of [undefined, 'public-key', 'regular', 'temporary', 'expired']) {
    const { handle, calls } = mock()
    const response = await handle(request({ action: 'create', label: 'Guest', duration_hours: 24,
      authorisation: true, user_id: 'admin-id' }, token))
    assert.equal(response.status, 403)
    assert.deepEqual(calls, [])
  }
})

test('generation stores only a hash, creates a separate Auth account and returns the code once', async () => {
  let createdPassword = ''
  let storedHash = ''
  const { handle } = mock({
    createUser: async (email, password) => { assert.ok(email.endsWith('@temporary.invalid')); createdPassword = password; return 'guest-id' },
    registerCode: async (id, hash, label, hours, creator) => {
      assert.deepEqual([id, label, hours, creator], ['guest-id', 'Guest', 24, 'admin-id'])
      storedHash = hash
      return 'code-id'
    },
  })
  const response = await handle(request({ action: 'create', label: ' Guest ', duration_hours: 24 }, 'admin'))
  assert.equal(response.status, 201)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  const result = await response.json()
  assert.deepEqual(Object.keys(result).sort(), ['code', 'id', 'user_id'])
  assert.equal(storedHash, await sha256(normalizeCode(result.code)!))
  assert.equal(createdPassword, await codePassword(normalizeCode(result.code)!))
  assert.notEqual(result.code, storedHash)
})

test('invalid names and lifetimes cannot create Auth users', async () => {
  for (const [label, hours] of [['',24], ['a'.repeat(81),24], ['bad\nname',24], ['Guest',0], ['Guest',169], ['Guest',1.5], ['Guest','24'], ['Guest',null]]) {
    const { handle, calls } = mock()
    assert.equal((await handle(request({ action: 'create', label, duration_hours: hours }, 'admin'))).status, 400)
    assert.deepEqual(calls, [])
  }
})

test('failed registration cleans up the new Auth user without leaking credentials', async () => {
  const { handle, calls } = mock({ registerCode: async () => { throw new Error('secret provider error') } })
  const response = await handle(request({ action: 'create', label: 'Guest', duration_hours: 24 }, 'admin'))
  assert.equal(response.status, 503)
  assert.deepEqual(calls, ['create', 'delete'])
  assert.doesNotMatch(await response.text(), /secret/)
})

test('one code supports concurrent independent sessions under the same user ID', async () => {
  let issued = 0
  const { handle } = mock({ signIn: async (email, password) => {
    assert.equal(email, 'guest@temporary.invalid')
    assert.equal(password, await codePassword(CODE))
    const id = ++issued
    return { access_token: `access-${id}`, refresh_token: `refresh-${id}`, user: { id: 'guest-id' } }
  } })
  const responses = await Promise.all(Array.from({ length: 5 }, () => handle(request({ action: 'login', code: formatCode(CODE).toLowerCase() }))))
  assert.ok(responses.every((response) => response.status === 200))
  const sessions = await Promise.all(responses.map((response) => response.json()))
  assert.equal(new Set(sessions.map((session) => session.refresh_token)).size, 5)
  assert.ok(sessions.every((session) => Object.keys(session).length === 2))
})

test('invalid, unknown, expired and revoked codes use a generic error and all attempts are limited', async () => {
  for (const code of ['short', CODE]) {
    const { handle, calls } = mock({ findCode: async () => null })
    const response = await handle(request({ action: 'login', code }))
    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), { error: INVALID_CODE_MESSAGE })
    assert.deepEqual(calls, ['limit'])
  }
  const { handle } = mock({ consumeAttempt: async () => false, findCode: async () => { throw new Error('Must not look up') } })
  assert.equal((await handle(request({ action: 'login', code: CODE }))).status, 429)
})

test('revocation during login, mismatched identities and storage failures never return tokens', async () => {
  for (const overrides of [
    { recordLogin: async () => false },
    { signIn: async () => ({ access_token: 'secret-access', refresh_token: 'secret-refresh', user: { id: 'someone-else' } }) },
    { recordLogin: async () => { throw new Error('storage failure') } },
  ]) {
    const { handle, calls } = mock(overrides)
    const response = await handle(request({ action: 'login', code: CODE }))
    assert.ok([401,503].includes(response.status))
    assert.ok(calls.includes('discard'))
    assert.doesNotMatch(await response.text(), /access_token|refresh_token|storage failure/)
  }
})

test('unavailable rate limiting fails closed and oversized or malformed requests are rejected', async () => {
  const { handle } = mock({ consumeAttempt: async () => { throw new Error('unavailable') } })
  assert.equal((await handle(request({ action: 'login', code: CODE }))).status, 503)
  for (const body of [[], null, { action: 'unknown' }, { action: 'login', code: 'x'.repeat(5000) }]) {
    assert.equal((await handle(request(body))).status, 400)
  }
  assert.equal((await handle(new Request('https://example.test'))).status, 405)
  assert.equal((await handle(new Request('https://example.test', { method: 'POST', body: 'not json' }))).status, 400)
})

test('backend verification uses Auth and a current database permission, with service keys confined to server calls', async () => {
  const requests: Array<{ url: string; headers: Headers; body: unknown }> = []
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input)
    requests.push({ url, headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : null })
    if (url.endsWith('/auth/v1/user')) return Response.json({ id: 'admin-id' })
    if (url.endsWith('/check_user_is_authorised')) return Response.json(true)
    if (url.endsWith('/auth/v1/admin/users')) return Response.json({ id: 'guest-id' })
    if (url.endsWith('/register_temporary_access_code')) return Response.json('code-id')
    return Response.json(false)
  }
  const backend = createAccessBackend('https://backend.test/', 'public-key', 'secret-service', fakeFetch)
  assert.deepEqual(await backend.getStaffUser('user-token'), { id: 'admin-id' })
  assert.equal(requests[0].headers.get('authorization'), 'Bearer user-token')
  assert.equal(requests[1].headers.get('authorization'), 'Bearer user-token')
  await backend.createUser('user@temporary.invalid', 'unexposed-password')
  assert.equal(requests[2].headers.get('authorization'), 'Bearer secret-service')
  assert.equal((requests[2].body as { app_metadata: { access_kind: string } }).app_metadata.access_kind, 'temporary')
  await backend.registerCode('guest-id', 'hash', 'Guest', 24, 'admin-id')
  assert.equal(requests[3].headers.get('apikey'), 'secret-service')
  const denied = createAccessBackend('https://backend.test', 'public', 'service', async () => Response.json({ error: 'Unauthorized' }, { status: 401 }))
  assert.equal(await denied.getStaffUser('forged'), null)
  assert.equal(await denied.signIn('email', 'password'), null)
})

test('UI access rules deny expired identities and Collections for temporary users', () => {
  const profile: ProfileRow = { id: 'id', email: '', full_name: 'Guest', profile_url: null, status: 'active',
    settings: false, analytics: false, authorisation: false, access_kind: 'temporary', expires_at: new Date(Date.now()+60000).toISOString() }
  assert.equal(hasAppAccess(profile), true)
  assert.equal(canUseCollections(profile), false)
  assert.equal(hasAppAccess({ ...profile, expires_at: 'invalid' }), false)
  assert.equal(hasAppAccess({ ...profile, expires_at: new Date(0).toISOString() }), false)
  assert.equal(hasAppAccess(null), false)
  assert.equal(canUseCollections({ ...profile, access_kind: 'regular' }), true)
  assert.equal(hasAppAccess({ ...profile, status: 'pending' }), false)
})
