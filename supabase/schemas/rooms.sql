CREATE TABLE public.rooms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  capacity SMALLINT CHECK (capacity > 0),
  is_open BOOLEAN DEFAULT TRUE,
  is_available BOOLEAN DEFAULT TRUE,
  dynamic_labels TEXT[] DEFAULT '{}',
  borrowable_items TEXT[] DEFAULT '{}'      
);
-- 1. Enable RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms FORCE ROW LEVEL SECURITY;

-- 2. SELECT access for ALL authenticated users
CREATE POLICY "Rooms - authenticated view"
ON rooms
FOR SELECT
TO authenticated
USING (
    EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid())
);

-- 4. UPDATE access for ALL authenticated users
CREATE POLICY "Rooms - authenticated edit"
ON rooms
FOR UPDATE
TO authenticated
USING (
    EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid())
)
WITH CHECK (
    EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid())
);

-- 5. INSERT, UPDATE, DELETE access ONLY for users with settings = true
CREATE POLICY "Rooms - settings full access"
ON rooms
FOR ALL
TO authenticated
USING (
    EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.settings = true)
)
WITH CHECK (
    EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.settings = true)
);
