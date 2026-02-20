ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS first_resolved_at timestamptz DEFAULT NULL;