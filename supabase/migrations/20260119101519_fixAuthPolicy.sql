drop policy "delete_profile_if_authorized" on "public"."profiles";

drop policy "insert_profile_if_authorized" on "public"."profiles";

drop policy "list_all_profiles_if_authorized" on "public"."profiles";

drop policy "select_profile_by_email_authenticated" on "public"."profiles";

drop policy "update_profile_by_email_authenticated" on "public"."profiles";

drop policy "update_profile_if_authorized" on "public"."profiles";


  create policy "delete_profiles_admin"
  on "public"."profiles"
  as permissive
  for delete
  to authenticated
using ((( SELECT profiles_1.authorisation
   FROM public.profiles profiles_1
  WHERE (profiles_1.email = (auth.jwt() ->> 'email'::text))) = true));



  create policy "insert_profiles_admin"
  on "public"."profiles"
  as permissive
  for insert
  to authenticated
with check ((( SELECT profiles_1.authorisation
   FROM public.profiles profiles_1
  WHERE (profiles_1.email = (auth.jwt() ->> 'email'::text))) = true));



  create policy "select_profile_own"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((email = (auth.jwt() ->> 'email'::text)));



  create policy "select_profiles_admin"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((( SELECT profiles_1.authorisation
   FROM public.profiles profiles_1
  WHERE (profiles_1.email = (auth.jwt() ->> 'email'::text))) = true));



  create policy "update_profile_own"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using ((email = (auth.jwt() ->> 'email'::text)))
with check ((email = (auth.jwt() ->> 'email'::text)));



  create policy "update_profiles_admin"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using ((( SELECT profiles_1.authorisation
   FROM public.profiles profiles_1
  WHERE (profiles_1.email = (auth.jwt() ->> 'email'::text))) = true))
with check ((( SELECT profiles_1.authorisation
   FROM public.profiles profiles_1
  WHERE (profiles_1.email = (auth.jwt() ->> 'email'::text))) = true));



