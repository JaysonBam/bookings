alter table "public"."logs" drop column "booking_id";
alter table "public"."logs" drop column "room_id";
alter table "public"."logs" add column "booking_id" integer;
alter table "public"."logs" add column "room_id" integer;


