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

-- Permission fields are administrator-controlled even though users may update
-- non-security metadata on their own profile row.
CREATE OR REPLACE FUNCTION public.protect_profile_permissions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    NEW.authorisation IS DISTINCT FROM OLD.authorisation
    OR NEW.settings IS DISTINCT FROM OLD.settings
    OR NEW.analytics IS DISTINCT FROM OLD.analytics
  )
  AND NOT public.check_user_is_authorised()
  THEN
    RAISE EXCEPTION 'Only administrators may change profile permissions'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profile_permissions() FROM PUBLIC;

CREATE TRIGGER protect_profile_permissions
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_permissions();

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
