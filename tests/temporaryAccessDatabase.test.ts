import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test, { before, after } from 'node:test'
import type { PGlite } from '@electric-sql/pglite'
import { ADMIN_ID, REGULAR_ID, PENDING_ID, addTemporaryCode, asRole, createAccessDatabase } from './helpers/accessDatabase.ts'

let db: PGlite
before(async () => { db = await createAccessDatabase() })
after(async () => { await db?.close() })
const denied = /permission denied|row-level security|permission required|cannot become staff|Active booking access/i

test('the migration applies to existing schemas and can be reapplied safely', async () => {
  await db.exec(readFileSync(new URL('../supabase/migrations/20260930100000_temporary_access_codes.sql', import.meta.url), 'utf8'))
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM public.profiles`)).rows[0].n, 3)
})

test('only Access Control staff can list and revoke codes; private data and service RPCs are inaccessible', async () => {
  const code = await addTemporaryCode(db)
  const listed = await asRole(db, 'authenticated', ADMIN_ID, (tx) => tx.query(`SELECT * FROM list_temporary_access_codes()`))
  assert.ok(listed.rows.some((row) => row.id === code.id))
  assert.equal('code_hash' in listed.rows[0], false)
  assert.equal('auth_email' in listed.rows[0], false)
  for (const [role, id] of [['anon', null], ['authenticated', REGULAR_ID], ['authenticated', code.userId]] as const) {
    for (const query of [
      `SELECT * FROM list_temporary_access_codes()`,
      `SELECT revoke_temporary_access_code('${code.id}')`,
      `SELECT * FROM private.temporary_access_codes`,
      `SELECT * FROM private.access_audit`,
      `SELECT * FROM find_temporary_access_code('${code.hash}')`,
      `SELECT consume_temporary_access_attempt('${code.hash}','${code.hash}')`,
    ]) await assert.rejects(asRole(db, role, id, (tx) => tx.query(query)), denied)
  }
})

test('temporary users can book, update maintenance labels and report bugs, without settings or analytics access', async () => {
  const code = await addTemporaryCode(db)
  await asRole(db, 'authenticated', code.userId, async (tx) => {
    assert.equal((await tx.query(`SELECT * FROM get_temporary_access_session()`)).rows[0].user_id, code.userId)
    assert.equal((await tx.query(`SELECT * FROM rooms`)).rows.length, 1)
    assert.equal((await tx.query(`SELECT * FROM courses`)).rows.length, 1)
    const inserted = await tx.query<{ id: number }>(`INSERT INTO bookings(room_id,booking_day,start_time,end_time,booked_by)
      VALUES (1,'2026-10-01','08:00','09:00','Any display name') RETURNING id`)
    await tx.query(`UPDATE bookings SET state='Active' WHERE id=$1`, [inserted.rows[0].id])
    await tx.query(`DELETE FROM bookings WHERE id=$1`, [inserted.rows[0].id])
    await tx.exec(`UPDATE rooms SET dynamic_labels=ARRAY['Lights'];
      INSERT INTO bugs(description,reporter_name) VALUES ('Temporary report','Helper');
      SELECT increment_bug_upvotes(1);`)
    assert.equal((await tx.query(`SELECT * FROM profiles`)).rows.length, 0)
    assert.equal((await tx.query(`SELECT * FROM settings WHERE key='private_setting'`)).rows.length, 0)
    assert.equal((await tx.query(`SELECT * FROM settings`)).rows.length, 3)
    assert.equal((await tx.query(`UPDATE settings SET value='{}' RETURNING key`)).rows.length, 0)
    assert.equal((await tx.query(`SELECT * FROM logs`)).rows.length, 0)
    await tx.query(`INSERT INTO logs(event_type,detail,actor_user_id) VALUES ('booking_create','{}',$1)`, [ADMIN_ID])
  }, code.email)
  await assert.rejects(asRole(db, 'authenticated', code.userId, (tx) => tx.exec(`UPDATE rooms SET name='Changed'`)), /maintenance labels/)
  await assert.rejects(asRole(db, 'authenticated', code.userId, (tx) => tx.exec(`INSERT INTO courses(name) VALUES ('Changed')`)), denied)
  assert.equal((await db.query(`SELECT actor_user_id FROM logs ORDER BY id DESC LIMIT 1`)).rows[0].actor_user_id, code.userId)
  const audit = await db.query(`SELECT event_type,actor_user_id FROM private.access_audit WHERE code_id=$1 AND event_type LIKE 'booking_%'`, [code.id])
  assert.equal(audit.rows.length, 3)
  assert.ok(audit.rows.every((row) => row.actor_user_id === code.userId))
})

test('revocation immediately denies an existing session and is idempotent', async () => {
  const code = await addTemporaryCode(db)
  for (let login = 0; login < 3; login++) {
    const result = await asRole(db, 'service_role', null, (tx) => tx.query(`SELECT record_temporary_access_login($1,$2) AS ok`, [code.userId, code.hash]))
    assert.equal(result.rows[0].ok, true)
  }
  await asRole(db, 'authenticated', ADMIN_ID, async (tx) => {
    await tx.query(`SELECT revoke_temporary_access_code($1)`, [code.id])
    await tx.query(`SELECT revoke_temporary_access_code($1)`, [code.id])
  })
  await asRole(db, 'authenticated', code.userId, async (tx) => {
    for (const table of ['bookings','rooms','courses','settings','bugs','logs']) {
      assert.equal((await tx.query(`SELECT * FROM ${table}`)).rows.length, 0, table)
    }
    assert.equal((await tx.query(`SELECT * FROM get_temporary_access_session()`)).rows.length, 0)
  })
  await assert.rejects(asRole(db, 'authenticated', code.userId, (tx) => tx.exec(`INSERT INTO bugs(description,reporter_name) VALUES ('Denied','Guest')`)), denied)
  await assert.rejects(asRole(db, 'authenticated', code.userId, (tx) => tx.exec(`SELECT increment_bug_upvotes(1)`)), denied)
  const row = (await db.query(`SELECT login_count FROM private.temporary_access_codes WHERE id=$1`, [code.id])).rows[0]
  assert.equal(row.login_count, 3)
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM private.access_audit WHERE code_id=$1 AND event_type='temporary_access_revoked'`, [code.id])).rows[0].n, 1)
  assert.equal((await asRole(db, 'service_role', null, (tx) => tx.query(`SELECT * FROM find_temporary_access_code($1)`, [code.hash]))).rows.length, 0)
})

test('expiry uses the database clock and does not depend on an application testing clock', async () => {
  const code = await addTemporaryCode(db)
  await db.query(`UPDATE private.temporary_access_codes SET created_at=statement_timestamp()-interval '2 hours',
    expires_at=statement_timestamp()-interval '1 hour' WHERE id=$1`, [code.id])
  await db.exec(`UPDATE settings SET value='{"enabled":true,"date":"2000-01-01","time":"00:00"}' WHERE key='testing_clock'`)
  await asRole(db, 'authenticated', code.userId, async (tx) => {
    assert.equal((await tx.query(`SELECT has_active_booking_access() AS ok`)).rows[0].ok, false)
    assert.equal((await tx.query(`SELECT * FROM get_temporary_access_session()`)).rows.length, 0)
  })
  await assert.rejects(asRole(db, 'authenticated', code.userId, (tx) => tx.exec(`INSERT INTO bookings(room_id,booking_day,start_time,end_time,booked_by)
    VALUES (1,'2026-10-02','08:00','09:00','Expired')`)), denied)
})

test('revoked identity cannot create, update or delete bookings with unchanged session claims', async () => {
  const code = await addTemporaryCode(db)
  const inserted = await asRole(db, 'authenticated', code.userId, (tx) => tx.query<{ id: number }>(
    `INSERT INTO bookings(room_id,booking_day,start_time,end_time,booked_by)
     VALUES (1,'2026-10-09','08:00','09:00','Original guest booking') RETURNING id`), code.email)
  const id = inserted.rows[0].id
  await asRole(db, 'authenticated', ADMIN_ID, (tx) => tx.query(`SELECT revoke_temporary_access_code($1)`, [code.id]))

  await assert.rejects(asRole(db, 'authenticated', code.userId, (tx) => tx.query(
    `INSERT INTO bookings(room_id,booking_day,start_time,end_time,booked_by)
     VALUES (1,'2026-10-09','10:00','11:00','Denied booking')`), code.email), denied)
  await asRole(db, 'authenticated', code.userId, async (tx) => {
    assert.equal((await tx.query(`UPDATE bookings SET booked_by='Unauthorized change' WHERE id=$1 RETURNING id`, [id])).rows.length, 0)
    assert.equal((await tx.query(`DELETE FROM bookings WHERE id=$1 RETURNING id`, [id])).rows.length, 0)
  }, code.email)
  assert.equal((await db.query(`SELECT booked_by FROM bookings WHERE id=$1`, [id])).rows[0].booked_by, 'Original guest booking')
})

test('temporary identities cannot adopt a regular profile, impersonate staff by email or fall back after grant deletion', async () => {
  const code = await addTemporaryCode(db)
  await assert.rejects(db.query(`INSERT INTO profiles(id,email,status,authorisation) VALUES ($1,'adopted@example.com','active',true)`, [code.userId]), denied)
  await assert.rejects(db.query(`INSERT INTO profiles(email) VALUES ($1)`, [code.email]), denied)
  await asRole(db, 'authenticated', code.userId, async (tx) => {
    assert.equal((await tx.query(`SELECT check_user_is_authorised() AS ok`)).rows[0].ok, false)
    assert.equal((await tx.query(`SELECT * FROM profiles WHERE email='admin@example.com'`)).rows.length, 0)
  }, 'admin@example.com')
  await db.query(`DELETE FROM private.temporary_access_codes WHERE id=$1`, [code.id])
  assert.equal((await asRole(db, 'authenticated', code.userId, (tx) => tx.query(`SELECT has_active_booking_access() AS ok`))).rows[0].ok, false)
})

test('regular Google users still activate pending profiles and retain their existing permissions', async () => {
  await asRole(db, 'authenticated', PENDING_ID, (tx) => tx.query(`UPDATE profiles SET id=$1,status='active',full_name='Google User'
    WHERE email='pending@example.com'`, [PENDING_ID]), 'pending@example.com')
  assert.equal((await asRole(db, 'authenticated', PENDING_ID, (tx) => tx.query(`SELECT has_regular_booking_access() AS ok`), 'pending@example.com')).rows[0].ok, true)
  await assert.rejects(asRole(db, 'authenticated', REGULAR_ID,
    (tx) => tx.query(`UPDATE profiles SET authorisation=true WHERE email='staff@example.com'`), 'staff@example.com'), /Only administrators/)
  await asRole(db, 'authenticated', ADMIN_ID, (tx) => tx.exec(`UPDATE settings SET value='{}' WHERE key='private_setting'`), 'admin@example.com')
})

test('email-only identities cannot claim approved staff profiles or create codes', async () => {
  const userId = crypto.randomUUID()
  const temporaryId = crypto.randomUUID()
  const email = 'email-only@example.com'
  await db.query(`INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES
    ($1,$2,'{"providers":["email"]}'),
    ($3,$4,'{"access_kind":"temporary"}')`, [userId,email,temporaryId,`${temporaryId}@temporary.invalid`])
  await db.query(`INSERT INTO profiles(id,email,status,authorisation) VALUES ($1,$2,'active',true)`, [userId,email])
  await asRole(db,'authenticated',userId,async (tx) => {
    assert.equal((await tx.query(`SELECT * FROM profiles`)).rows.length,0)
    assert.equal((await tx.query(`UPDATE profiles SET id=$1,status='active' WHERE email=$2 RETURNING id`,[userId,email])).rows.length,0)
    assert.equal((await tx.query(`SELECT has_active_booking_access() AS ok`)).rows[0].ok,false)
    assert.equal((await tx.query(`SELECT check_user_is_authorised() AS ok`)).rows[0].ok,false)
    await assert.rejects(tx.query(`SELECT list_temporary_access_codes()`),denied)
  },email)
  await assert.rejects(asRole(db,'service_role',null,(tx)=>tx.query(
    `SELECT register_temporary_access_code($1,$2,'Denied',24,$3)`,[temporaryId,'b'.repeat(64),userId])),denied)
})

test('code registration rechecks staff permission after Auth user creation', async () => {
  const userId=crypto.randomUUID()
  await db.query(`INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES ($1,$2,'{"access_kind":"temporary"}')`,
    [userId,`${userId}@temporary.invalid`])
  await asRole(db,'authenticated',ADMIN_ID,(tx)=>tx.exec(`UPDATE profiles SET authorisation=true WHERE email='staff@example.com'`))
  assert.equal((await asRole(db,'authenticated',REGULAR_ID,(tx)=>tx.query(`SELECT check_user_is_authorised() AS ok`))).rows[0].ok,true)
  await asRole(db,'authenticated',ADMIN_ID,(tx)=>tx.exec(`UPDATE profiles SET authorisation=false WHERE email='staff@example.com'`))
  await assert.rejects(asRole(db,'service_role',null,(tx)=>tx.query(
    `SELECT register_temporary_access_code($1,$2,'Denied',24,$3)`,[userId,'c'.repeat(64),REGULAR_ID])),denied)
  await assert.rejects(asRole(db,'authenticated',REGULAR_ID,(tx)=>tx.query(`SELECT list_temporary_access_codes()`)),denied)
})

test('database rate limiting is shared, applies to unknown codes and has per-code and global limits', async () => {
  await db.exec(`TRUNCATE private.temporary_access_attempts`)
  for (let i = 0; i < 21; i++) {
    const result = await asRole(db, 'service_role', null, (tx) => tx.query(`SELECT consume_temporary_access_attempt($1,$2) AS ok`,
      [i.toString(16).padStart(64,'0'), 'a'.repeat(64)]))
    assert.equal(result.rows[0].ok, i < 20)
  }
  await db.exec(`TRUNCATE private.temporary_access_attempts`)
  for (let i = 0; i < 31; i++) {
    const result = await asRole(db, 'service_role', null, (tx) => tx.query(`SELECT consume_temporary_access_attempt($1,$2) AS ok`,
      ['d'.repeat(64), i.toString(16).padStart(64,'0')]))
    assert.equal(result.rows[0].ok, i < 30)
  }
  await db.exec(`TRUNCATE private.temporary_access_attempts`)
  for (let i = 0; i < 301; i++) {
    const hash = i.toString(16).padStart(64,'0')
    const result = await asRole(db, 'service_role', null, (tx) => tx.query(`SELECT consume_temporary_access_attempt($1,$2) AS ok`, [hash, hash]))
    assert.equal(result.rows[0].ok, i < 300)
  }
  await db.exec(`TRUNCATE private.temporary_access_attempts`)
})

test('live codes remain manageable even after more than 200 newer removed codes', async () => {
  const live=await addTemporaryCode(db)
  await db.query(`WITH created AS (
    INSERT INTO auth.users(id,email,raw_app_meta_data)
      SELECT gen_random_uuid(),gen_random_uuid()::text || '@temporary.invalid','{"access_kind":"temporary"}'
      FROM generate_series(1,201) RETURNING id,email
  ) INSERT INTO private.temporary_access_codes(user_id,auth_email,code_hash,label,created_at,expires_at,created_by,revoked_at)
    SELECT id,email,md5(id::text)||md5(id::text),'Removed history',
      statement_timestamp()+interval '1 minute',statement_timestamp()+interval '1 hour',$1,statement_timestamp()
    FROM created`,[ADMIN_ID])
  const listed=await asRole(db,'authenticated',ADMIN_ID,(tx)=>tx.query(`SELECT * FROM list_temporary_access_codes()`))
  assert.ok(listed.rows.some(row=>row.id === live.id))
  await asRole(db,'authenticated',ADMIN_ID,(tx)=>tx.query(`SELECT revoke_temporary_access_code($1)`,[live.id]))
  assert.equal((await asRole(db,'authenticated',live.userId,(tx)=>tx.query(`SELECT has_active_booking_access() AS ok`))).rows[0].ok,false)
})
