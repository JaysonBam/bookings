import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'

export const accounts = {
  admin: { id: '00000000-0000-4000-8000-000000000001', email: 'admin@example.com' },
  user: { id: '00000000-0000-4000-8000-000000000002', email: 'user@example.com' },
  expired: { id: '00000000-0000-4000-8000-000000000003', email: 'expired@example.com' },
  pending: { id: '00000000-0000-4000-8000-000000000004', email: 'pending@example.com' },
  expiredAdmin: { id: '00000000-0000-4000-8000-000000000005', email: 'expired-admin@example.com' },
  missing: { id: '00000000-0000-4000-8000-000000000006', email: 'missing@example.com' },
}

export async function createAccessDatabase() {
  const db = new PGlite({ extensions: { btree_gist } })
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.jwt() returns jsonb language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
    $$;
    create function auth.uid() returns uuid language sql stable as $$
      select (auth.jwt()->>'sub')::uuid;
    $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  `)
  const migrations = new URL('../../supabase/migrations/', import.meta.url)
  for (const name of (await readdir(migrations)).filter(name => name.endsWith('.sql')).sort()) {
    await db.exec(await readFile(new URL(name, migrations), 'utf8'))
  }
  for (const account of Object.values(accounts)) {
    await db.query('insert into auth.users(id,email) values ($1,$2)', [account.id, account.email])
  }
  for (const [key, account] of Object.entries(accounts)) {
    if (key === 'missing') continue
    await db.query(`insert into public.profiles(id,email,full_name,status,authorisation,settings,analytics,access_expires_at)
      values ($1,$2,$3,$4,$5,$5,$5,case when $6 then now()-interval '1 hour' else null end)`,
    [key === 'pending' ? null : account.id, account.email, key, key === 'pending' ? 'pending' : 'active', key.toLowerCase().includes('admin'), key.toLowerCase().includes('expired')])
  }
  await db.exec(`
    insert into rooms(name,max_people,min_people) values ('Room 1',8,1);
    insert into courses(name,color_hex) values ('Course 1','#123456');
    insert into settings(key,value) values ('operation_hours','{}');
    insert into bookings(room_id,booking_day,start_time,end_time,booked_by) values (1,current_date,'09:00','10:00','user');
    insert into bugs(description,reporter_name) values ('Test bug','user');
    insert into logs(event_type,detail) values ('booking_create','{}');
  `)
  return db
}

export async function asAccount(db: PGlite, account: { id: string, email: string } | null, sql: string, params: unknown[] = []) {
  return db.transaction(async tx => {
    await tx.exec(account ? 'set local role authenticated' : 'set local role anon')
    await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(account
      ? { sub: account.id, email: account.email, role: 'authenticated' } : { role: 'anon' })])
    return tx.query(sql, params)
  })
}
