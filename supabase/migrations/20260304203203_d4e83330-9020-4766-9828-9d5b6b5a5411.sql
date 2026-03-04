ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS google_client_id VARCHAR(500);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS google_client_secret VARCHAR(500);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS google_redirect_uri VARCHAR(500);