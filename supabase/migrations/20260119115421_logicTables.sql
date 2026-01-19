create extension if not exists "btree_gist" with schema "public";

create sequence "public"."bookings_id_seq";

create sequence "public"."bugs_id_seq";

create sequence "public"."courses_id_seq";

create sequence "public"."rooms_id_seq";


  create table "public"."bookings" (
    "id" integer not null default nextval('public.bookings_id_seq'::regclass),
    "room_id" integer not null,
    "course_id" integer,
    "course_name" text,
    "start_time" time without time zone not null,
    "end_time" time without time zone not null,
    "booking_day" date not null,
    "student_numbers" text,
    "borrowed_items" text[] default '{}'::text[],
    "booked_by" text not null,
    "state" text not null default 'Reserved'::text
      );


alter table "public"."bookings" enable row level security;


  create table "public"."bugs" (
    "id" integer not null default nextval('public.bugs_id_seq'::regclass),
    "created_at" timestamp with time zone not null default now(),
    "description" text not null,
    "reporter_name" text not null,
    "upvotes" integer not null default 0,
    "status" text not null default 'new'::text,
    "admin_update" text
      );


alter table "public"."bugs" enable row level security;


  create table "public"."courses" (
    "id" integer not null default nextval('public.courses_id_seq'::regclass),
    "name" text not null,
    "color_hex" character(7)
      );


alter table "public"."courses" enable row level security;


  create table "public"."rooms" (
    "id" integer not null default nextval('public.rooms_id_seq'::regclass),
    "name" text not null,
    "capacity" smallint,
    "is_open" boolean default true,
    "is_available" boolean default true,
    "dynamic_labels" text[] default '{}'::text[],
    "borrowable_items" text[] default '{}'::text[]
      );


alter table "public"."rooms" enable row level security;


  create table "public"."settings" (
    "key" text not null,
    "value" jsonb not null,
    "updated_at" timestamp with time zone not null default now()
      );


alter table "public"."settings" enable row level security;

alter sequence "public"."bookings_id_seq" owned by "public"."bookings"."id";

alter sequence "public"."bugs_id_seq" owned by "public"."bugs"."id";

alter sequence "public"."courses_id_seq" owned by "public"."courses"."id";

alter sequence "public"."rooms_id_seq" owned by "public"."rooms"."id";

CREATE UNIQUE INDEX bookings_pkey ON public.bookings USING btree (id);

select 1; 
-- CREATE INDEX bookings_room_id_booking_day_tsrange_excl ON public.bookings USING gist (room_id, booking_day, tsrange((booking_day + start_time), (booking_day + end_time)));

CREATE UNIQUE INDEX bugs_pkey ON public.bugs USING btree (id);

CREATE UNIQUE INDEX courses_pkey ON public.courses USING btree (id);

CREATE UNIQUE INDEX rooms_name_key ON public.rooms USING btree (name);

CREATE UNIQUE INDEX rooms_pkey ON public.rooms USING btree (id);

CREATE UNIQUE INDEX settings_pkey ON public.settings USING btree (key);

alter table "public"."bookings" add constraint "bookings_pkey" PRIMARY KEY using index "bookings_pkey";

alter table "public"."bugs" add constraint "bugs_pkey" PRIMARY KEY using index "bugs_pkey";

alter table "public"."courses" add constraint "courses_pkey" PRIMARY KEY using index "courses_pkey";

alter table "public"."rooms" add constraint "rooms_pkey" PRIMARY KEY using index "rooms_pkey";

alter table "public"."settings" add constraint "settings_pkey" PRIMARY KEY using index "settings_pkey";

alter table "public"."bookings" add constraint "bookings_course_id_fkey" FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL not valid;

alter table "public"."bookings" validate constraint "bookings_course_id_fkey";

alter table "public"."bookings" add constraint "bookings_room_id_booking_day_tsrange_excl" EXCLUDE USING gist (room_id WITH =, booking_day WITH =, tsrange((booking_day + start_time), (booking_day + end_time)) WITH &&);

alter table "public"."bookings" add constraint "bookings_room_id_fkey" FOREIGN KEY (room_id) REFERENCES public.rooms(id) ON DELETE CASCADE not valid;

alter table "public"."bookings" validate constraint "bookings_room_id_fkey";

alter table "public"."bookings" add constraint "bookings_state_check" CHECK ((state = ANY (ARRAY['Active'::text, 'Reserved'::text, 'Ended'::text]))) not valid;

alter table "public"."bookings" validate constraint "bookings_state_check";

alter table "public"."bookings" add constraint "bookings_time_order" CHECK ((end_time > start_time)) not valid;

alter table "public"."bookings" validate constraint "bookings_time_order";

alter table "public"."bugs" add constraint "bugs_status_check" CHECK ((status = ANY (ARRAY['new'::text, 'acknowledged'::text, 'fixed'::text]))) not valid;

alter table "public"."bugs" validate constraint "bugs_status_check";

alter table "public"."courses" add constraint "courses_color_hex_check" CHECK ((color_hex ~ '^#[0-9A-Fa-f]{6}$'::text)) not valid;

alter table "public"."courses" validate constraint "courses_color_hex_check";

alter table "public"."rooms" add constraint "rooms_capacity_check" CHECK ((capacity > 0)) not valid;

alter table "public"."rooms" validate constraint "rooms_capacity_check";

alter table "public"."rooms" add constraint "rooms_name_key" UNIQUE using index "rooms_name_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.increment_bug_upvotes(bug_id integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.bugs
  SET upvotes = upvotes + 1
  WHERE id = bug_id AND status != 'fixed';
END;
$function$
;

grant delete on table "public"."bookings" to "anon";

grant insert on table "public"."bookings" to "anon";

grant references on table "public"."bookings" to "anon";

grant select on table "public"."bookings" to "anon";

grant trigger on table "public"."bookings" to "anon";

grant truncate on table "public"."bookings" to "anon";

grant update on table "public"."bookings" to "anon";

grant delete on table "public"."bookings" to "authenticated";

grant insert on table "public"."bookings" to "authenticated";

grant references on table "public"."bookings" to "authenticated";

grant select on table "public"."bookings" to "authenticated";

grant trigger on table "public"."bookings" to "authenticated";

grant truncate on table "public"."bookings" to "authenticated";

grant update on table "public"."bookings" to "authenticated";

grant delete on table "public"."bookings" to "service_role";

grant insert on table "public"."bookings" to "service_role";

grant references on table "public"."bookings" to "service_role";

grant select on table "public"."bookings" to "service_role";

grant trigger on table "public"."bookings" to "service_role";

grant truncate on table "public"."bookings" to "service_role";

grant update on table "public"."bookings" to "service_role";

grant delete on table "public"."bugs" to "anon";

grant insert on table "public"."bugs" to "anon";

grant references on table "public"."bugs" to "anon";

grant select on table "public"."bugs" to "anon";

grant trigger on table "public"."bugs" to "anon";

grant truncate on table "public"."bugs" to "anon";

grant update on table "public"."bugs" to "anon";

grant delete on table "public"."bugs" to "authenticated";

grant insert on table "public"."bugs" to "authenticated";

grant references on table "public"."bugs" to "authenticated";

grant select on table "public"."bugs" to "authenticated";

grant trigger on table "public"."bugs" to "authenticated";

grant truncate on table "public"."bugs" to "authenticated";

grant update on table "public"."bugs" to "authenticated";

grant delete on table "public"."bugs" to "service_role";

grant insert on table "public"."bugs" to "service_role";

grant references on table "public"."bugs" to "service_role";

grant select on table "public"."bugs" to "service_role";

grant trigger on table "public"."bugs" to "service_role";

grant truncate on table "public"."bugs" to "service_role";

grant update on table "public"."bugs" to "service_role";

grant delete on table "public"."courses" to "anon";

grant insert on table "public"."courses" to "anon";

grant references on table "public"."courses" to "anon";

grant select on table "public"."courses" to "anon";

grant trigger on table "public"."courses" to "anon";

grant truncate on table "public"."courses" to "anon";

grant update on table "public"."courses" to "anon";

grant delete on table "public"."courses" to "authenticated";

grant insert on table "public"."courses" to "authenticated";

grant references on table "public"."courses" to "authenticated";

grant select on table "public"."courses" to "authenticated";

grant trigger on table "public"."courses" to "authenticated";

grant truncate on table "public"."courses" to "authenticated";

grant update on table "public"."courses" to "authenticated";

grant delete on table "public"."courses" to "service_role";

grant insert on table "public"."courses" to "service_role";

grant references on table "public"."courses" to "service_role";

grant select on table "public"."courses" to "service_role";

grant trigger on table "public"."courses" to "service_role";

grant truncate on table "public"."courses" to "service_role";

grant update on table "public"."courses" to "service_role";

grant delete on table "public"."rooms" to "anon";

grant insert on table "public"."rooms" to "anon";

grant references on table "public"."rooms" to "anon";

grant select on table "public"."rooms" to "anon";

grant trigger on table "public"."rooms" to "anon";

grant truncate on table "public"."rooms" to "anon";

grant update on table "public"."rooms" to "anon";

grant delete on table "public"."rooms" to "authenticated";

grant insert on table "public"."rooms" to "authenticated";

grant references on table "public"."rooms" to "authenticated";

grant select on table "public"."rooms" to "authenticated";

grant trigger on table "public"."rooms" to "authenticated";

grant truncate on table "public"."rooms" to "authenticated";

grant update on table "public"."rooms" to "authenticated";

grant delete on table "public"."rooms" to "service_role";

grant insert on table "public"."rooms" to "service_role";

grant references on table "public"."rooms" to "service_role";

grant select on table "public"."rooms" to "service_role";

grant trigger on table "public"."rooms" to "service_role";

grant truncate on table "public"."rooms" to "service_role";

grant update on table "public"."rooms" to "service_role";

grant delete on table "public"."settings" to "anon";

grant insert on table "public"."settings" to "anon";

grant references on table "public"."settings" to "anon";

grant select on table "public"."settings" to "anon";

grant trigger on table "public"."settings" to "anon";

grant truncate on table "public"."settings" to "anon";

grant update on table "public"."settings" to "anon";

grant delete on table "public"."settings" to "authenticated";

grant insert on table "public"."settings" to "authenticated";

grant references on table "public"."settings" to "authenticated";

grant select on table "public"."settings" to "authenticated";

grant trigger on table "public"."settings" to "authenticated";

grant truncate on table "public"."settings" to "authenticated";

grant update on table "public"."settings" to "authenticated";

grant delete on table "public"."settings" to "service_role";

grant insert on table "public"."settings" to "service_role";

grant references on table "public"."settings" to "service_role";

grant select on table "public"."settings" to "service_role";

grant trigger on table "public"."settings" to "service_role";

grant truncate on table "public"."settings" to "service_role";

grant update on table "public"."settings" to "service_role";


  create policy "Bookings - full access for authenticated"
  on "public"."bookings"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE (p.id = auth.uid()))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE (p.id = auth.uid()))));



  create policy "Enable insert for all users"
  on "public"."bugs"
  as permissive
  for insert
  to public
with check (true);



  create policy "Enable read access for all users"
  on "public"."bugs"
  as permissive
  for select
  to public
using (true);



  create policy "Allow authenticated full select"
  on "public"."courses"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE (p.id = auth.uid()))));



  create policy "Allow settings edit only"
  on "public"."courses"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.settings = true)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.settings = true)))));



  create policy "Rooms - authenticated edit"
  on "public"."rooms"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE (p.id = auth.uid()))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE (p.id = auth.uid()))));



  create policy "Rooms - authenticated view"
  on "public"."rooms"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE (p.id = auth.uid()))));



  create policy "Rooms - settings full access"
  on "public"."rooms"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.settings = true)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.settings = true)))));



  create policy "Allow authenticated full select"
  on "public"."settings"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE (p.id = auth.uid()))));



  create policy "Allow settings edit only"
  on "public"."settings"
  as permissive
  for all
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.settings = true)))))
with check ((EXISTS ( SELECT 1
   FROM public.profiles p
  WHERE ((p.id = auth.uid()) AND (p.settings = true)))));



