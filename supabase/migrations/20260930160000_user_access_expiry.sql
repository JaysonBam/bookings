-- NULL preserves permanent access for every existing user. Past dates mean inactive.
alter table public.profiles add column if not exists access_expires_at timestamptz;

-- Read current database state on every request, including requests with old JWTs.
create or replace function public.check_user_has_access()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where auth.uid() is not null
      and p.email = (auth.jwt() ->> 'email')
      and (p.id is null or p.id = auth.uid())
      and (p.access_expires_at is null or p.access_expires_at > now())
  );
$$;
revoke all on function public.check_user_has_access() from public;
grant execute on function public.check_user_has_access() to anon, authenticated;

create or replace function public.check_user_is_authorised()
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.check_user_has_access() and exists (
    select 1 from public.profiles p
    where p.email = (auth.jwt() ->> 'email') and p.authorisation
  );
$$;
revoke all on function public.check_user_is_authorised() from public;
grant execute on function public.check_user_is_authorised() to authenticated;

-- UPDATE/DELETE filtered by RLS can otherwise return a misleading empty success.
-- A statement trigger rejects expired writes before any rows are considered.
create or replace function public.require_user_access()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and not public.check_user_has_access() then
    raise exception 'Access expired or inactive. Contact Access Control staff.' using errcode = '42501';
  end if;
  return null;
end;
$$;

-- AND this guard with the existing permissions; do not replace or broaden them.
-- Profiles are included so login and the HexForge backends cannot see an expired
-- caller's profile. Active Access Control staff can still see/manage inactive users.
do $$
declare table_name text;
begin
  foreach table_name in array array['profiles', 'bookings', 'rooms', 'courses', 'settings', 'bugs', 'logs']
  loop
    execute format(
      'create policy "Require unexpired access" on public.%I as restrictive for all to public
       using ((select public.check_user_has_access()))
       with check ((select public.check_user_has_access()))', table_name
    );
    execute format(
      'create trigger require_user_access before insert or update or delete on public.%I
       for each statement execute function public.require_user_access()', table_name
    );
    -- TRUNCATE bypasses row-level security; browser roles never need it.
    execute format('revoke truncate on public.%I from anon, authenticated', table_name);
  end loop;
end;
$$;

-- Login may update identity details, but users may never extend their own access
-- or grant themselves Access Control and then change expiry. Staff keep existing CRUD.
create or replace function public.protect_profile_access()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user = 'authenticated' and not public.check_user_is_authorised() then
    if new.email is distinct from old.email
      or new.access_expires_at is distinct from old.access_expires_at
      or new.settings is distinct from old.settings
      or new.analytics is distinct from old.analytics
      or new.authorisation is distinct from old.authorisation
      or (new.id is distinct from old.id and (old.id is not null or new.id is distinct from auth.uid()))
      or (new.status is distinct from old.status and not (old.status = 'pending' and new.status = 'active'))
    then
      raise exception 'Only Access Control staff can change user access.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger protect_profile_access before update on public.profiles
for each row execute function public.protect_profile_access();

-- One small RPC keeps durations relative to the server clock and adds users
-- atomically with their expiry. Zero deactivates; NULL reactivates permanently.
create or replace function public.set_profile_access_expiry(
  target_email text, duration_hours integer, add_user boolean default false
)
returns void language plpgsql set search_path = ''
as $$
declare expires_at timestamptz;
begin
  if not public.check_user_is_authorised() then
    raise exception 'Only Access Control staff can change user access.' using errcode = '42501';
  end if;
  if duration_hours is not null and duration_hours not in (0, 8, 24, 168) then
    raise exception 'Invalid access duration.' using errcode = '22023';
  end if;
  expires_at := case when duration_hours is null then null
    else now() + make_interval(hours => duration_hours) end;
  if add_user then
    insert into public.profiles (email, status, access_expires_at)
    values (trim(target_email), 'pending', expires_at);
  else
    update public.profiles set access_expires_at = expires_at where email = target_email;
    if not found then
      raise exception 'User not found.' using errcode = 'P0002';
    end if;
  end if;
end;
$$;
revoke all on function public.set_profile_access_expiry(text, integer, boolean) from public;
grant execute on function public.set_profile_access_expiry(text, integer, boolean) to authenticated;

-- This existing SECURITY DEFINER RPC bypasses RLS, so it needs the same check.
create or replace function public.increment_bug_upvotes(bug_id integer)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.check_user_has_access() then
    raise exception 'Access denied.' using errcode = '42501';
  end if;
  update public.bugs set upvotes = upvotes + 1 where id = bug_id and status != 'fixed';
end;
$$;
revoke all on function public.increment_bug_upvotes(integer) from public;
grant execute on function public.increment_bug_upvotes(integer) to authenticated;
