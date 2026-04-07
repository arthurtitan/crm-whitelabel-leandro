
-- Table to track dispatch batches
CREATE TABLE public.dispatch_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  keyword text,
  location text,
  total_contacts integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running', -- running, completed, failed
  delay_seconds integer NOT NULL DEFAULT 30,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table to track individual dispatch logs per contact
CREATE TABLE public.dispatch_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.dispatch_batches(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  phone text NOT NULL,
  inbox_id integer NOT NULL,
  inbox_name text,
  status text NOT NULL DEFAULT 'pending', -- pending, sent, failed
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_dispatch_logs_batch ON public.dispatch_logs(batch_id);
CREATE INDEX idx_dispatch_batches_account ON public.dispatch_batches(account_id);

-- Enable RLS
ALTER TABLE public.dispatch_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_logs ENABLE ROW LEVEL SECURITY;

-- RLS: account members can view their own batches
CREATE POLICY "Account members can view own batches"
  ON public.dispatch_batches FOR SELECT
  TO authenticated
  USING (public.is_account_member(account_id));

CREATE POLICY "Super admin can manage dispatch_batches"
  ON public.dispatch_batches FOR ALL
  TO authenticated
  USING (public.is_super_admin());

-- Service role insert for edge functions
CREATE POLICY "Service role can manage dispatch_batches"
  ON public.dispatch_batches FOR ALL
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can manage dispatch_logs"
  ON public.dispatch_logs FOR ALL
  TO service_role
  WITH CHECK (true);

-- RLS: account members can view logs via batch
CREATE POLICY "Account members can view own dispatch_logs"
  ON public.dispatch_logs FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dispatch_batches b
    WHERE b.id = dispatch_logs.batch_id
    AND public.is_account_member(b.account_id)
  ));

CREATE POLICY "Super admin can manage dispatch_logs"
  ON public.dispatch_logs FOR ALL
  TO authenticated
  USING (public.is_super_admin());

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_logs;
