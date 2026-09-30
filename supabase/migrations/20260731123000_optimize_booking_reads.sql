-- Support the two hottest booking reads without changing booking behaviour:
-- the daily grid and bulk-group edits/reconciliation.
create index if not exists bookings_booking_day_start_time_id_idx
  on public.bookings (booking_day, start_time, id);

create index if not exists bookings_bulk_booking_id_day_time_idx
  on public.bookings (bulk_booking_id, booking_day, start_time)
  where bulk_booking_id is not null;
