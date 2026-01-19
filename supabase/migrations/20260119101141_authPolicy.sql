
  create policy "delete_profile_if_authorized"
  on "public"."profiles"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles profiles_1
  WHERE ((profiles_1.email = (auth.jwt() ->> 'email'::text)) AND (profiles_1.authorisation = true)))));



  create policy "insert_profile_if_authorized"
  on "public"."profiles"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.profiles profiles_1
  WHERE ((profiles_1.email = (auth.jwt() ->> 'email'::text)) AND (profiles_1.authorisation = true)))));



  create policy "list_all_profiles_if_authorized"
  on "public"."profiles"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles profiles_1
  WHERE ((profiles_1.email = (auth.jwt() ->> 'email'::text)) AND (profiles_1.authorisation = true)))));



  create policy "update_profile_if_authorized"
  on "public"."profiles"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles profiles_1
  WHERE ((profiles_1.email = (auth.jwt() ->> 'email'::text)) AND (profiles_1.authorisation = true)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles profiles_1
  WHERE ((profiles_1.email = (auth.jwt() ->> 'email'::text)) AND (profiles_1.authorisation = true)))));



