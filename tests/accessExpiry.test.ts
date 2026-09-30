import assert from 'node:assert/strict'
import test, { after, before } from 'node:test'
import { setTimeout } from 'node:timers/promises'
import { accessDurations, formatAccessExpiry, hasProfileAccess } from '../src/lib/accessExpiry.ts'
import { accounts, asAccount, createAccessDatabase } from './helpers/accessDatabase.ts'

let db: Awaited<ReturnType<typeof createAccessDatabase>>
before(async () => { db = await createAccessDatabase() })
after(async () => { await db?.close() })
const asUser = (sql: string, params: unknown[] = []) => asAccount(db, accounts.user, sql, params)
const asAdmin = (sql: string, params: unknown[] = []) => asAccount(db, accounts.admin, sql, params)
const access = (email: string, hours: number | null, add = false) =>
  asAdmin('select public.set_profile_access_expiry($1,$2,$3)', [email, hours, add])

test('Never, minute/hour/day labels and exact expiry boundary', () => {
  const now = Date.parse('2026-09-30T10:00:00Z')
  assert.deepEqual(accessDurations.map(option => option.hours), [null, 8, 24, 168])
  assert.equal(formatAccessExpiry(null, now), 'Never')
  for (const [minutes, label] of [[40, 'In 40 minutes'], [120, 'In 2 hours'], [8640, 'In 6 days'], [1, 'In 1 minute']] as const) {
    const expiry = new Date(now + minutes * 60_000).toISOString()
    assert.equal(formatAccessExpiry(expiry, now), label)
    assert.equal(hasProfileAccess({ access_expires_at: expiry }, now), true)
  }
  assert.equal(hasProfileAccess({ access_expires_at: null }, now), true)
  for (const expiry of ['2026-09-30T10:00:00Z', 'invalid', '2026-09-30T09:59:59Z']) {
    assert.equal(formatAccessExpiry(expiry, now), 'Inactive')
    assert.equal(hasProfileAccess({ access_expires_at: expiry }, now), false)
  }
  assert.equal(hasProfileAccess(null, now), false)
})

test('existing permanent users keep reads, bookings, maintenance and bug votes', async () => {
  for (const table of ['profiles', 'bookings', 'rooms', 'courses', 'settings', 'bugs', 'logs']) {
    assert.ok((await asUser(`select * from public.${table}`)).rows.length > 0, table)
  }
  assert.equal((await asUser('select * from profiles')).rows.length, 1)
  const inserted = await asUser("insert into bookings(room_id,booking_day,start_time,end_time,booked_by) values (1,current_date,'11:00','12:00','user') returning id")
  await asUser('update rooms set is_available=false where id=1')
  await asUser('select public.increment_bug_upvotes(1)')
  assert.equal((await asUser('delete from bookings where id=$1 returning id', [inserted.rows[0].id])).rows.length, 1)
  await assert.rejects(asUser("insert into courses(name) values ('Forbidden')"), /row-level security/)
})

test('only Access Control can add users and set durations from the server clock', async () => {
  for (const hours of [null, 8, 24, 168]) {
    const email = `duration-${hours}@example.com`
    await access(email, hours, true)
    const result = await asAdmin('select status, extract(epoch from (access_expires_at-now()))/3600 as hours from profiles where email=$1', [email])
    assert.equal(result.rows[0].status, 'pending')
    if (hours === null) assert.equal(result.rows[0].hours, null)
    else assert.ok(Math.abs(Number(result.rows[0].hours) - hours) < 0.01)
  }
  await assert.rejects(asUser('select public.set_profile_access_expiry($1,8,true)', ['attacker@example.com']), /Access Control/)
  await assert.rejects(asUser("insert into profiles(email) values ('attacker@example.com')"), /row-level security/)
  await assert.rejects(access('invalid@example.com', 1, true), /Invalid access duration/)
  await assert.rejects(access('duration-8@example.com', 8, true), /duplicate key/)
  await assert.rejects(access('unknown@example.com', 8), /User not found/)
})

test('own login updates remain allowed; own expiry, permissions and identity rebinding are blocked', async () => {
  await asUser("update profiles set full_name='Normal user', profile_url='avatar' where email=$1", [accounts.user.email])
  for (const field of ["access_expires_at=now()+interval '7 days'", 'authorisation=true', 'settings=true', 'analytics=true', `id='${accounts.admin.id}'`, "status='pending'", "email='other@example.com'"]) {
    await assert.rejects(asUser(`update profiles set ${field} where email=$1`, [accounts.user.email]), /Access Control|row-level security/)
  }
  await assert.rejects(asUser('select public.set_profile_access_expiry($1,null)', [accounts.user.email]), /Access Control/)
  await asAccount(db, accounts.pending, "update profiles set id=$1,status='active',full_name='First login' where email=$2", [accounts.pending.id, accounts.pending.email])
  const pending = await asAccount(db, accounts.pending, 'select id,status from profiles')
  assert.equal(pending.rows[0].id, accounts.pending.id)
  assert.equal(pending.rows[0].status, 'active')
  const wrongIdentity = { ...accounts.user, id: accounts.missing.id }
  assert.equal((await asAccount(db, wrongIdentity, 'select * from profiles')).rows.length, 0)
})

test('deactivation blocks an unchanged token immediately, including profile queries used by HexForge', async () => {
  await access(accounts.user.email, 0)
  for (const table of ['profiles', 'bookings', 'rooms', 'courses', 'settings', 'bugs', 'logs']) {
    assert.equal((await asUser(`select * from public.${table}`)).rows.length, 0, table)
  }
  for (const projection of ['email,full_name,status', 'authorisation']) {
    assert.equal((await asUser(`select ${projection} from profiles where email=$1`, [accounts.user.email])).rows.length, 0)
  }
  await assert.rejects(asUser("insert into bookings(room_id,booking_day,start_time,end_time,booked_by) values (1,current_date,'13:00','14:00','user')"), /Access expired or inactive/)
  for (const sql of ["update bookings set booked_by='blocked' returning id", 'delete from bookings returning id', 'update profiles set access_expires_at=null returning email']) {
    await assert.rejects(asUser(sql), /Access expired or inactive/)
  }
  await assert.rejects(asUser("insert into bugs(description,reporter_name) values ('blocked','user')"), /Access expired or inactive/)
  await assert.rejects(asUser("insert into logs(event_type) values ('blocked')"), /Access expired or inactive/)
  await assert.rejects(asUser('select public.increment_bug_upvotes(1)'), /Access denied/)
  assert.equal((await db.query('select count(*)::int as count from bookings')).rows[0].count, 1)
})

test('reactivation preserves the profile and permissions and renews from now', async () => {
  const previous = (await asAdmin('select * from profiles where email=$1', [accounts.user.email])).rows[0]
  await access(accounts.user.email, 8)
  const renewed = (await asUser('select * from profiles')).rows[0]
  assert.equal(renewed.id, previous.id)
  for (const key of ['settings', 'analytics', 'authorisation', 'full_name', 'status']) assert.equal(renewed[key], previous[key])
  assert.ok((await asUser('select * from bookings')).rows.length > 0)
  await access(accounts.user.email, null)
  assert.equal((await asUser('select access_expires_at from profiles')).rows[0].access_expires_at, null)
})

test('time passing expires access without logout, token refresh, cleanup or scheduled jobs', async () => {
  await db.query("update profiles set access_expires_at=now()+interval '100 milliseconds' where email=$1", [accounts.user.email])
  assert.equal((await asUser('select * from bookings')).rows.length, 1)
  await setTimeout(150)
  assert.equal((await asUser('select * from bookings')).rows.length, 0)
  await access(accounts.user.email, null)
  await db.query('update profiles set access_expires_at=now() where email=$1', [accounts.user.email])
  assert.equal((await asUser('select * from bookings')).rows.length, 0)
  await access(accounts.user.email, null)
})

test('expired admins, expired pending users and missing users cannot bypass the guard', async () => {
  for (const account of [accounts.expired, accounts.expiredAdmin, accounts.missing]) {
    assert.equal((await asAccount(db, account, 'select public.check_user_has_access() as allowed')).rows[0].allowed, false)
    assert.equal((await asAccount(db, account, 'select * from profiles')).rows.length, 0)
    await assert.rejects(asAccount(db, account, 'select public.set_profile_access_expiry($1,null)', [account.email]), /Access Control/)
  }
  await access(accounts.pending.email, 0)
  await assert.rejects(asAccount(db, accounts.pending, "update profiles set status='active' returning email"), /Access expired or inactive/)
  assert.equal((await asAccount(db, null, 'select * from bugs')).rows.length, 0)
  await assert.rejects(asAccount(db, null, 'select public.increment_bug_upvotes(1)'), /permission denied/)
})

test('staff can manage inactive users, delete access, and retain their existing permission toggles', async () => {
  await asAdmin('update profiles set analytics=true where email=$1', [accounts.expired.email])
  assert.equal((await asAdmin('select analytics from profiles where email=$1', [accounts.expired.email])).rows[0].analytics, true)
  await asAdmin('delete from profiles where email=$1', [accounts.expired.email])
  assert.equal((await asAccount(db, accounts.expired, 'select * from bookings')).rows.length, 0)
  for (const table of ['profiles', 'bookings', 'rooms', 'courses', 'settings', 'bugs', 'logs']) {
    await assert.rejects(asUser(`truncate public.${table}`), /permission denied/)
  }
})

test('staff can deactivate their own session but another active staff member must reactivate it', async () => {
  await access(accounts.expiredAdmin.email, null)
  await access(accounts.admin.email, 0)
  assert.equal((await asAdmin('select * from profiles')).rows.length, 0)
  await assert.rejects(access(accounts.admin.email, null), /Access Control/)
  await asAccount(db, accounts.expiredAdmin, 'select public.set_profile_access_expiry($1,null)', [accounts.admin.email])
  assert.ok((await asAdmin('select * from profiles')).rows.length > 1)
})
