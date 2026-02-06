
CREATE TABLE public.resolution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  conversation_id integer NOT NULL,
  resolved_by text NOT NULL CHECK (resolved_by IN ('ai', 'human')),
  resolution_type text NOT NULL DEFAULT 'explicit',
  agent_id integer,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_resolution_logs_account_date
  ON public.resolution_logs(account_id, resolved_at);

CREATE UNIQUE INDEX idx_resolution_logs_no_duplicate
  ON public.resolution_logs(account_id, conversation_id, resolved_at);

ALTER TABLE public.resolution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view resolution logs"
  ON public.resolution_logs FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY "Super admin can manage resolution logs"
  ON public.resolution_logs FOR ALL
  USING (is_super_admin());
