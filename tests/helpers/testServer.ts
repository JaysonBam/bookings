// Local-only Auth/PostgREST simulator for browser integration tests. Database
// policies and the production Edge handler run unchanged; external services are
// simulated so tests never contact the real Supabase projects.
import { createServer } from 'node:http'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { ADMIN_ID, REGULAR_ID, PENDING_ID, asRole, createAccessDatabase, type Role } from './accessDatabase.ts'
import { createAccessBackend } from '../../supabase/functions/temporary-access/backend.ts'
import { createTemporaryAccessHandler } from '../../supabase/functions/temporary-access/core.ts'

const port = Number(process.env.BOOKINGS_TEST_API_PORT || 55439)
const base = `http://127.0.0.1:${port}`
const publicKey = 'test-public-key'
const serviceKey = 'test-service-key'
const signingSecret = 'local-test-signing-secret'
const configuration=readFileSync(new URL('../../supabase/config.toml',import.meta.url),'utf8')
const emailConfiguration=configuration.split('[auth.email]')[1].split('\n[')[0]
const emailProviderEnabled=/^\s*enable_signup\s*=\s*true\s*$/m.test(emailConfiguration)
let db = await createAccessDatabase()
type User = { id: string; email: string; app_metadata: Record<string, unknown>; user_metadata: Record<string, unknown> }
const users = new Map<string, User>()
const passwords = new Map<string, string>()
const sessions = new Map<string, User>()
const refreshTokens = new Map<string, User>()
function seedUsers() {
  users.clear(); passwords.clear(); sessions.clear(); refreshTokens.clear()
  for (const [id,email,name] of [[ADMIN_ID,'admin@example.com','Access Staff'],[REGULAR_ID,'staff@example.com','Regular Staff'],[PENDING_ID,'pending@example.com','Google User']]) {
    users.set(id, { id, email, app_metadata: { provider: 'google', providers: ['google'] }, user_metadata: { full_name: name } })
  }
}
seedUsers()
function newSession(user: User) {
  const now = Math.floor(Date.now()/1000)
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', email: user.email,
    app_metadata: user.app_metadata, user_metadata: user.user_metadata, exp: now+3600, iat: now, jti: crypto.randomUUID() })).toString('base64url')
  const signature = createHmac('sha256', signingSecret).update(`${header}.${payload}`).digest('base64url')
  const access_token = `${header}.${payload}.${signature}`
  const refresh_token = crypto.randomUUID()
  sessions.set(access_token, user); refreshTokens.set(refresh_token,user)
  return { access_token, refresh_token, user, token_type: 'bearer', expires_in: 3600, expires_at: now+3600 }
}
const edge = createTemporaryAccessHandler(createAccessBackend(base, publicKey, serviceKey))
const server = createServer(async (incoming, outgoing) => {
  const url = new URL(incoming.url || '/', base)
  const headers = new Headers()
  for (const [key,value] of Object.entries(incoming.headers)) {
    if (typeof value === 'string') headers.set(key,value)
  }
  outgoing.setHeader('Access-Control-Allow-Origin','*')
  outgoing.setHeader('Access-Control-Allow-Headers',headers.get('access-control-request-headers') ||
    'authorization,apikey,content-type,x-client-info,prefer,accept-profile,content-profile,x-supabase-api-version')
  outgoing.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS')
  outgoing.setHeader('Content-Type','application/json')
  const send = (data: unknown, status=200) => { outgoing.statusCode=status; outgoing.end(JSON.stringify(data)) }
  if (incoming.method === 'OPTIONS') { outgoing.statusCode=204; outgoing.end(); return }
  const chunks = []
  for await (const chunk of incoming) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString()
  const body = text ? JSON.parse(text) as Record<string, unknown> : {}
  const token = headers.get('authorization')?.replace(/^Bearer\s+/i,'') || ''
  const user = sessions.get(token)
  const role: Role = token === serviceKey ? 'service_role' : user ? 'authenticated' : 'anon'
  try {
    if (url.pathname === '/health') { send({ ok: true }); return }
    if (url.pathname === '/__reset') { await db.close(); db=await createAccessDatabase(); seedUsers(); send({ok:true}); return }
    if (url.pathname === '/__session') {
      const id = body.kind === 'admin' ? ADMIN_ID : body.kind === 'pending' ? PENDING_ID : REGULAR_ID
      send(newSession(users.get(id)!)); return
    }
    if (url.pathname === '/__expire') {
      await db.query(`UPDATE private.temporary_access_codes SET created_at=statement_timestamp()-interval '2 hours',
        expires_at=statement_timestamp()-interval '1 hour' WHERE id=$1`, [body.id])
      send({ ok: true }); return
    }
    if (url.pathname === '/functions/v1/temporary-access') {
      const result = await edge(new Request(url, { method: incoming.method, headers, body: text }))
      outgoing.statusCode=result.status
      outgoing.setHeader('Cache-Control','no-store')
      outgoing.end(await result.text()); return
    }
    if (url.pathname === '/functions/v1/bookings-profile-access') { send({ data: [] }); return }
    if (url.pathname === '/auth/v1/authorize') {
      const session = newSession(users.get(PENDING_ID)!)
      const fragment = new URLSearchParams({ access_token:session.access_token,refresh_token:session.refresh_token,
        token_type:'bearer',expires_in:'3600',type:'signup' })
      outgoing.statusCode=302
      outgoing.setHeader('Location',`${url.searchParams.get('redirect_to')}#${fragment}`)
      outgoing.end(); return
    }
    if (url.pathname === '/auth/v1/user') { send(user || { message:'Unauthorized' }, user ? 200 : 401); return }
    if (url.pathname === '/auth/v1/admin/users' && role === 'service_role') {
      const id=crypto.randomUUID()
      const created: User = { id,email:String(body.email), app_metadata:body.app_metadata as Record<string,unknown>,user_metadata:{} }
      await db.query(`INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES ($1,$2,$3)`,[id,created.email,JSON.stringify(created.app_metadata)])
      users.set(id,created); passwords.set(id,String(body.password)); send(created); return
    }
    if (url.pathname.startsWith('/auth/v1/admin/users/') && incoming.method === 'DELETE' && role === 'service_role') {
      const id=url.pathname.split('/').at(-1)!
      await db.query(`DELETE FROM auth.users WHERE id=$1`,[id]); users.delete(id); passwords.delete(id); send({}); return
    }
    if (url.pathname === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'password' && !emailProviderEnabled) {
        send({message:'Email logins are disabled',code:'email_provider_disabled'},422); return
      }
      const found=url.searchParams.get('grant_type') === 'refresh_token'
        ? refreshTokens.get(String(body.refresh_token))
        : [...users.values()].find((candidate)=>candidate.email === body.email && passwords.get(candidate.id) === body.password)
      send(found ? newSession(found) : {message:'Invalid login credentials'},found ? 200 : 400); return
    }
    if (url.pathname === '/auth/v1/logout') {
      sessions.delete(token)
      // Remove only this session: other logins using the same code remain valid.
      send({}); return
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const name=url.pathname.split('/').at(-1)!
      const keys=Object.keys(body)
      if (!/^[a-z_]+$/.test(name) || !keys.every(key=>/^[a-z_]+$/.test(key))) throw new Error('Invalid RPC')
      const argumentsSql=keys.map((key,i)=>`${key} => $${i+1}`).join(',')
      const result=await asRole(db,role,user?.id || null,(tx)=>tx.query(`SELECT * FROM public.${name}(${argumentsSql})`,Object.values(body)),user?.email)
      const scalar=new Set(['check_user_is_authorised','register_temporary_access_code','revoke_temporary_access_code',
        'record_temporary_access_login','consume_temporary_access_attempt'])
      send(scalar.has(name) ? result.rows[0]?.[name] : result.rows); return
    }
    const table=url.pathname.replace('/rest/v1/','')
    if (!['profiles','rooms','courses','settings','bookings','bugs','logs'].includes(table)) { send({message:'Unknown endpoint'},404); return }
    const columns = ['email','id','key','booking_day','room_id','bulk_booking_id','status','state','start_time']
    const filters: string[]=[]
    const values: unknown[]=[]
    for (const column of columns) {
      const value=url.searchParams.get(column)
      if (value?.startsWith('eq.')) { values.push(value.slice(3)); filters.push(`${column}=$${values.length}`) }
      if (value?.startsWith('in.(')) {
        values.push(value.slice(4,-1).split(',')); filters.push(`${column}::text=ANY($${values.length}::text[])`)
      }
      for (const [prefix,operator] of [['lt.','<'],['gte.','>='],['lte.','<='],['neq.','<>']]) {
        if (value?.startsWith(prefix)) { values.push(value.slice(prefix.length)); filters.push(`${column}${operator}$${values.length}`) }
      }
    }
    const where=filters.length ? ` WHERE ${filters.join(' AND ')}` : ''
    let sql=`SELECT * FROM public.${table}${where}`
    if (incoming.method === 'PATCH') {
      const entries=Object.entries(body)
      if (!entries.every(([key])=>/^[a-z_]+$/.test(key))) throw new Error('Invalid update')
      const updates=entries.map(([key,value])=> { values.push(value); return `${key}=$${values.length}` })
      sql=`UPDATE public.${table} SET ${updates.join(',')}${where} RETURNING *`
    }
    if (incoming.method === 'DELETE') sql=`DELETE FROM public.${table}${where} RETURNING *`
    const result=await asRole(db,role,user?.id || null,async (tx)=> {
      if (incoming.method !== 'POST') return tx.query(sql,values)
      const records=Array.isArray(body) ? body as Record<string,unknown>[] : [body]
      const rows: Record<string,unknown>[]=[]
      for (const record of records) {
        const entries=Object.entries(record)
        if (!entries.length || !entries.every(([key])=>/^[a-z_]+$/.test(key))) throw new Error('Invalid insert')
        const placeholders=entries.map((_,i)=>`$${i+1}`).join(',')
        const inserted=await tx.query(`INSERT INTO public.${table} (${entries.map(([key])=>key).join(',')})
          VALUES (${placeholders}) RETURNING *`,entries.map(([,value])=>value))
        rows.push(...inserted.rows)
      }
      return {rows}
    },user?.email)
    // PostgREST serializes SQL DATE as yyyy-mm-dd; PGlite returns a Date.
    const rows=result.rows.map((row)=>table === 'bookings' && row.booking_day instanceof Date
      ? {...row,booking_day:row.booking_day.toISOString().slice(0,10)} : row)
    const single=headers.get('accept')?.includes('vnd.pgrst.object')
    if (single && rows.length !== 1) { send({message:'Not found',code:'PGRST116'},406); return }
    send(single ? rows[0] : rows)
  } catch (error) {
    send({message:error instanceof Error ? error.message : 'Test backend failed',code:'42501'},403)
  }
})
server.listen(port,'127.0.0.1',()=>process.stdout.write('Test backend ready\n'))
const stop = () => { server.close(() => { void db.close().then(()=>process.exit(0)) }) }
process.on('SIGTERM',stop); process.on('SIGINT',stop)
