
-- Table to track API usage per account for cost control
CREATE TABLE public.api_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  endpoint varchar NOT NULL DEFAULT 'maps-data',
  requests_count integer NOT NULL DEFAULT 1,
  month varchar NOT NULL, -- format: YYYY-MM
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast monthly lookups
CREATE INDEX idx_api_usage_account_month ON public.api_usage_logs(account_id, month);

-- Add monthly extraction limit to accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS monthly_extraction_limit integer DEFAULT 500;

-- Enable RLS
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can view all usage logs
CREATE POLICY "Super admin can manage api_usage_logs"
  ON public.api_usage_logs FOR ALL
  TO authenticated
  USING (public.is_super_admin());

-- Account members can view their own usage
CREATE POLICY "Account members can view own usage"
  ON public.api_usage_logs FOR SELECT
  TO authenticated
  USING (public.is_account_member(account_id));

-- Service role inserts (edge functions use service role)
CREATE POLICY "Service role can insert usage"
  ON public.api_usage_logs FOR INSERT
  TO service_role
  WITH CHECK (true);
