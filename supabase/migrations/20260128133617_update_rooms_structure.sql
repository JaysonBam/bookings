alter table "public"."rooms" drop constraint "rooms_capacity_check";

alter table "public"."rooms" drop column "capacity";

alter table "public"."rooms" drop column "is_open";

alter table "public"."rooms" add column "max_people" smallint;

alter table "public"."rooms" add column "min_people" smallint;

alter table "public"."rooms" add constraint "rooms_max_people_check" CHECK ((max_people > 0)) not valid;

alter table "public"."rooms" validate constraint "rooms_max_people_check";

alter table "public"."rooms" add constraint "rooms_min_people_check" CHECK ((min_people > 0)) not valid;

alter table "public"."rooms" validate constraint "rooms_min_people_check";


