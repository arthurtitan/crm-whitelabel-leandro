-- ============================================
-- GLEPS CRM - Database Schema
-- Multi-tenant CRM with Chatwoot Integration
-- ============================================

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE public.app_role AS ENUM ('super_admin', 'admin', 'agent');
CREATE TYPE public.account_status AS ENUM ('active', 'paused', 'cancelled');
CREATE TYPE public.user_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE public.contact_origin AS ENUM ('whatsapp', 'instagram', 'site', 'indicacao', 'outro');
CREATE TYPE public.tag_type AS ENUM ('stage', 'operational');
CREATE TYPE public.sale_status AS ENUM ('pending', 'paid', 'refunded', 'partial_refund');
CREATE TYPE public.payment_method AS ENUM ('pix', 'boleto', 'debito', 'credito', 'dinheiro', 'convenio');

-- ============================================
-- ACCOUNTS TABLE (Multi-tenancy)
-- ============================================
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  timezone VARCHAR(100) DEFAULT 'America/Sao_Paulo',
  plano VARCHAR(50),
  status account_status DEFAULT 'active',
  limite_usuarios INT DEFAULT 10,
  
  -- Chatwoot Integration
  chatwoot_base_url VARCHAR(500),
  chatwoot_account_id VARCHAR(100),
  chatwoot_api_key VARCHAR(500),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PROFILES TABLE (User profiles linked to auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  status user_status DEFAULT 'active',
  
  -- Granular permissions for agents
  permissions TEXT[] DEFAULT ARRAY['dashboard'],
  
  -- Chatwoot Integration
  chatwoot_agent_id INT,
  
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- USER_ROLES TABLE (Role-based access control)
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- ============================================
-- FUNNELS TABLE
-- ============================================
CREATE TABLE public.funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, slug)
);

-- ============================================
-- TAGS TABLE (Kanban Stages)
-- ============================================
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  funnel_id UUID REFERENCES public.funnels(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  type tag_type NOT NULL,
  color VARCHAR(20) DEFAULT '#6366F1',
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  chatwoot_label_id INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, slug)
);

-- ============================================
-- CONTACTS TABLE (Leads)
-- ============================================
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  nome VARCHAR(255),
  telefone VARCHAR(50),
  email VARCHAR(255),
  origem contact_origin,
  chatwoot_contact_id INT,
  chatwoot_conversation_id INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- LEAD_TAGS TABLE (Contact-Tag Relationship)
-- ============================================
CREATE TABLE public.lead_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE NOT NULL,
  applied_by_id UUID REFERENCES auth.users(id),
  source VARCHAR(20) DEFAULT 'api',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contact_id, tag_id)
);

-- ============================================
-- TAG_HISTORY TABLE (Audit Log)
-- ============================================
CREATE TABLE public.tag_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  tag_id UUID REFERENCES public.tags(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source VARCHAR(20) DEFAULT 'api',
  tag_name VARCHAR(100),
  contact_nome VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PRODUCTS TABLE
-- ============================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  valor_padrao DECIMAL(10,2) NOT NULL,
  metodos_pagamento TEXT[] DEFAULT ARRAY['pix'],
  convenios_aceitos TEXT[] DEFAULT ARRAY[]::TEXT[],
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SALES TABLE
-- ============================================
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE RESTRICT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  status sale_status DEFAULT 'pending',
  metodo_pagamento payment_method NOT NULL,
  convenio_nome VARCHAR(255),
  responsavel_id UUID REFERENCES auth.users(id) NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT,
  refunded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SALE_ITEMS TABLE
-- ============================================
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL,
  quantidade INT DEFAULT 1,
  valor_unitario DECIMAL(10,2) NOT NULL,
  valor_total DECIMAL(10,2) NOT NULL,
  refunded BOOLEAN DEFAULT false,
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT
);

-- ============================================
-- LEAD_NOTES TABLE
-- ============================================
CREATE TABLE public.lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES auth.users(id) NOT NULL,
  author_name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- EVENTS TABLE (Audit/Event Sourcing)
-- ============================================
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  channel VARCHAR(50),
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- CALENDAR_EVENTS TABLE
-- ============================================
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  type VARCHAR(50) DEFAULT 'appointment',
  source VARCHAR(50) DEFAULT 'crm',
  status VARCHAR(50) DEFAULT 'scheduled',
  location VARCHAR(500),
  meeting_link VARCHAR(500),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  google_event_id VARCHAR(255),
  google_calendar_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_profiles_account ON public.profiles(account_id);
CREATE INDEX idx_profiles_user ON public.profiles(user_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_contacts_account ON public.contacts(account_id);
CREATE INDEX idx_tags_account ON public.tags(account_id);
CREATE INDEX idx_tags_funnel ON public.tags(funnel_id);
CREATE INDEX idx_sales_account ON public.sales(account_id);
CREATE INDEX idx_sales_contact ON public.sales(contact_id);
CREATE INDEX idx_events_account ON public.events(account_id);
CREATE INDEX idx_events_type ON public.events(event_type);

-- ============================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================

-- Check if user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
$$;

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role = _role
  )
$$;

-- Get user's account_id
CREATE OR REPLACE FUNCTION public.get_user_account_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id FROM public.profiles WHERE user_id = _user_id
$$;

-- Check if user is admin of an account
CREATE OR REPLACE FUNCTION public.is_account_admin(_account_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
    AND p.account_id = _account_id
  )
$$;

-- Check if user is member of an account
CREATE OR REPLACE FUNCTION public.is_account_member(_account_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
    AND account_id = _account_id
  )
$$;

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tag_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES: ACCOUNTS
-- ============================================
CREATE POLICY "Super admin can manage accounts"
ON public.accounts FOR ALL
USING (public.is_super_admin());

CREATE POLICY "Account members can view their account"
ON public.accounts FOR SELECT
USING (public.is_account_member(id));

-- ============================================
-- RLS POLICIES: PROFILES
-- ============================================
CREATE POLICY "Super admin can manage all profiles"
ON public.profiles FOR ALL
USING (public.is_super_admin());

CREATE POLICY "Admin can manage account profiles"
ON public.profiles FOR ALL
USING (public.is_account_admin(account_id));

CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (user_id = auth.uid());

-- ============================================
-- RLS POLICIES: USER_ROLES
-- ============================================
CREATE POLICY "Super admin can manage all roles"
ON public.user_roles FOR ALL
USING (public.is_super_admin());

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

-- ============================================
-- RLS POLICIES: FUNNELS
-- ============================================
CREATE POLICY "Super admin can manage funnels"
ON public.funnels FOR ALL
USING (public.is_super_admin());

CREATE POLICY "Admin can manage account funnels"
ON public.funnels FOR ALL
USING (public.is_account_admin(account_id));

CREATE POLICY "Account members can view funnels"
ON public.funnels FOR SELECT
USING (public.is_account_member(account_id));

-- ============================================
-- RLS POLICIES: TAGS
-- ============================================
CREATE POLICY "Super admin can manage tags"
ON public.tags FOR ALL
USING (public.is_super_admin());

CREATE POLICY "Admin can manage account tags"
ON public.tags FOR ALL
USING (public.is_account_admin(account_id));

CREATE POLICY "Account members can view tags"
ON public.tags FOR SELECT
USING (public.is_account_member(account_id));

-- ============================================
-- RLS POLICIES: CONTACTS
-- ============================================
CREATE POLICY "Super admin can manage contacts"
ON public.contacts FOR ALL
USING (public.is_super_admin());

CREATE POLICY "Admin can manage account contacts"
ON public.contacts FOR ALL
USING (public.is_account_admin(account_id));

CREATE POLICY "Account members can view/update contacts"
ON public.contacts FOR SELECT
USING (public.is_account_member(account_id));

CREATE POLICY "Account members can insert contacts"
ON public.contacts FOR INSERT
WITH CHECK (public.is_account_member(account_id));

CREATE POLICY "Account members can update contacts"
ON public.contacts FOR UPDATE
USING (public.is_account_member(account_id));

-- ============================================
-- RLS POLICIES: LEAD_TAGS
-- ============================================
CREATE POLICY "Super admin can manage lead_tags"
ON public.lead_tags FOR ALL
USING (public.is_super_admin());

CREATE POLICY "Account members can manage lead_tags"
ON public.lead_tags FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_id
    AND public.is_account_member(c.account_id)
  )
);

-- ============================================
-- RLS POLICIES: TAG_HISTORY
-- ============================================
CREATE POLICY "Super admin can view all history"
ON public.tag_history FOR SELECT
USING (public.is_super_admin());

CREATE POLICY "Account members can view/insert history"
ON public.tag_history FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_id
    AND public.is_account_member(c.account_id)
  )
);

-- ============================================
-- RLS POLICIES: PRODUCTS
-- ============================================
CREATE POLICY "Super admin can manage products"
ON public.products FOR ALL
USING (public.is_super_admin());

CREATE POLICY "Admin can manage account products"
ON public.products FOR ALL
USING (public.is_account_admin(account_id));

CREATE POLICY "Account members can view products"
ON public.products FOR SELECT
USING (public.is_account_member(account_id));

-- ============================================
-- RLS POLICIES: SALES
-- ============================================
CREATE POLICY "Super admin can manage sales"
ON public.sales FOR ALL
USING (public.is_super_admin());

CREATE POLICY "Admin can manage account sales"
ON public.sales FOR ALL
USING (public.is_account_admin(account_id));

CREATE POLICY "Account members can view/insert sales"
ON public.sales FOR SELECT
USING (public.is_account_member(account_id));

CREATE POLICY "Account members can insert sales"
ON public.sales FOR INSERT
WITH CHECK (public.is_account_member(account_id));

-- ============================================
-- RLS POLICIES: SALE_ITEMS
-- ============================================
CREATE POLICY "Super admin can manage sale_items"
ON public.sale_items FOR ALL
USING (public.is_super_admin());

CREATE POLICY "Account members can manage sale_items"
ON public.sale_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_id
    AND public.is_account_member(s.account_id)
  )
);

-- ============================================
-- RLS POLICIES: LEAD_NOTES
-- ============================================
CREATE POLICY "Super admin can manage notes"
ON public.lead_notes FOR ALL
USING (public.is_super_admin());

CREATE POLICY "Account members can manage notes"
ON public.lead_notes FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = contact_id
    AND public.is_account_member(c.account_id)
  )
);

-- ============================================
-- RLS POLICIES: EVENTS
-- ============================================
CREATE POLICY "Super admin can manage events"
ON public.events FOR ALL
USING (public.is_super_admin());

CREATE POLICY "Account members can view/insert events"
ON public.events FOR SELECT
USING (public.is_account_member(account_id));

CREATE POLICY "Account members can insert events"
ON public.events FOR INSERT
WITH CHECK (public.is_account_member(account_id));

-- ============================================
-- RLS POLICIES: CALENDAR_EVENTS
-- ============================================
CREATE POLICY "Super admin can manage calendar_events"
ON public.calendar_events FOR ALL
USING (public.is_super_admin());

CREATE POLICY "Admin can manage account calendar_events"
ON public.calendar_events FOR ALL
USING (public.is_account_admin(account_id));

CREATE POLICY "Account members can view/manage calendar"
ON public.calendar_events FOR SELECT
USING (public.is_account_member(account_id));

CREATE POLICY "Account members can insert calendar_events"
ON public.calendar_events FOR INSERT
WITH CHECK (public.is_account_member(account_id));

CREATE POLICY "Account members can update calendar_events"
ON public.calendar_events FOR UPDATE
USING (public.is_account_member(account_id));

-- ============================================
-- TRIGGER: Auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- TRIGGER: Update updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_funnels_updated_at
  BEFORE UPDATE ON public.funnels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();