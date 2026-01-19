-- allow = in gist indexes
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- recreate bookings (start_time/end_time are TIME and booking_day is DATE)
CREATE TABLE public.bookings (
  id SERIAL PRIMARY KEY,
  room_id INT NOT NULL
    REFERENCES public.rooms(id) ON DELETE CASCADE,
  course_id INT
    REFERENCES public.courses(id) ON DELETE SET NULL,
  course_name TEXT,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  booking_day DATE NOT NULL,
  student_numbers TEXT,
  borrowed_items TEXT[] DEFAULT '{}',
  booked_by TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('Active', 'Reserved', 'Ended')) DEFAULT 'Reserved',

  CONSTRAINT bookings_time_order CHECK (
    end_time > start_time
  ),

  -- no overlapping bookings allow
  EXCLUDE USING gist (
    room_id WITH =,
    booking_day WITH =,
    tsrange(
      (booking_day + start_time)::timestamp,
      (booking_day + end_time)::timestamp
    ) WITH &&
  )
);

-- 1. Enable RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;

-- 2. FULL ACCESS for authenticated users
CREATE POLICY "Bookings - full access for authenticated"
ON bookings
FOR ALL
TO authenticated
USING (
	-- allow only if the corresponding user row exists
	EXISTS(
		SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
	)
)
WITH CHECK (
	EXISTS(
		SELECT 1 FROM public.profiles p WHERE p.id = auth.uid()
	)
);
