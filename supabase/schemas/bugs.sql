-- Create the bugs table
CREATE TABLE public.bugs (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  description TEXT NOT NULL,
  reporter_name TEXT NOT NULL,
  upvotes INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('new', 'acknowledged', 'fixed')) DEFAULT 'new',
  admin_update TEXT
);

-- Function to increment upvotes safely
CREATE OR REPLACE FUNCTION increment_bug_upvotes(bug_id INT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.bugs
  SET upvotes = upvotes + 1
  WHERE id = bug_id AND status != 'fixed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.bugs ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read bugs
CREATE POLICY "Enable read access for all users" ON public.bugs
  FOR SELECT USING (true);

-- Allow everyone (or authenticated) to insert bugs
-- Assuming we want any user to report bugs
CREATE POLICY "Enable insert for all users" ON public.bugs
  FOR INSERT WITH CHECK (true);

-- Allow updates only via the RPC function (which bypasses RLS if SECURITY DEFINER)
-- But if we want to allow admin updates from backend, we might need a policy for that.
-- Since the user said "i will make updates and status from backend", 
-- we assume the backend uses the service role key which bypasses RLS.
-- So we don't need an UPDATE policy for public users, effectively disabling frontend updates 
-- except via the RPC function.
