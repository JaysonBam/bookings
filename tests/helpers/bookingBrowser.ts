import type { BrowserContext } from '@playwright/test'
import { accounts, asAccount, createAccessDatabase } from './accessDatabase'

type Account = typeof accounts.admin
type Database = Awaited<ReturnType<typeof createAccessDatabase>>

function sessionFor(account: Account) {
  const expires_at = Math.floor(Date.now() / 1000) + 3600
  const payload = Buffer.from(JSON.stringify({ sub: account.id, email: account.email, exp: expires_at, role: 'authenticated' })).toString('base64url')
  return { access_token: `test.${payload}.test`, refresh_token: 'local-only', token_type: 'bearer', expires_in: 3600, expires_at,
    user: { ...account, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'google' }, user_metadata: { full_name: account.email }, identities: [], created_at: new Date().toISOString() } }
}

// All non-app traffic is intercepted. The browser uses real migration/RLS logic
// against local PostgreSQL; Google/Auth, HTTP transport and HexForge are simulated.
export async function prepareBookingContext(context: BrowserContext, db: Database, account: Account, appOrigin = 'http://127.0.0.1:5182') {
  const session = sessionFor(account)
  await context.addInitScript(value => { if (!localStorage.getItem('sb-127-auth-token')) localStorage.setItem('sb-127-auth-token', JSON.stringify(value)) }, session)
  await context.routeWebSocket('**/*', socket => socket.close())
  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin === appOrigin) return route.continue()
    if (url.origin === 'http://127.0.0.1:55441') return route.fulfill({ json: { data: [] } })
    if (url.origin !== 'http://127.0.0.1:55440') return route.abort('blockedbyclient')
    const token = request.headers().authorization?.replace(/^Bearer /, '')
    let caller: Account | null = null
    try {
      const sub = JSON.parse(Buffer.from(token?.split('.')[1] || '', 'base64url').toString()).sub
      caller = Object.values(accounts).find(candidate => candidate.id === sub) ?? null
    } catch { /* The local anonymous fixture has no JWT. */ }
    if (url.pathname.startsWith('/auth/v1/')) {
      return route.fulfill({ status: 200, json: url.pathname.endsWith('/user') ? session.user : {} })
    }
    try {
      if (url.pathname.startsWith('/rest/v1/rpc/')) {
        const name = url.pathname.split('/').pop()
        const body = request.postDataJSON()
        if (name === 'increment_bug_upvotes') {
          await asAccount(db, caller, 'select public.increment_bug_upvotes($1)', [body.bug_id])
          return route.fulfill({ json: null })
        }
        if (name !== 'set_profile_access_expiry') throw new Error(`Unexpected RPC ${name}`)
        await asAccount(db, caller, 'select public.set_profile_access_expiry($1,$2,$3)', [body.target_email, body.duration_hours, body.add_user ?? false])
        return route.fulfill({ json: null })
      }
      const table = url.pathname.split('/').pop()!
      if (!['profiles', 'bookings', 'rooms', 'courses', 'settings', 'bugs', 'logs'].includes(table)) throw new Error(`Unexpected table ${table}`)
      const values: unknown[] = []
      const filters: string[] = []
      for (const [key, value] of url.searchParams) {
        if (['select', 'order', 'limit', 'on_conflict', 'columns'].includes(key)) continue
        const operators: Record<string, string> = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }
        const dot = value.indexOf('.')
        const operator = value.slice(0, dot)
        const operand = value.slice(dot + 1)
        if (!/^[a-z_]+$/.test(key) || (!operators[operator] && operator !== 'in')) throw new Error(`Unsupported fixture filter ${key}`)
        values.push(operator === 'in' ? operand.slice(1, -1).split(',') : operand)
        filters.push(operator === 'in' ? `${key}=any($${values.length})` : `${key}${operators[operator]}$${values.length}`)
      }
      const where = filters.length ? ` where ${filters.join(' and ')}` : ''
      let sql = `select * from public.${table}${where}`
      if (request.method() === 'PATCH') {
        const assignments = Object.entries(request.postDataJSON()).map(([key, value]) => {
          if (!/^[a-z_]+$/.test(key)) throw new Error('Invalid fixture column')
          values.push(value)
          return `${key}=$${values.length}`
        })
        sql = `update public.${table} set ${assignments.join(',')}${where} returning *`
      } else if (request.method() === 'DELETE') sql = `delete from public.${table}${where} returning *`
      else if (request.method() === 'POST') {
        const body = request.postDataJSON()
        const inputs = Array.isArray(body) ? body : [body]
        const columns = Object.keys(inputs[0])
        if (!columns.length || !columns.every(key => /^[a-z_]+$/.test(key))) throw new Error('Invalid fixture columns')
        const tuples = inputs.map(input => '(' + columns.map(key => {
          const value = input[key]
          values.push(value && typeof value === 'object' && !Array.isArray(value) ? JSON.stringify(value) : value)
          return `$${values.length}`
        }).join(',') + ')')
        const upsert = table === 'settings' && url.searchParams.has('on_conflict') ? ' on conflict(key) do update set value=excluded.value' : ''
        sql = `insert into public.${table} (${columns.join(',')}) values ${tuples.join(',')}${upsert} returning *`
      }
      if (request.method() === 'GET' && url.searchParams.has('order')) {
        const order = url.searchParams.get('order')!.split(',').map(item => {
          const [column, direction] = item.split('.')
          if (!/^[a-z_]+$/.test(column) || !['asc', 'desc'].includes(direction)) throw new Error('Invalid fixture order')
          return `${column} ${direction}`
        })
        sql += ` order by ${order.join(',')}`
      }
      const { rows } = await asAccount(db, caller, sql, values)
      if (table === 'bookings') {
        for (const row of rows) row.booking_day = (row.booking_day as Date).toISOString().slice(0, 10)
        for (const [relation, foreignKey] of [['rooms', 'room_id'], ['courses', 'course_id']]) {
          if (!new RegExp(`${relation}\\s*\\(`).test(url.searchParams.get('select') || '')) continue
          const related = (await asAccount(db, caller, `select * from ${relation}`)).rows
          for (const row of rows) row[relation] = related.find(item => item.id === row[foreignKey]) || null
        }
      }
      if (request.headers().accept?.includes('application/vnd.pgrst.object+json')) {
        if (rows.length !== 1) return route.fulfill({ status: 406, json: { code: 'PGRST116', message: 'Profile unavailable' } })
        return route.fulfill({ json: rows[0] })
      }
      return route.fulfill({ json: rows })
    } catch (error) {
      const failure = error as { code?: string, message: string }
      return route.fulfill({ status: 403, json: { code: failure.code || '42501', message: failure.message } })
    }
  })
}
