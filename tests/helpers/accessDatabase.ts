import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist'

export const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
export const REGULAR_ID = '22222222-2222-4222-8222-222222222222'
export const PENDING_ID = '33333333-3333-4333-8333-333333333333'
export type Database = Pick<PGlite, 'query' | 'exec'>
export type Role = 'authenticated' | 'anon' | 'service_role'

export async function createAccessDatabase() {
  const db = new PGlite({ extensions: { btree_gist } })
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text UNIQUE, raw_app_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
      $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT (auth.jwt() ->> 'sub')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
  `)
  for (const name of ['users', 'bugs', 'settings', 'rooms', 'courses', 'bookings', 'logs']) {
    await db.exec(readFileSync(new URL(`../../supabase/schemas/${name}.sql`, import.meta.url), 'utf8'))
  }
  await db.exec(`
    GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
  `)
  await db.exec(readFileSync(new URL('../../supabase/migrations/20260930100000_temporary_access_codes.sql', import.meta.url), 'utf8'))
  await db.query(`INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES
    ($1,'admin@example.com','{"providers":["google"]}'),
    ($2,'staff@example.com','{"providers":["google"]}'),
    ($3,'pending@example.com','{"providers":["google"]}')`,
    [ADMIN_ID, REGULAR_ID, PENDING_ID])
  await db.query(`INSERT INTO public.profiles(id,email,full_name,status,authorisation,settings,analytics)
    VALUES ($1,'admin@example.com','Access Staff','active',true,true,true),
      ($2,'staff@example.com','Regular Staff','active',false,false,false),
      (NULL,'pending@example.com',NULL,'pending',false,false,false)`, [ADMIN_ID, REGULAR_ID])
  await db.exec(`
    INSERT INTO rooms(name) VALUES ('Room A');
    INSERT INTO courses(name) VALUES ('Engineering');
    INSERT INTO settings(key,value) VALUES ('operation_hours','{"start":"06:00","end":"21:00"}'),
      ('testing_clock','{"enabled":false}'), ('saturday_hours','{"enabled":true}'),('private_setting','{}');
    INSERT INTO bugs(description,reporter_name) VALUES ('Test report','Staff');
  `)
  return db
}

export async function asRole<T>(db: PGlite, role: Role, userId: string | null,
  operation: (tx: Database) => Promise<T>, email = ''): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`SET LOCAL ROLE ${role}`)
    await tx.query(`SELECT set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: userId, email, role })])
    return operation(tx)
  })
}

export async function addTemporaryCode(db: PGlite) {
  const userId = crypto.randomUUID()
  const email = `${userId}@temporary.invalid`
  const hash = crypto.randomUUID().replaceAll('-', '').repeat(2)
  await db.query(`INSERT INTO auth.users(id,email,raw_app_meta_data) VALUES ($1,$2,'{"access_kind":"temporary"}')`, [userId, email])
  const result = await asRole(db, 'service_role', null, (tx) => tx.query<{ id: string }>(
    `SELECT public.register_temporary_access_code($1,$2,'Temporary Helper',24,$3) AS id`, [userId, hash, ADMIN_ID]))
  return { id: result.rows[0].id, userId, hash, email }
}
