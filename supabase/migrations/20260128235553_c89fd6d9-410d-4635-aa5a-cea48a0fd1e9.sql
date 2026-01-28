-- Criar função update_updated_at_column se não existir
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Tabela para armazenar tokens OAuth do Google Calendar
CREATE TABLE public.google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type VARCHAR(50) DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  calendar_id VARCHAR(255) DEFAULT 'primary',
  connected_email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id)
);

-- Enable RLS
ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Account admins can manage google tokens"
  ON public.google_calendar_tokens
  FOR ALL
  USING (is_account_admin(account_id));

CREATE POLICY "Super admin can manage all google tokens"
  ON public.google_calendar_tokens
  FOR ALL
  USING (is_super_admin());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_google_calendar_tokens_updated_at
  BEFORE UPDATE ON public.google_calendar_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();