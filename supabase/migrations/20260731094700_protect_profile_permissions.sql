-- Prevent ordinary authenticated users from escalating their own privileges.
-- The existing self-update policy intentionally permits profile metadata updates,
-- so this trigger protects the administrator-controlled columns at write time.
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

DROP TRIGGER IF EXISTS protect_profile_permissions ON public.profiles;

CREATE TRIGGER protect_profile_permissions
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_permissions();
