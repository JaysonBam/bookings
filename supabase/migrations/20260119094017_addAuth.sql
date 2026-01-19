alter table "public"."profiles" add column "analytics" boolean not null default false;

alter table "public"."profiles" add column "authorisation" boolean not null default false;

alter table "public"."profiles" add column "settings" boolean not null default false;


