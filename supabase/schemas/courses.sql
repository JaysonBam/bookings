CREATE TABLE public.courses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  color_hex CHAR(7) CHECK (color_hex ~ '^#[0-9A-Fa-f]{6}$')
);

-- 1. Enable RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses FORCE ROW LEVEL SECURITY;

-- 2. Policy for SELECT (VIEW) Access
CREATE POLICY "Allow authenticated full select"
ON courses
FOR SELECT
TO authenticated
USING (
    -- only if the user row exists
    EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid())
);

-- 4. Policy for INSERT, UPDATE, DELETE (WRITE) Access
CREATE POLICY "Allow settings edit only"
ON courses
FOR ALL
TO authenticated
USING (
    EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.settings = true)
)
WITH CHECK (
    EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.settings = true)
);
