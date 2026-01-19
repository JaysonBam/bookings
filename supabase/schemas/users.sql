create type public.profile_status as enum (
  'pending',
  'active'
);

create table public.profiles (
  id uuid null references auth.users(id) on delete cascade,

  email text not null,
  full_name text,
  profile_url text,

  status public.profile_status not null default 'pending',

  primary key (email),

  settings boolean not null default false,
  authorisation boolean not null default false,
  analytics boolean not null default false
);

alter table public.profiles enable row level security;

-- HELPER FUNCTION TO PREVENT RLS RECURSION
-- This function runs with "security definer" privileges, bypassing RLS checks
-- when reading theprofiles table to check for authorisation status.
CREATE OR REPLACE FUNCTION public.check_user_is_authorised()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE email = (auth.jwt() ->> 'email')
    AND authorisation = true
  );
END;
$$;

-- BASIC SELF-ACCESS POLICIES (Required for login)
-- 1. Read own profile
CREATE POLICY select_profile_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (email = (auth.jwt() ->> 'email'));

-- 2. Update own profile (e.g. for login logic to set ID/status)
CREATE POLICY update_profile_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (email = (auth.jwt() ->> 'email'))
  WITH CHECK (email = (auth.jwt() ->> 'email'));

-- ADMIN ACCESS POLICIES (Required for Access Page)
-- 3. Read ALL profiles if user is authorized.
CREATE POLICY select_profiles_admin
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (check_user_is_authorised());

-- 4. Insert new profiles if authorized
CREATE POLICY insert_profiles_admin
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (check_user_is_authorised());

-- 5. Update ANY profile if authorized
CREATE POLICY update_profiles_admin
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (check_user_is_authorised())
  WITH CHECK (check_user_is_authorised());

-- 6. Delete profiles if authorized
CREATE POLICY delete_profiles_admin
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (check_user_is_authorised());
