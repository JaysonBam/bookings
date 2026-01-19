CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1. Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings FORCE ROW LEVEL SECURITY;


-- 2. Policy for SELECT (VIEW) Access
CREATE POLICY "Allow authenticated full select"
ON settings
FOR SELECT
TO authenticated
USING (
    EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid())
);


-- 4. Policy for INSERT, UPDATE, DELETE (WRITE) Access
CREATE POLICY "Allow settings edit only"
ON settings
FOR ALL
TO authenticated
USING (
    EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.settings = true)
)
WITH CHECK (
    EXISTS(SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.settings = true)
);
