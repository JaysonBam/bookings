drop policy "delete_profiles_admin" on "public"."profiles";

drop policy "insert_profiles_admin" on "public"."profiles";

drop policy "select_profiles_admin" on "public"."profiles";

drop policy "update_profiles_admin" on "public"."profiles";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.check_user_is_authorised()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE email = (auth.jwt() ->> 'email')
    AND authorisation = true
  );
END;
$function$
;


  create policy "delete_profiles_admin"
  on "public"."profiles"
  as permissive
  for delete
  to authenticated
using (public.check_user_is_authorised());



  create policy "insert_profiles_admin"
  on "public"."profiles"
  as permissive
  for insert
  to authenticated
with check (public.check_user_is_authorised());



  create policy "select_profiles_admin"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using (public.check_user_is_authorised());



  create policy "update_profiles_admin"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using (public.check_user_is_authorised())
with check (public.check_user_is_authorised());



