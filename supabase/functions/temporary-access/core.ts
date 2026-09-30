export const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const INVALID_CODE_MESSAGE = 'Invalid or expired access code.'
export type AccessSession = { access_token: string; refresh_token: string; user: { id: string } }
export type AccessBackend = {
  getStaffUser: (token: string) => Promise<{ id: string } | null>
  createUser: (email: string, password: string) => Promise<string>
  deleteUser: (id: string) => Promise<void>
  registerCode: (userId: string, hash: string, label: string, hours: number, creator: string) => Promise<string>
  consumeAttempt: (ipHash: string, codeHash: string) => Promise<boolean>
  findCode: (hash: string) => Promise<{ user_id: string; auth_email: string } | null>
  signIn: (email: string, password: string) => Promise<AccessSession | null>
  recordLogin: (userId: string, hash: string) => Promise<boolean>
  discardSession: (session: AccessSession) => Promise<void>
}

export function normalizeCode(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 80) return null
  const code = value.trim().replace(/[\s-]/g, '').toUpperCase()
  return code.length === 26 && [...code].every((character) => CODE_ALPHABET.includes(character)) ? code : null
}
export function generateCode(): string {
  // Exactly 32 symbols: masking five random bits introduces no modulo bias.
  return [...crypto.getRandomValues(new Uint8Array(26))].map((byte) => CODE_ALPHABET[byte & 31]).join('')
}
export const formatCode = (code: string) => code.match(/.{1,5}/g)?.join('-') ?? code
export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
// Auth stores its own password hash. No plaintext or reversible password is
// stored by the app; this domain-separated credential never goes to the browser.
export const codePassword = async (code: string) => `Tmp!1-${await sha256(`temporary-access-password-v1:${code}`)}`

async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('Invalid request')
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Invalid request')
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > 4096) { await reader.cancel(); throw new Error('Invalid request') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  const body: unknown = JSON.parse(new TextDecoder().decode(bytes))
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid request')
  return body as Record<string, unknown>
}

export function createTemporaryAccessHandler(backend: AccessBackend) {
  return async (request: Request): Promise<Response> => {
    const respond = (status: number, data: unknown) => Response.json(data, {
      status, headers: { 'Cache-Control': 'no-store', 'Pragma': 'no-cache' },
    })
    if (request.method !== 'POST') return respond(405, { error: 'Method not allowed.' })
    let body: Record<string, unknown>
    try { body = await readBody(request) } catch { return respond(400, { error: 'Invalid request.' }) }
    try {
      if (body.action === 'create') {
        const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
        const staff = bearer ? await backend.getStaffUser(bearer) : null
        if (!staff) return respond(403, { error: 'Access Control permission required.' })
        const label = typeof body.label === 'string' ? body.label.trim() : ''
        const hours = body.duration_hours
        if (!label || label.length > 80 || [...label].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
          || typeof hours !== 'number' || !Number.isInteger(hours) || hours < 1 || hours > 168) {
          return respond(400, { error: 'Enter a name and a duration between 1 hour and 7 days.' })
        }
        const code = generateCode()
        const hash = await sha256(code)
        const userId = await backend.createUser(`${crypto.randomUUID()}@temporary.invalid`, await codePassword(code))
        try {
          const id = await backend.registerCode(userId, hash, label, hours, staff.id)
          return respond(201, { id, user_id: userId, code: formatCode(code) })
        } catch (error) {
          await backend.deleteUser(userId)
          throw error
        }
      }
      if (body.action === 'login') {
        const code = normalizeCode(body.code)
        const hash = await sha256(code ?? 'invalid-code')
        // The global and per-code counters protect even when an IP is spoofed.
        const ip = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown'
        if (!await backend.consumeAttempt(await sha256(`temporary-access-ip:${ip}`), hash)) {
          return respond(429, { error: 'Too many attempts. Try again in 5 minutes.' })
        }
        const grant = code ? await backend.findCode(hash) : null
        if (!grant || !code) return respond(401, { error: INVALID_CODE_MESSAGE })
        const session = await backend.signIn(grant.auth_email, await codePassword(code))
        if (!session) return respond(401, { error: INVALID_CODE_MESSAGE })
        try {
          // Recheck after Auth: revocation may race with token issuance.
          if (session.user.id !== grant.user_id || !await backend.recordLogin(grant.user_id, hash)) {
            await backend.discardSession(session)
            return respond(401, { error: INVALID_CODE_MESSAGE })
          }
        } catch (error) {
          await backend.discardSession(session)
          throw error
        }
        return respond(200, { access_token: session.access_token, refresh_token: session.refresh_token })
      }
      return respond(400, { error: 'Invalid request.' })
    } catch {
      // Never log or return codes, credentials, session tokens or provider errors.
      return respond(503, { error: 'Temporary access is unavailable. Please try again.' })
    }
  }
}
