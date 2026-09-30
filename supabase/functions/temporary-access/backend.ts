import type { AccessBackend, AccessSession } from './core.ts'

export function createAccessBackend(url: string, publicKey: string, serviceKey: string,
  request: typeof fetch = fetch): AccessBackend {
  const baseUrl = url.replace(/\/$/, '')
  async function call(path: string, key: string, token: string, body?: unknown, method = 'POST') {
    const response = await request(`${baseUrl}${path}`, {
      method, headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`Backend request failed (${response.status})`)
    return await response.json().catch(() => null) as unknown
  }
  const serviceRpc = (name: string, body: unknown) => call(`/rest/v1/rpc/${name}`, serviceKey, serviceKey, body)
  return {
    async getStaffUser(token) {
      try {
        const user = await call('/auth/v1/user', publicKey, token, undefined, 'GET') as { id?: string }
        const allowed = await call('/rest/v1/rpc/check_user_is_authorised', publicKey, token, {})
        return user.id && allowed === true ? { id: user.id } : null
      } catch { return null }
    },
    async createUser(email, password) {
      const user = await call('/auth/v1/admin/users', serviceKey, serviceKey, {
        email, password, email_confirm: true, app_metadata: { access_kind: 'temporary' },
      }) as { id?: string }
      if (!user.id) throw new Error('Invalid Auth response')
      return user.id
    },
    async deleteUser(id) {
      await call(`/auth/v1/admin/users/${encodeURIComponent(id)}`, serviceKey, serviceKey, undefined, 'DELETE')
    },
    async registerCode(userId, hash, label, hours, creator) {
      const id = await serviceRpc('register_temporary_access_code', {
        p_user_id: userId, p_code_hash: hash, p_label: label, p_duration_hours: hours, p_created_by: creator,
      })
      if (typeof id !== 'string') throw new Error('Invalid grant response')
      return id
    },
    async consumeAttempt(ipHash, codeHash) {
      return await serviceRpc('consume_temporary_access_attempt', { p_ip_hash: ipHash, p_code_hash: codeHash }) === true
    },
    async findCode(hash) {
      const rows = await serviceRpc('find_temporary_access_code', { p_code_hash: hash }) as Array<{
        user_id: string; auth_email: string
      }>
      return rows[0] ?? null
    },
    async signIn(email, password) {
      const response = await request(`${baseUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: { apikey: publicKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(15000),
      })
      if (response.status === 400 || response.status === 401) return null
      if (!response.ok) throw new Error('Auth is unavailable')
      const session = await response.json() as AccessSession
      if (!session.access_token || !session.refresh_token || !session.user?.id) throw new Error('Invalid Auth session')
      return session
    },
    async recordLogin(userId, hash) {
      return await serviceRpc('record_temporary_access_login', { p_user_id: userId, p_code_hash: hash }) === true
    },
    async discardSession(session) {
      try { await call('/auth/v1/logout?scope=local', publicKey, session.access_token) } catch { /* RLS still denies access */ }
    },
  }
}
