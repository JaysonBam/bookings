-- Temporary identities never receive a public.profiles row. Keep revoked rows:
-- deleting a grant must never turn a temporary identity into a regular user.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.temporary_access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  auth_email text NOT NULL,
  code_hash text NOT NULL UNIQUE CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL,
  revoked_at timestamptz,
  revoked_by uuid,
  last_used_at timestamptz,
  login_count integer NOT NULL DEFAULT 0,
  CHECK (expires_at > created_at)
);

CREATE TABLE IF NOT EXISTS private.temporary_access_attempts (
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  attempts integer NOT NULL,
  PRIMARY KEY (bucket, window_start)
);

CREATE TABLE IF NOT EXISTS private.access_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  actor_user_id uuid,
  code_id uuid,
  event_type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'
);

ALTER TABLE private.temporary_access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.temporary_access_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.access_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.is_temporary_identity(user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM private.temporary_access_codes c WHERE c.user_id = $1)
    OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = $1
      AND u.raw_app_meta_data ->> 'access_kind' = 'temporary');
$$;
REVOKE ALL ON FUNCTION private.is_temporary_identity(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_regular_access_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT NOT private.is_temporary_identity(auth.uid()) AND EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND (u.raw_app_meta_data -> 'providers') ? 'google');
$$;

CREATE OR REPLACE FUNCTION public.is_temporary_access_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.is_temporary_identity(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.has_regular_booking_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.is_regular_access_user()
    AND EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.status = 'active');
$$;

CREATE OR REPLACE FUNCTION public.has_active_booking_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN private.is_temporary_identity(auth.uid()) THEN
    EXISTS (SELECT 1 FROM private.temporary_access_codes c
      WHERE c.user_id = auth.uid() AND c.revoked_at IS NULL
        AND c.expires_at > statement_timestamp())
    ELSE public.has_regular_booking_access() END;
$$;

CREATE OR REPLACE FUNCTION public.check_user_is_authorised()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.has_regular_booking_access() AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.authorisation = true);
$$;

REVOKE ALL ON FUNCTION public.is_temporary_access_user(),
  public.is_regular_access_user(),
  public.has_regular_booking_access(), public.has_active_booking_access(),
  public.check_user_is_authorised() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_temporary_access_user(),
  public.is_regular_access_user(),
  public.has_regular_booking_access(), public.has_active_booking_access(),
  public.check_user_is_authorised() TO authenticated, service_role;

-- Apply even when another permissive policy matches an email the user changes.
DROP POLICY IF EXISTS "Profiles - regular identities only" ON public.profiles;
CREATE POLICY "Profiles - regular identities only" ON public.profiles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_regular_access_user())
  WITH CHECK (public.is_regular_access_user());

CREATE OR REPLACE FUNCTION public.prevent_temporary_staff_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF lower(NEW.email) LIKE '%@temporary.invalid'
    OR private.is_temporary_identity(NEW.id) THEN
    RAISE EXCEPTION 'Temporary accounts cannot become staff profiles' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_temporary_staff_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS prevent_temporary_staff_profile ON public.profiles;
CREATE TRIGGER prevent_temporary_staff_profile BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_temporary_staff_profile();

-- Client-readable identity metadata contains no code hash or authentication email.
CREATE OR REPLACE FUNCTION public.get_temporary_access_session()
RETURNS TABLE (user_id uuid, label text, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.user_id, c.label, c.expires_at FROM private.temporary_access_codes c
  WHERE c.user_id = auth.uid() AND c.revoked_at IS NULL
    AND c.expires_at > statement_timestamp();
$$;
REVOKE ALL ON FUNCTION public.get_temporary_access_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_temporary_access_session() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_temporary_access_codes()
RETURNS TABLE (id uuid, user_id uuid, label text, created_at timestamptz,
  expires_at timestamptz, revoked_at timestamptz, last_used_at timestamptz, login_count integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.check_user_is_authorised() THEN
    RAISE EXCEPTION 'Access Control permission required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT c.id, c.user_id, c.label, c.created_at, c.expires_at,
    c.revoked_at, c.last_used_at, c.login_count
    FROM private.temporary_access_codes c
    WHERE (c.revoked_at IS NULL AND c.expires_at > statement_timestamp())
      OR c.id IN (SELECT recent.id FROM private.temporary_access_codes recent
        ORDER BY recent.created_at DESC LIMIT 200)
    ORDER BY c.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_temporary_access_code(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE affected private.temporary_access_codes;
BEGIN
  IF NOT public.check_user_is_authorised() THEN
    RAISE EXCEPTION 'Access Control permission required' USING ERRCODE = '42501';
  END IF;
  UPDATE private.temporary_access_codes SET revoked_at = statement_timestamp(), revoked_by = auth.uid()
    WHERE id = p_id AND revoked_at IS NULL RETURNING * INTO affected;
  IF affected.id IS NOT NULL THEN
    INSERT INTO private.access_audit (actor_user_id, code_id, event_type)
      VALUES (auth.uid(), p_id, 'temporary_access_revoked');
  END IF;
  RETURN EXISTS (SELECT 1 FROM private.temporary_access_codes WHERE id = p_id);
END;
$$;
REVOKE ALL ON FUNCTION public.list_temporary_access_codes(), public.revoke_temporary_access_code(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_temporary_access_codes(), public.revoke_temporary_access_code(uuid)
  TO authenticated;

-- Only the Edge Function can register an Auth user or inspect a hashed code.
CREATE OR REPLACE FUNCTION public.register_temporary_access_code(
  p_user_id uuid, p_code_hash text, p_label text, p_duration_hours integer, p_created_by uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE code_id uuid; user_email text;
BEGIN
  IF p_duration_hours NOT BETWEEN 1 AND 168 OR p_duration_hours IS NULL
    OR length(btrim(p_label)) NOT BETWEEN 1 AND 80 OR p_label IS NULL THEN
    RAISE EXCEPTION 'Invalid temporary access details';
  END IF;
  IF private.is_temporary_identity(p_created_by) OR NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id = p.id
      WHERE p.id = p_created_by AND p.status = 'active' AND p.authorisation
        AND (u.raw_app_meta_data -> 'providers') ? 'google') THEN
    RAISE EXCEPTION 'Access Control permission required' USING ERRCODE = '42501';
  END IF;
  SELECT u.email INTO user_email FROM auth.users u WHERE u.id = p_user_id
    AND u.raw_app_meta_data ->> 'access_kind' = 'temporary'
    AND lower(u.email) LIKE '%@temporary.invalid';
  IF user_email IS NULL THEN RAISE EXCEPTION 'Invalid temporary identity'; END IF;
  INSERT INTO private.temporary_access_codes (user_id, auth_email, code_hash, label, expires_at, created_by)
    VALUES (p_user_id, user_email, p_code_hash, btrim(p_label),
      statement_timestamp() + make_interval(hours => p_duration_hours), p_created_by)
    RETURNING id INTO code_id;
  INSERT INTO private.access_audit (actor_user_id, code_id, event_type)
    VALUES (p_created_by, code_id, 'temporary_access_created');
  RETURN code_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_temporary_access_code(p_code_hash text)
RETURNS TABLE (user_id uuid, auth_email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.user_id, c.auth_email FROM private.temporary_access_codes c
    WHERE c.code_hash = p_code_hash AND c.revoked_at IS NULL
      AND c.expires_at > statement_timestamp();
$$;

CREATE OR REPLACE FUNCTION public.record_temporary_access_login(p_user_id uuid, p_code_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE code_id uuid;
BEGIN
  UPDATE private.temporary_access_codes SET last_used_at = statement_timestamp(), login_count = login_count + 1
    WHERE user_id = p_user_id AND code_hash = p_code_hash AND revoked_at IS NULL
      AND expires_at > statement_timestamp() RETURNING id INTO code_id;
  IF code_id IS NULL THEN RETURN false; END IF;
  INSERT INTO private.access_audit (actor_user_id, code_id, event_type)
    VALUES (p_user_id, code_id, 'temporary_access_login');
  RETURN true;
END;
$$;

-- Shared, atomic counters work across Edge instances. Global and code limits
-- still apply if a caller spoofs a forwarded IP. No raw codes or IPs are stored.
CREATE OR REPLACE FUNCTION public.consume_temporary_access_attempt(p_ip_hash text, p_code_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE window_time timestamptz; bucket_key text; attempt_count integer; allowed boolean := true;
BEGIN
  IF p_ip_hash !~ '^[a-f0-9]{64}$' OR p_code_hash !~ '^[a-f0-9]{64}$'
    OR p_ip_hash IS NULL OR p_code_hash IS NULL THEN RETURN false; END IF;
  window_time := to_timestamp(floor(extract(epoch FROM statement_timestamp()) / 300) * 300);
  FOREACH bucket_key IN ARRAY ARRAY['global', 'ip:' || p_ip_hash, 'code:' || p_code_hash] LOOP
    INSERT INTO private.temporary_access_attempts AS counter (bucket, window_start, attempts)
      VALUES (bucket_key, window_time, 1)
      ON CONFLICT (bucket, window_start) DO UPDATE SET attempts = counter.attempts + 1
      RETURNING attempts INTO attempt_count;
    IF attempt_count > (CASE WHEN bucket_key = 'global' THEN 300
      WHEN bucket_key LIKE 'ip:%' THEN 30 ELSE 20 END) THEN allowed := false; END IF;
  END LOOP;
  DELETE FROM private.temporary_access_attempts WHERE window_start < window_time - interval '10 minutes';
  RETURN allowed;
END;
$$;

REVOKE ALL ON FUNCTION public.register_temporary_access_code(uuid, text, text, integer, uuid),
  public.find_temporary_access_code(text), public.record_temporary_access_login(uuid, text),
  public.consume_temporary_access_attempt(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_temporary_access_code(uuid, text, text, integer, uuid),
  public.find_temporary_access_code(text), public.record_temporary_access_login(uuid, text),
  public.consume_temporary_access_attempt(text, text) TO service_role;

DROP POLICY IF EXISTS "Bookings - full access for authenticated" ON public.bookings;
CREATE POLICY "Bookings - full access for authenticated" ON public.bookings FOR ALL TO authenticated
  USING (public.has_active_booking_access()) WITH CHECK (public.has_active_booking_access());
-- A restrictive policy also closes any older, more permissive policy.
DROP POLICY IF EXISTS "Bookings - active access required" ON public.bookings;
CREATE POLICY "Bookings - active access required" ON public.bookings AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.has_active_booking_access()) WITH CHECK (public.has_active_booking_access());

DROP POLICY IF EXISTS "Rooms - authenticated view" ON public.rooms;
CREATE POLICY "Rooms - authenticated view" ON public.rooms FOR SELECT TO authenticated
  USING (public.has_active_booking_access());
DROP POLICY IF EXISTS "Rooms - authenticated edit" ON public.rooms;
CREATE POLICY "Rooms - authenticated edit" ON public.rooms FOR UPDATE TO authenticated
  USING (public.has_active_booking_access()) WITH CHECK (public.has_active_booking_access());

CREATE OR REPLACE FUNCTION public.protect_temporary_room_updates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.is_temporary_access_user()
    AND (to_jsonb(NEW) - 'dynamic_labels') IS DISTINCT FROM (to_jsonb(OLD) - 'dynamic_labels') THEN
    RAISE EXCEPTION 'Temporary users may only update maintenance labels' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_temporary_room_updates() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS protect_temporary_room_updates ON public.rooms;
CREATE TRIGGER protect_temporary_room_updates BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.protect_temporary_room_updates();

DROP POLICY IF EXISTS "Allow authenticated full select" ON public.courses;
CREATE POLICY "Allow authenticated full select" ON public.courses FOR SELECT TO authenticated
  USING (public.has_active_booking_access());
DROP POLICY IF EXISTS "Allow authenticated full select" ON public.settings;
CREATE POLICY "Allow authenticated full select" ON public.settings FOR SELECT TO authenticated
  USING (public.has_regular_booking_access() OR (public.has_active_booking_access()
    AND key IN ('operation_hours', 'saturday_hours', 'testing_clock')));

DROP POLICY IF EXISTS "Enable read access for all users" ON public.bugs;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.bugs;
CREATE POLICY "Enable read access for all users" ON public.bugs FOR SELECT TO authenticated
  USING (public.has_active_booking_access());
CREATE POLICY "Enable insert for all users" ON public.bugs FOR INSERT TO authenticated
  WITH CHECK (public.has_active_booking_access());
CREATE OR REPLACE FUNCTION public.increment_bug_upvotes(bug_id integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.has_active_booking_access() THEN
    RAISE EXCEPTION 'Active booking access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.bugs SET upvotes = upvotes + 1 WHERE id = bug_id AND status != 'fixed';
END;
$$;
REVOKE ALL ON FUNCTION public.increment_bug_upvotes(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_bug_upvotes(integer) TO authenticated;

ALTER TABLE public.logs ADD COLUMN IF NOT EXISTS actor_user_id uuid;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.logs;
DROP POLICY IF EXISTS "Enable select for authenticated users only" ON public.logs;
CREATE POLICY "Enable insert for authenticated users only" ON public.logs FOR INSERT TO authenticated
  WITH CHECK (public.has_active_booking_access());
CREATE POLICY "Enable select for authenticated users only" ON public.logs FOR SELECT TO authenticated
  USING (public.has_regular_booking_access());

CREATE OR REPLACE FUNCTION public.stamp_log_actor()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN NEW.actor_user_id := auth.uid(); END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.stamp_log_actor() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS stamp_log_actor ON public.logs;
CREATE TRIGGER stamp_log_actor BEFORE INSERT ON public.logs FOR EACH ROW EXECUTE FUNCTION public.stamp_log_actor();

CREATE OR REPLACE FUNCTION public.audit_booking_actor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE booking public.bookings; code_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN booking := OLD; ELSE booking := NEW; END IF;
  IF auth.uid() IS NOT NULL THEN
    SELECT c.id INTO code_id FROM private.temporary_access_codes c WHERE c.user_id = auth.uid();
    INSERT INTO private.access_audit (actor_user_id, code_id, event_type, detail)
      VALUES (auth.uid(), code_id, 'booking_' || lower(TG_OP),
        jsonb_build_object('booking_id', booking.id, 'booking_day', booking.booking_day));
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_booking_actor() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS audit_booking_actor ON public.bookings;
CREATE TRIGGER audit_booking_actor AFTER INSERT OR UPDATE OR DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.audit_booking_actor();
