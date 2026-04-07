
-- =============================================
-- ETAPA 1: Adicionar campos em accounts + criar tabelas de email
-- =============================================

-- 1.1 Novos campos na tabela accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS openai_api_key VARCHAR(500);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS sendgrid_api_key VARCHAR(500);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS sendgrid_from_email VARCHAR(255);
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS sendgrid_from_name VARCHAR(255);

-- 1.2 Enums para email
CREATE TYPE public.email_enrollment_status AS ENUM ('active', 'paused', 'completed', 'unsubscribed', 'bounced');
CREATE TYPE public.email_send_status AS ENUM ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'spam');

-- 1.3 Tabela: email_cadences
CREATE TABLE public.email_cadences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  target_stage_ids UUID[] DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_cadences_account ON public.email_cadences(account_id);

-- 1.4 Tabela: email_cadence_steps
CREATE TABLE public.email_cadence_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cadence_id UUID NOT NULL REFERENCES public.email_cadences(id) ON DELETE CASCADE,
  day_number INT NOT NULL DEFAULT 1,
  subject VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_cadence_steps_cadence ON public.email_cadence_steps(cadence_id);

-- 1.5 Tabela: email_templates
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  category VARCHAR(100),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_templates_account ON public.email_templates(account_id);

-- 1.6 Tabela: email_enrollments
CREATE TABLE public.email_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  cadence_id UUID NOT NULL REFERENCES public.email_cadences(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  current_step INT NOT NULL DEFAULT 0,
  status public.email_enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_send_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_enrollments_account ON public.email_enrollments(account_id);
CREATE INDEX idx_email_enrollments_cadence ON public.email_enrollments(cadence_id);
CREATE INDEX idx_email_enrollments_contact ON public.email_enrollments(contact_id);
CREATE INDEX idx_email_enrollments_status ON public.email_enrollments(status);

-- 1.7 Tabela: email_sends
CREATE TABLE public.email_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  enrollment_id UUID REFERENCES public.email_enrollments(id) ON DELETE SET NULL,
  step_id UUID REFERENCES public.email_cadence_steps(id) ON DELETE SET NULL,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  to_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  sendgrid_message_id VARCHAR(255),
  status public.email_send_status NOT NULL DEFAULT 'queued',
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_sends_account ON public.email_sends(account_id);
CREATE INDEX idx_email_sends_enrollment ON public.email_sends(enrollment_id);
CREATE INDEX idx_email_sends_contact ON public.email_sends(contact_id);
CREATE INDEX idx_email_sends_status ON public.email_sends(status);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.email_cadences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_cadence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;

-- email_cadences: members can view, admins can manage
CREATE POLICY "Account members can view email_cadences" ON public.email_cadences FOR SELECT USING (is_account_member(account_id));
CREATE POLICY "Admin can manage email_cadences" ON public.email_cadences FOR ALL USING (is_account_admin(account_id));
CREATE POLICY "Super admin can manage email_cadences" ON public.email_cadences FOR ALL USING (is_super_admin());

-- email_cadence_steps: via cadence join
CREATE POLICY "Account members can view email_cadence_steps" ON public.email_cadence_steps FOR SELECT USING (EXISTS (SELECT 1 FROM public.email_cadences c WHERE c.id = email_cadence_steps.cadence_id AND is_account_member(c.account_id)));
CREATE POLICY "Admin can manage email_cadence_steps" ON public.email_cadence_steps FOR ALL USING (EXISTS (SELECT 1 FROM public.email_cadences c WHERE c.id = email_cadence_steps.cadence_id AND is_account_admin(c.account_id)));
CREATE POLICY "Super admin can manage email_cadence_steps" ON public.email_cadence_steps FOR ALL USING (is_super_admin());

-- email_templates
CREATE POLICY "Account members can view email_templates" ON public.email_templates FOR SELECT USING (is_account_member(account_id));
CREATE POLICY "Admin can manage email_templates" ON public.email_templates FOR ALL USING (is_account_admin(account_id));
CREATE POLICY "Super admin can manage email_templates" ON public.email_templates FOR ALL USING (is_super_admin());

-- email_enrollments
CREATE POLICY "Account members can view email_enrollments" ON public.email_enrollments FOR SELECT USING (is_account_member(account_id));
CREATE POLICY "Admin can manage email_enrollments" ON public.email_enrollments FOR ALL USING (is_account_admin(account_id));
CREATE POLICY "Super admin can manage email_enrollments" ON public.email_enrollments FOR ALL USING (is_super_admin());

-- email_sends
CREATE POLICY "Account members can view email_sends" ON public.email_sends FOR SELECT USING (is_account_member(account_id));
CREATE POLICY "Super admin can manage email_sends" ON public.email_sends FOR ALL USING (is_super_admin());
