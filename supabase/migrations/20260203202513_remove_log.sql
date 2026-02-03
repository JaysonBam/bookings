drop policy "Enable insert for authenticated users only" on "public"."logs";

drop policy "Enable select for authenticated users only" on "public"."logs";

revoke delete on table "public"."logs" from "anon";

revoke insert on table "public"."logs" from "anon";

revoke references on table "public"."logs" from "anon";

revoke select on table "public"."logs" from "anon";

revoke trigger on table "public"."logs" from "anon";

revoke truncate on table "public"."logs" from "anon";

revoke update on table "public"."logs" from "anon";

revoke delete on table "public"."logs" from "authenticated";

revoke insert on table "public"."logs" from "authenticated";

revoke references on table "public"."logs" from "authenticated";

revoke select on table "public"."logs" from "authenticated";

revoke trigger on table "public"."logs" from "authenticated";

revoke truncate on table "public"."logs" from "authenticated";

revoke update on table "public"."logs" from "authenticated";

revoke delete on table "public"."logs" from "service_role";

revoke insert on table "public"."logs" from "service_role";

revoke references on table "public"."logs" from "service_role";

revoke select on table "public"."logs" from "service_role";

revoke trigger on table "public"."logs" from "service_role";

revoke truncate on table "public"."logs" from "service_role";

revoke update on table "public"."logs" from "service_role";

alter table "public"."logs" drop constraint "logs_pkey";

drop index if exists "public"."logs_pkey";

drop table "public"."logs";


