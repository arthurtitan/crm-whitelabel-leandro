# Especificação Completa do Sistema CRM GLEPS

> Documento de referência para desenvolvimento do Backend, Banco de Dados e APIs.
> 
> **Versão:** 1.0.0  
> **Última atualização:** 2026-01-26  
> **Status:** Frontend pronto para integração

---

## Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Sistema de Autenticação](#2-sistema-de-autenticação)
3. [Controle de Acesso (RBAC)](#3-controle-de-acesso-rbac)
4. [Esquema do Banco de Dados](#4-esquema-do-banco-de-dados)
5. [Especificação de Endpoints](#5-especificação-de-endpoints)
6. [Mapeamento de Páginas](#6-mapeamento-de-páginas)
7. [Integrações Externas](#7-integrações-externas)
8. [Eventos de Auditoria](#8-eventos-de-auditoria)
9. [Regras de Negócio](#9-regras-de-negócio)
10. [Guia de Implementação](#10-guia-de-implementação)

---

## 1. Visão Geral da Arquitetura

### 1.1 Stack do Frontend
| Camada | Tecnologia | Versão |
|--------|------------|--------|
| Framework | React + Vite | 18.3.1 |
| Linguagem | TypeScript | 5.x |
| Estilização | Tailwind CSS + shadcn/ui | 3.x |
| Roteamento | React Router DOM | 6.30.1 |
| Data Fetching | TanStack React Query | 5.83.0 |
| Gráficos | Recharts | 2.15.4 |
| Formulários | React Hook Form + Zod | 7.61.1 |
| Data/Hora | date-fns | 3.6.0 |
| Notificações | Sonner | 1.7.4 |

### 1.2 Arquitetura de Camadas (Frontend)

```
┌─────────────────────────────────────────────────────────────┐
│                    COMPONENTES (UI)                         │
│  pages/ → layouts/ → components/                            │
├─────────────────────────────────────────────────────────────┤
│                    HOOKS (React Query)                      │
│  hooks/queries/ → hooks/mutations/                          │
├─────────────────────────────────────────────────────────────┤
│                    SERVICES (HTTP)                          │
│  services/*.service.ts                                      │
├─────────────────────────────────────────────────────────────┤
│                    API CLIENT                               │
│  api/client.ts → api/endpoints.ts                           │
├─────────────────────────────────────────────────────────────┤
│                    BACKEND (A Desenvolver)                  │
│  REST API → PostgreSQL                                      │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 Estrutura de Pastas do Frontend

```
src/
├── api/                      # Camada HTTP
│   ├── client.ts             # Fetch wrapper com interceptors JWT
│   ├── endpoints.ts          # Constantes de URLs
│   ├── types.ts              # Tipos request/response
│   └── index.ts              # Exports
│
├── config/                   # Configurações centralizadas
│   ├── api.config.ts         # URLs base por ambiente
│   ├── routes.config.ts      # Definição de rotas
│   └── permissions.config.ts # RBAC
│
├── services/                 # Serviços por domínio
│   ├── auth.service.ts       # Autenticação
│   ├── accounts.service.ts   # Contas (Super Admin)
│   ├── users.service.ts      # Usuários
│   ├── contacts.service.ts   # Leads/Contatos
│   ├── sales.service.ts      # Vendas
│   ├── products.service.ts   # Produtos
│   ├── tags.service.ts       # Tags/Etapas
│   └── index.ts              # Exports
│
├── components/               # Componentes por módulo
│   ├── auth/                 # ProtectedRoute
│   ├── calendar/             # Agenda
│   ├── chatwoot/             # Integração Chatwoot
│   ├── dashboard/            # KPIs, gráficos
│   ├── finance/              # Vendas, estornos
│   ├── insights/             # Análises
│   ├── kanban/               # Cards, etapas
│   ├── leads/                # Ficha do cliente
│   ├── products/             # CRUD produtos
│   └── ui/                   # shadcn/ui
│
├── contexts/                 # React Contexts
│   ├── AuthContext.tsx       # Estado de autenticação
│   ├── FinanceContext.tsx    # Estado financeiro
│   ├── TagContext.tsx        # Estado de tags
│   ├── ProductContext.tsx    # Estado de produtos
│   └── CalendarContext.tsx   # Estado de calendário
│
├── layouts/                  # Layouts de página
│   ├── AdminLayout.tsx       # Layout Admin
│   └── SuperAdminLayout.tsx  # Layout Super Admin
│
├── pages/                    # Páginas
│   ├── LoginPage.tsx         # Login
│   ├── NotFound.tsx          # 404
│   ├── UnauthorizedPage.tsx  # 403
│   ├── admin/                # 9 páginas Admin
│   └── super-admin/          # 4 páginas Super Admin
│
├── types/                    # TypeScript types
│   ├── crm.ts                # Tipos de negócio
│   ├── chatwoot-metrics.ts   # Tipos Chatwoot
│   └── calendar.ts           # Tipos calendário
│
└── mocks/data/               # Dados mock (desenvolvimento)
    └── mockData.ts           # Dados simulados
```

---

## 2. Sistema de Autenticação

### 2.1 Fluxo de Login

```
┌─────────┐    POST /auth/login     ┌─────────┐
│ Cliente │ ──────────────────────► │ Backend │
│         │ { email, password }     │         │
└─────────┘                         └────┬────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │ Validar credenciais │
                              │ Verificar status    │
                              │ user.status         │
                              │ account.status      │
                              └──────────┬──────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    ▼                    ▼                    ▼
              user.status         user.status           account.status
              != 'active'         == 'suspended'        == 'paused'
                    │                    │                    │
                    ▼                    ▼                    ▼
              401 "Usuário        401 "Usuário         401 "Conta
              inativo"            suspenso"            pausada"
                                         
                                         │ (sucesso)
                                         ▼
                              ┌─────────────────────┐
                              │ Gerar JWT token     │
                              │ + refresh token     │
                              │ Registrar evento    │
                              │ auth.login.success  │
                              └──────────┬──────────┘
                                         │
                                         ▼
                              { user, account, token,
                                refreshToken, expiresAt }
```

### 2.2 Estrutura do JWT Token

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "sub": "user-uuid",
    "email": "user@email.com",
    "role": "admin",
    "accountId": "account-uuid",
    "permissions": ["dashboard", "kanban", "sales"],
    "iat": 1706000000,
    "exp": 1706003600
  }
}
```

### 2.3 Endpoints de Autenticação

| Método | Endpoint | Request | Response | Descrição |
|--------|----------|---------|----------|-----------|
| POST | `/auth/login` | `{ email, password }` | `{ user, account, token, refreshToken, expiresAt }` | Login |
| POST | `/auth/logout` | - | `{ success: true }` | Logout (invalida token) |
| POST | `/auth/refresh` | `{ refreshToken }` | `{ token, expiresAt }` | Renovar token |
| GET | `/auth/me` | - | `{ user, account }` | Dados do usuário logado |
| POST | `/auth/verify-password` | `{ password }` | `{ valid: boolean }` | Validar senha (ações críticas) |

### 2.4 Credenciais de Teste (Mock)

| Email | Senha | Role | Status |
|-------|-------|------|--------|
| `superadmin@sistema.com` | `Admin@123` | super_admin | active |
| `carlos@clinicavidaplena.com` | `Admin@123` | admin | active |
| `ana@clinicavidaplena.com` | `Agent@123` | agent | active |
| `pedro@clinicavidaplena.com` | `Agent@123` | agent | active |
| `roberto@lojaexpress.com` | `Admin@123` | admin | suspended (conta pausada) |

---

## 3. Controle de Acesso (RBAC)

### 3.1 Hierarquia de Roles

```
┌─────────────────────────────────────────────────────────────┐
│                      SUPER_ADMIN                            │
│  • Acesso a todas as contas                                 │
│  • Criar/pausar/excluir contas                              │
│  • Impersonar qualquer usuário                              │
│  • Exclusão permanente de dados                             │
├─────────────────────────────────────────────────────────────┤
│                         ADMIN                               │
│  • Acesso total à própria conta                             │
│  • Gerenciar usuários da conta                              │
│  • Ver todos os dados da conta                              │
│  • Configurar integrações                                   │
├─────────────────────────────────────────────────────────────┤
│                         AGENT                               │
│  • Acesso conforme permissões granulares                    │
│  • Dashboard obrigatório                                    │
│  • Dados próprios (filtro automático)                       │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Permissões Granulares (Agents)

#### Páginas Disponíveis

| Permissão | Rota | Obrigatória | Descrição |
|-----------|------|-------------|-----------|
| `dashboard` | `/admin` | ✅ Sim | Dashboard de Atendimento |
| `kanban` | `/admin/kanban` | Não | Kanban de Leads |
| `leads` | `/admin/leads` | Não | Gestão de Leads |
| `agenda` | `/admin/agenda` | Não | Calendário/Agenda |
| `sales` | `/admin/sales` | Não | Gestão de Vendas |
| `finance` | `/admin/finance` | Não | Dashboard Financeiro |
| `products` | `/admin/products` | Não | Produtos/Procedimentos |
| `events` | `/admin/events` | Não | Controle de Ponto |
| `insights` | `/admin/insights` | Não | Análises e Insights |

#### Ações Especiais

| Permissão | Descrição | Requisito Adicional |
|-----------|-----------|---------------------|
| `refunds` | Realizar estornos de vendas | Senha + Justificativa |

### 3.3 Matriz de Acesso

| Funcionalidade | Super Admin | Admin | Agent |
|----------------|:-----------:|:-----:|:-----:|
| Ver todas as contas | ✅ | ❌ | ❌ |
| Criar conta | ✅ | ❌ | ❌ |
| Pausar/Excluir conta | ✅ | ❌ | ❌ |
| Ver usuários de qualquer conta | ✅ | ❌ | ❌ |
| Impersonar usuário | ✅ | ❌ | ❌ |
| Ver usuários da conta | ✅ | ✅ | ❌ |
| Criar usuário na conta | ✅ | ✅ | ❌ |
| Ver dados da conta | ✅ | ✅ | Por permissão |
| Filtrar por agente | ✅ | ✅ | ❌ (vê só próprios) |
| Estornar vendas | ✅ | Com permissão | Com permissão |
| Excluir dados | ✅ (permanente) | Soft delete | ❌ |

---

## 4. Esquema do Banco de Dados

### 4.1 Diagrama ERD

```
┌─────────────────┐       ┌─────────────────┐
│    accounts     │       │     users       │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │◄──────│ account_id (FK) │
│ nome            │       │ id (PK)         │
│ timezone        │       │ nome            │
│ plano           │       │ email (UNIQUE)  │
│ status          │       │ password_hash   │
│ limite_usuarios │       │ role            │
│ chatwoot_*      │       │ status          │
│ created_at      │       │ permissions[]   │
│ updated_at      │       │ chatwoot_agent_id│
└─────────────────┘       │ last_login_at   │
                          │ created_at      │
                          │ updated_at      │
                          └────────┬────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────┐         ┌───────────────┐          ┌───────────────┐
│   contacts    │         │    sales      │          │   products    │
├───────────────┤         ├───────────────┤          ├───────────────┤
│ id (PK)       │◄────────│ contact_id(FK)│          │ id (PK)       │
│ account_id(FK)│         │ id (PK)       │──────────│ account_id(FK)│
│ nome          │         │ account_id(FK)│          │ nome          │
│ telefone      │         │ valor         │          │ valor_padrao  │
│ email         │         │ status        │          │ metodos_pag[] │
│ origem        │         │ metodo_pag    │          │ convenios[]   │
│ created_at    │         │ responsavel_id│          │ ativo         │
│ updated_at    │         │ is_recurring  │          │ created_at    │
└───────┬───────┘         │ created_at    │          │ updated_at    │
        │                 │ paid_at       │          └───────────────┘
        │                 │ refunded_at   │                  │
        │                 └───────┬───────┘                  │
        │                         │                          │
        │                         ▼                          │
        │                 ┌───────────────┐                  │
        │                 │  sale_items   │◄─────────────────┘
        │                 ├───────────────┤
        │                 │ id (PK)       │
        │                 │ sale_id (FK)  │
        │                 │ product_id(FK)│
        │                 │ quantidade    │
        │                 │ valor_unitario│
        │                 │ valor_total   │
        │                 │ refunded      │
        │                 │ refund_reason │
        │                 └───────────────┘
        │
        ├─────────────────────────────────────────────────────┐
        │                                                     │
        ▼                                                     ▼
┌───────────────┐    ┌───────────────┐              ┌───────────────┐
│  lead_tags    │    │  lead_notes   │              │     tags      │
├───────────────┤    ├───────────────┤              ├───────────────┤
│ id (PK)       │    │ id (PK)       │              │ id (PK)       │
│ contact_id(FK)│    │ contact_id(FK)│              │ account_id(FK)│
│ tag_id (FK)   │────│ author_id(FK) │              │ funnel_id(FK) │
│ applied_by_*  │    │ content       │              │ name          │
│ source        │    │ created_at    │              │ slug          │
│ created_at    │    └───────────────┘              │ type          │
└───────────────┘                                   │ color         │
        │                                           │ ordem         │
        │                                           │ ativo         │
        ▼                                           │ created_at    │
┌───────────────┐                                   └───────────────┘
│  tag_history  │
├───────────────┤              ┌───────────────┐
│ id (PK)       │              │    events     │
│ contact_id(FK)│              ├───────────────┤
│ tag_id (FK)   │              │ id (PK)       │
│ action        │              │ account_id(FK)│
│ actor_type    │              │ event_type    │
│ actor_id      │              │ actor_type    │
│ source        │              │ actor_id      │
│ reason        │              │ entity_type   │
│ created_at    │              │ entity_id     │
└───────────────┘              │ channel       │
                               │ payload (JSON)│
                               │ created_at    │
                               └───────────────┘
```

### 4.2 Definição das Tabelas

#### 4.2.1 accounts (Contas/Multi-tenant)

```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  timezone VARCHAR(100) NOT NULL DEFAULT 'America/Sao_Paulo',
  plano VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'paused', 'cancelled')),
  limite_usuarios INT NOT NULL DEFAULT 10,
  
  -- Integração Chatwoot
  chatwoot_base_url VARCHAR(500),
  chatwoot_account_id VARCHAR(100),
  chatwoot_api_key VARCHAR(500),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_accounts_status ON accounts(status);
```

#### 4.2.2 users (Usuários)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  
  role VARCHAR(20) NOT NULL 
    CHECK (role IN ('super_admin', 'admin', 'agent')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' 
    CHECK (status IN ('active', 'inactive', 'suspended')),
  
  -- Permissões granulares (apenas para agents)
  permissions TEXT[] DEFAULT ARRAY['dashboard'],
  
  -- Integração Chatwoot
  chatwoot_agent_id INT,
  
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Super admin não tem account_id
  CONSTRAINT check_account_id CHECK (
    (role = 'super_admin' AND account_id IS NULL) OR
    (role != 'super_admin' AND account_id IS NOT NULL)
  )
);

CREATE INDEX idx_users_account ON users(account_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

#### 4.2.3 contacts (Leads/Contatos)

```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  
  nome VARCHAR(255),
  telefone VARCHAR(50),
  email VARCHAR(255),
  
  origem VARCHAR(50) 
    CHECK (origem IN ('whatsapp', 'instagram', 'site', 'indicacao', 'outro')),
  
  -- Campos do Chatwoot
  chatwoot_contact_id INT,
  chatwoot_conversation_id INT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contacts_account ON contacts(account_id);
CREATE INDEX idx_contacts_telefone ON contacts(telefone);
CREATE INDEX idx_contacts_email ON contacts(email);
```

#### 4.2.4 funnels (Funis)

```sql
CREATE TABLE funnels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(account_id, slug)
);

CREATE INDEX idx_funnels_account ON funnels(account_id);
```

#### 4.2.5 tags (Etiquetas/Etapas Kanban)

```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  funnel_id UUID NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  
  type VARCHAR(20) NOT NULL 
    CHECK (type IN ('stage', 'operational')),
  
  color VARCHAR(20) NOT NULL DEFAULT '#6366F1',
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  
  -- Sincronização Chatwoot
  chatwoot_label_id INT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(account_id, slug)
);

CREATE INDEX idx_tags_account ON tags(account_id);
CREATE INDEX idx_tags_funnel ON tags(funnel_id);
CREATE INDEX idx_tags_type ON tags(type);
```

#### 4.2.6 lead_tags (Relacionamento Lead-Tag)

```sql
CREATE TABLE lead_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  
  applied_by_type VARCHAR(20) NOT NULL 
    CHECK (applied_by_type IN ('user', 'agent_bot', 'system', 'external')),
  applied_by_id UUID,
  
  source VARCHAR(20) NOT NULL 
    CHECK (source IN ('kanban', 'chatwoot', 'system', 'api')),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Um lead só pode ter uma tag de cada vez (para type='stage')
  -- Isso é validado na aplicação, não no banco
  UNIQUE(contact_id, tag_id)
);

CREATE INDEX idx_lead_tags_contact ON lead_tags(contact_id);
CREATE INDEX idx_lead_tags_tag ON lead_tags(tag_id);
```

#### 4.2.7 tag_history (Histórico Imutável)

```sql
CREATE TABLE tag_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  tag_id UUID REFERENCES tags(id) ON DELETE SET NULL,
  
  action VARCHAR(20) NOT NULL 
    CHECK (action IN ('added', 'removed', 'tag_created', 'tag_deleted')),
  
  actor_type VARCHAR(20) NOT NULL 
    CHECK (actor_type IN ('user', 'agent_bot', 'system', 'external')),
  actor_id UUID,
  
  source VARCHAR(20) NOT NULL 
    CHECK (source IN ('kanban', 'chatwoot', 'system', 'api')),
  
  reason TEXT,
  
  -- Snapshot dos dados no momento
  tag_name VARCHAR(100),
  contact_nome VARCHAR(255),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela somente INSERT, sem UPDATE ou DELETE
CREATE INDEX idx_tag_history_contact ON tag_history(contact_id);
CREATE INDEX idx_tag_history_created ON tag_history(created_at);
```

#### 4.2.8 products (Produtos/Serviços)

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  
  nome VARCHAR(255) NOT NULL,
  valor_padrao DECIMAL(10,2) NOT NULL,
  
  -- Array de métodos aceitos
  metodos_pagamento TEXT[] NOT NULL DEFAULT ARRAY['pix'],
  
  -- Array de convênios (se 'convenio' em metodos_pagamento)
  convenios_aceitos TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  ativo BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_account ON products(account_id);
CREATE INDEX idx_products_ativo ON products(ativo);
```

#### 4.2.9 sales (Vendas)

```sql
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE RESTRICT,
  
  valor DECIMAL(10,2) NOT NULL,
  
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'paid', 'refunded', 'partial_refund')),
  
  metodo_pagamento VARCHAR(20) NOT NULL 
    CHECK (metodo_pagamento IN ('pix', 'boleto', 'debito', 'credito', 'dinheiro', 'convenio')),
  
  convenio_nome VARCHAR(255),
  
  responsavel_id UUID NOT NULL REFERENCES users(id),
  
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  
  -- Metadados de estorno
  refund_reason TEXT,
  refunded_by UUID REFERENCES users(id)
);

CREATE INDEX idx_sales_account ON sales(account_id);
CREATE INDEX idx_sales_contact ON sales(contact_id);
CREATE INDEX idx_sales_status ON sales(status);
CREATE INDEX idx_sales_responsavel ON sales(responsavel_id);
CREATE INDEX idx_sales_created ON sales(created_at);
```

#### 4.2.10 sale_items (Itens da Venda)

```sql
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  
  quantidade INT NOT NULL DEFAULT 1,
  valor_unitario DECIMAL(10,2) NOT NULL,
  valor_total DECIMAL(10,2) NOT NULL,
  
  refunded BOOLEAN NOT NULL DEFAULT false,
  refunded_at TIMESTAMPTZ,
  refund_reason TEXT
);

CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);
```

#### 4.2.11 lead_notes (Notas do Lead)

```sql
CREATE TABLE lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  
  -- Snapshot do nome do autor (para histórico)
  author_name VARCHAR(255) NOT NULL,
  
  content TEXT NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_notes_contact ON lead_notes(contact_id);
CREATE INDEX idx_lead_notes_created ON lead_notes(created_at);
```

#### 4.2.12 events (Auditoria/Event Sourcing)

```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  
  event_type VARCHAR(100) NOT NULL,
  
  actor_type VARCHAR(20) 
    CHECK (actor_type IN ('user', 'agent_bot', 'system', 'external')),
  actor_id UUID,
  
  entity_type VARCHAR(100),
  entity_id UUID,
  
  channel VARCHAR(50),
  
  payload JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela somente INSERT
CREATE INDEX idx_events_account ON events(account_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created ON events(created_at);
CREATE INDEX idx_events_entity ON events(entity_type, entity_id);
```

#### 4.2.13 calendar_events (Eventos de Agenda)

```sql
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  
  title VARCHAR(255) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  
  type VARCHAR(20) NOT NULL DEFAULT 'appointment' 
    CHECK (type IN ('meeting', 'appointment', 'block', 'other')),
  
  source VARCHAR(20) NOT NULL DEFAULT 'crm' 
    CHECK (source IN ('google', 'crm')),
  
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' 
    CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  
  location VARCHAR(500),
  meeting_link VARCHAR(500),
  
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  notes TEXT,
  
  created_by UUID REFERENCES users(id),
  
  -- Sincronização Google Calendar
  google_event_id VARCHAR(255),
  google_calendar_id VARCHAR(255),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calendar_account ON calendar_events(account_id);
CREATE INDEX idx_calendar_start ON calendar_events(start_time);
CREATE INDEX idx_calendar_google ON calendar_events(google_event_id);
```

#### 4.2.14 calendar_attendees (Participantes)

```sql
CREATE TABLE calendar_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  
  status VARCHAR(20) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'confirmed', 'declined', 'tentative'))
);

CREATE INDEX idx_attendees_event ON calendar_attendees(event_id);
```

#### 4.2.15 google_calendar_tokens (Tokens OAuth)

```sql
CREATE TABLE google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type VARCHAR(50) NOT NULL DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ NOT NULL,
  
  calendar_id VARCHAR(255),
  connected_email VARCHAR(255),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 5. Especificação de Endpoints

### 5.1 Convenções

- **Base URL:** `https://api.gleps.com.br/v1`
- **Autenticação:** Bearer Token (JWT)
- **Content-Type:** `application/json`
- **Paginação:** `?page=1&limit=20`
- **Ordenação:** `?sort=created_at&order=desc`

### 5.2 Respostas Padrão

#### Sucesso (200/201)
```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### Erro (4xx/5xx)
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email já cadastrado",
    "details": {
      "field": "email",
      "value": "user@email.com"
    }
  }
}
```

### 5.3 Endpoints por Módulo

#### 5.3.1 Autenticação (`/auth`)

| Método | Endpoint | Descrição | Body | Response |
|--------|----------|-----------|------|----------|
| POST | `/auth/login` | Login | `{ email, password }` | `{ user, account, token, refreshToken, expiresAt }` |
| POST | `/auth/logout` | Logout | - | `{ success: true }` |
| POST | `/auth/refresh` | Renovar token | `{ refreshToken }` | `{ token, expiresAt }` |
| GET | `/auth/me` | Usuário atual | - | `{ user, account }` |
| POST | `/auth/verify-password` | Validar senha | `{ password }` | `{ valid: boolean }` |

---

#### 5.3.2 Contas (`/accounts`) - Super Admin

| Método | Endpoint | Descrição | Query/Body |
|--------|----------|-----------|------------|
| GET | `/accounts` | Listar contas | `?status=active&search=termo&page=1&limit=20` |
| POST | `/accounts` | Criar conta | `{ nome, plano, limiteUsuarios, chatwoot* }` |
| GET | `/accounts/:id` | Detalhes | - |
| PUT | `/accounts/:id` | Atualizar | `{ nome, plano, status, chatwoot* }` |
| DELETE | `/accounts/:id` | Excluir | Header: `X-Confirm-Password` |
| POST | `/accounts/:id/pause` | Pausar | - |
| POST | `/accounts/:id/activate` | Ativar | - |
| GET | `/accounts/:id/stats` | Estatísticas | - |
| POST | `/accounts/:id/test-chatwoot` | Testar conexão | - |
| GET | `/accounts/:id/chatwoot-agents` | Agentes Chatwoot | - |

---

#### 5.3.3 Usuários (`/users`)

| Método | Endpoint | Descrição | Query/Body |
|--------|----------|-----------|------------|
| GET | `/users` | Listar | `?accountId=&role=&status=&search=&page=&limit=` |
| POST | `/users` | Criar | `{ accountId, nome, email, password, role, permissions[] }` |
| GET | `/users/:id` | Detalhes | - |
| PUT | `/users/:id` | Atualizar | `{ nome, email, role, status, permissions[] }` |
| DELETE | `/users/:id` | Excluir | Header: `X-Confirm-Password` |
| POST | `/users/:id/impersonate` | Impersonar | - (Super Admin only) |
| PATCH | `/users/:id/password` | Alterar senha | `{ currentPassword, newPassword }` |

---

#### 5.3.4 Contatos/Leads (`/contacts`)

| Método | Endpoint | Descrição | Query/Body |
|--------|----------|-----------|------------|
| GET | `/contacts` | Listar | `?search=&origem=&tagId=&page=&limit=` |
| POST | `/contacts` | Criar | `{ nome, telefone, email, origem }` |
| GET | `/contacts/:id` | Detalhes | - |
| PUT | `/contacts/:id` | Atualizar | `{ nome, telefone, email, origem }` |
| DELETE | `/contacts/:id` | Excluir | (Falha se tem vendas) |
| GET | `/contacts/:id/sales` | Vendas | - |
| GET | `/contacts/:id/notes` | Notas | - |
| POST | `/contacts/:id/notes` | Criar nota | `{ content }` |
| GET | `/contacts/:id/tags` | Tags atuais | - |
| POST | `/contacts/:id/tags` | Aplicar tag | `{ tagId, source }` |
| DELETE | `/contacts/:id/tags/:tagId` | Remover tag | - |
| GET | `/contacts/:id/history` | Histórico | - |

---

#### 5.3.5 Tags/Etapas (`/tags`)

| Método | Endpoint | Descrição | Query/Body |
|--------|----------|-----------|------------|
| GET | `/tags` | Listar | `?type=stage&funnelId=&ativo=true` |
| POST | `/tags` | Criar | `{ funnelId, name, type, color }` |
| PUT | `/tags/:id` | Atualizar | `{ name, color }` |
| DELETE | `/tags/:id` | Excluir | (Falha se tem leads) |
| PATCH | `/tags/:id/order` | Reordenar | `{ ordem }` |
| POST | `/tags/reorder` | Reordenar todas | `{ tagIds: [] }` |

---

#### 5.3.6 Produtos (`/products`)

| Método | Endpoint | Descrição | Query/Body |
|--------|----------|-----------|------------|
| GET | `/products` | Listar | `?search=&ativo=true&page=&limit=` |
| POST | `/products` | Criar | `{ nome, valorPadrao, metodosPagamento[], conveniosAceitos[] }` |
| GET | `/products/:id` | Detalhes | - |
| PUT | `/products/:id` | Atualizar | `{ nome, valorPadrao, metodosPagamento[], conveniosAceitos[] }` |
| DELETE | `/products/:id` | Excluir | (Falha se tem vendas) |
| PATCH | `/products/:id/status` | Ativar/Desativar | `{ ativo: boolean }` |

---

#### 5.3.7 Vendas (`/sales`)

| Método | Endpoint | Descrição | Query/Body |
|--------|----------|-----------|------------|
| GET | `/sales` | Listar | `?contactId=&status=&responsavelId=&startDate=&endDate=&page=&limit=` |
| POST | `/sales` | Criar | `{ contactId, metodoPagamento, convenioNome, items: [{ productId, quantidade, valorUnitario }] }` |
| GET | `/sales/:id` | Detalhes | - |
| PATCH | `/sales/:id/pay` | Marcar pago | - |
| POST | `/sales/:id/refund` | Estornar | `{ reason }` + Header: `X-Confirm-Password` |
| POST | `/sales/:id/items/:itemId/refund` | Estornar item | `{ reason }` + Header: `X-Confirm-Password` |
| GET | `/sales/kpis` | KPIs | `?startDate=&endDate=` |
| GET | `/sales/audit-log` | Log auditoria | `?startDate=&endDate=&page=&limit=` |

---

#### 5.3.8 Dashboard (`/dashboard`)

| Método | Endpoint | Descrição | Query |
|--------|----------|-----------|-------|
| GET | `/dashboard/kpis` | KPIs principais | `?startDate=&endDate=&channel=` |
| GET | `/dashboard/hourly-peak` | Pico por hora | `?startDate=&endDate=` |
| GET | `/dashboard/backlog` | Backlog | - |
| GET | `/dashboard/agents-performance` | Performance agentes | `?startDate=&endDate=` |
| GET | `/dashboard/ia-vs-human` | IA vs Humano | `?startDate=&endDate=` |

---

#### 5.3.9 Finanças (`/finance`)

| Método | Endpoint | Descrição | Query |
|--------|----------|-----------|-------|
| GET | `/finance/kpis` | KPIs financeiros | `?startDate=&endDate=` |
| GET | `/finance/revenue-chart` | Receita por período | `?startDate=&endDate=&granularity=day` |
| GET | `/finance/payment-methods` | Métodos pagamento | `?startDate=&endDate=` |
| GET | `/finance/funnel-conversion` | Conversão funil | `?startDate=&endDate=` |

---

#### 5.3.10 Insights (`/insights`)

| Método | Endpoint | Descrição | Query |
|--------|----------|-----------|-------|
| GET | `/insights/kpis` | KPIs | `?startDate=&endDate=` |
| GET | `/insights/products` | Análise produtos | `?startDate=&endDate=` |
| GET | `/insights/temporal` | Análise temporal | `?startDate=&endDate=` |
| GET | `/insights/marketing` | Métricas marketing | `?startDate=&endDate=` |
| GET | `/insights/payment-methods` | Análise pagamentos | `?startDate=&endDate=` |
| GET | `/insights/automatic` | Insights automáticos | `?startDate=&endDate=` |
| GET | `/insights/agents-ranking` | Ranking agentes | `?startDate=&endDate=` |

---

#### 5.3.11 Calendário (`/calendar`)

| Método | Endpoint | Descrição | Query/Body |
|--------|----------|-----------|------------|
| GET | `/calendar/events` | Listar eventos | `?startDate=&endDate=&type=` |
| POST | `/calendar/events` | Criar evento | `{ title, startTime, endTime, type, contactId, notes, attendees[] }` |
| GET | `/calendar/events/:id` | Detalhes | - |
| PUT | `/calendar/events/:id` | Atualizar | - |
| DELETE | `/calendar/events/:id` | Excluir | - |
| POST | `/calendar/google/connect` | Iniciar OAuth | - |
| GET | `/calendar/google/callback` | Callback OAuth | - |
| POST | `/calendar/google/disconnect` | Desconectar | - |
| POST | `/calendar/google/sync` | Sincronizar | - |
| GET | `/calendar/google/status` | Status conexão | - |

---

#### 5.3.12 Eventos/Auditoria (`/events`)

| Método | Endpoint | Descrição | Query |
|--------|----------|-----------|-------|
| GET | `/events` | Listar eventos | `?type=&entityType=&entityId=&startDate=&endDate=&page=&limit=` |
| GET | `/events/user-activity` | Atividade usuários | `?startDate=&endDate=` |
| GET | `/events/online-status` | Status online | - |

---

#### 5.3.13 Super Admin (`/admin`)

| Método | Endpoint | Descrição | Query |
|--------|----------|-----------|-------|
| GET | `/admin/kpis` | KPIs globais | - |
| GET | `/admin/server-resources` | Recursos servidor | - |
| GET | `/admin/consumption-history` | Histórico consumo | `?period=24h|7d|30d` |

---

## 6. Mapeamento de Páginas

### 6.1 Páginas Públicas

| Rota | Componente | Funcionalidade |
|------|------------|----------------|
| `/login` | `LoginPage.tsx` | Formulário de login com email/senha |
| `/unauthorized` | `UnauthorizedPage.tsx` | Página 403 - Acesso negado |
| `/*` | `NotFound.tsx` | Página 404 |

### 6.2 Páginas Super Admin (`/super-admin/*`)

| Rota | Componente | Funcionalidades |
|------|------------|-----------------|
| `/super-admin` | `SuperAdminDashboard.tsx` | KPIs globais, recursos servidor, consumo |
| `/super-admin/accounts` | `SuperAdminAccountsPage.tsx` | CRUD contas, teste Chatwoot, pausar/ativar |
| `/super-admin/accounts/:id` | `SuperAdminAccountDetailPage.tsx` | Detalhes conta, estatísticas, usuários |
| `/super-admin/users` | `SuperAdminUsersPage.tsx` | CRUD usuários, permissões, impersonação |

### 6.3 Páginas Admin (`/admin/*`)

| Rota | Componente | Funcionalidades |
|------|------------|-----------------|
| `/admin` | `AdminDashboard.tsx` | KPIs atendimento, pico/hora, backlog, performance agentes |
| `/admin/kanban` | `AdminKanbanPage.tsx` | Visualização kanban, drag-drop, CRUD etapas |
| `/admin/leads` | `AdminLeadsPage.tsx` | Tabela leads, filtros, ficha cliente |
| `/admin/sales` | `AdminSalesPage.tsx` | Vendas, multi-produto, estornos, auditoria |
| `/admin/finance` | `AdminFinancePage.tsx` | Dashboard financeiro, gráficos, métricas |
| `/admin/products` | `AdminProductsPage.tsx` | CRUD produtos, métodos pagamento |
| `/admin/agenda` | `AdminAgendaPage.tsx` | Calendário, Google Calendar sync |
| `/admin/events` | `AdminEventsPage.tsx` | Controle ponto, timeline, relatório |
| `/admin/insights` | `AdminInsightsPage.tsx` | Análises, ranking, insights automáticos |

---

## 7. Integrações Externas

### 7.1 Chatwoot

#### 7.1.1 Configuração
- **Base URL:** Configurável por conta
- **Account ID:** ID da conta no Chatwoot
- **API Key:** Token de acesso à API

#### 7.1.2 Endpoints Consumidos

| Endpoint Chatwoot | Método | Uso no GLEPS |
|-------------------|--------|--------------|
| `/api/v1/accounts/:id/agents` | GET | Importar agentes |
| `/api/v1/accounts/:id/labels` | GET/POST | Sincronizar etapas |
| `/api/v1/accounts/:id/contacts` | GET | Buscar contatos |
| `/api/v1/accounts/:id/conversations` | GET | Dados de conversa |
| `/api/v1/accounts/:id/reports/summary` | GET | Métricas dashboard |

#### 7.1.3 Webhooks Recebidos

| Evento | Ação no GLEPS |
|--------|---------------|
| `conversation_created` | Criar lead se não existe |
| `conversation_updated` | Atualizar dados do lead |
| `label_created` | Sincronizar tag |
| `label_updated` | Atualizar tag |
| `label_added` | Mover lead no Kanban |
| `label_removed` | Atualizar posição |

#### 7.1.4 Sincronização Bidirecional

```
┌──────────────┐                      ┌──────────────┐
│    GLEPS     │                      │   CHATWOOT   │
│   Kanban     │                      │    Labels    │
└──────┬───────┘                      └──────┬───────┘
       │                                     │
       │ 1. Criar etapa no Kanban            │
       │ ──────────────────────────────────► │
       │    POST /labels                     │
       │                                     │
       │ 2. Webhook: label_created           │
       │ ◄────────────────────────────────── │
       │    Atualizar chatwoot_label_id      │
       │                                     │
       │ 3. Mover lead (drag-drop)           │
       │ ──────────────────────────────────► │
       │    PUT /conversations/:id/labels    │
       │                                     │
       │ 4. Webhook: label_added             │
       │ ◄────────────────────────────────── │
       │    Confirmar posição                │
       │                                     │
└──────┴───────────────────────────────────────┘
```

### 7.2 Google Calendar

#### 7.2.1 OAuth 2.0 Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│  User   │     │  GLEPS  │     │  Google │
└────┬────┘     └────┬────┘     └────┬────┘
     │               │               │
     │ 1. Click      │               │
     │ "Conectar"    │               │
     │──────────────►│               │
     │               │               │
     │               │ 2. Redirect   │
     │               │──────────────►│
     │               │               │
     │ 3. Google     │               │
     │ Consent       │               │
     │◄──────────────────────────────│
     │               │               │
     │ 4. Authorize  │               │
     │──────────────────────────────►│
     │               │               │
     │               │ 5. Callback   │
     │               │ (code)        │
     │               │◄──────────────│
     │               │               │
     │               │ 6. Exchange   │
     │               │ code → tokens │
     │               │──────────────►│
     │               │               │
     │               │ 7. Save       │
     │               │ tokens        │
     │               │───────┐       │
     │               │       │       │
     │               │◄──────┘       │
     │               │               │
     │ 8. Connected! │               │
     │◄──────────────│               │
     │               │               │
```

#### 7.2.2 Scopes Necessários
- `https://www.googleapis.com/auth/calendar.readonly`
- `https://www.googleapis.com/auth/calendar.events`

#### 7.2.3 Sincronização
- **Frequência:** A cada 5 minutos (ou manual)
- **Direção:** Bidirecional
- **Conflito:** Google Calendar prevalece

---

## 8. Eventos de Auditoria

### 8.1 Tipos de Eventos

#### 8.1.1 Autenticação (`auth.*`)

| Evento | Descrição | Payload |
|--------|-----------|---------|
| `auth.login.success` | Login bem-sucedido | `{ userId, email, ip, userAgent }` |
| `auth.login.failed` | Login falhou | `{ email, reason, ip }` |
| `auth.logout` | Logout | `{ userId }` |
| `auth.token.refresh` | Token renovado | `{ userId }` |
| `auth.password.reset` | Senha redefinida | `{ userId, method }` |

#### 8.1.2 Contas (`account.*`)

| Evento | Descrição | Payload |
|--------|-----------|---------|
| `account.created` | Conta criada | `{ accountId, nome, createdBy }` |
| `account.updated` | Conta atualizada | `{ accountId, changes }` |
| `account.paused` | Conta pausada | `{ accountId, reason }` |
| `account.activated` | Conta ativada | `{ accountId }` |
| `account.deleted` | Conta excluída | `{ accountId, deletedBy }` |

#### 8.1.3 Usuários (`user.*`)

| Evento | Descrição | Payload |
|--------|-----------|---------|
| `user.created` | Usuário criado | `{ userId, email, role, createdBy }` |
| `user.updated` | Usuário atualizado | `{ userId, changes }` |
| `user.deleted` | Usuário excluído | `{ userId, deletedBy }` |
| `user.suspended` | Usuário suspenso | `{ userId, reason }` |
| `user.impersonated` | Impersonação | `{ targetUserId, impersonatedBy }` |

#### 8.1.4 Leads (`lead.*`)

| Evento | Descrição | Payload |
|--------|-----------|---------|
| `lead.created` | Lead criado | `{ contactId, origem, createdBy }` |
| `lead.updated` | Lead atualizado | `{ contactId, changes }` |
| `lead.stage.changed` | Etapa alterada | `{ contactId, fromTag, toTag, movedBy }` |
| `lead.tag.added` | Tag adicionada | `{ contactId, tagId, source }` |
| `lead.tag.removed` | Tag removida | `{ contactId, tagId, source }` |

#### 8.1.5 Vendas (`sale.*`)

| Evento | Descrição | Payload |
|--------|-----------|---------|
| `sale.created` | Venda criada | `{ saleId, contactId, valor, items, createdBy }` |
| `sale.paid` | Venda paga | `{ saleId, paidAt }` |
| `sale.refunded` | Venda estornada | `{ saleId, reason, refundedBy }` |
| `sale.item.refunded` | Item estornado | `{ saleId, itemId, reason, refundedBy }` |

#### 8.1.6 Funil (`funnel.*`)

| Evento | Descrição | Payload |
|--------|-----------|---------|
| `funnel.stage.created` | Etapa criada | `{ tagId, name, createdBy }` |
| `funnel.stage.updated` | Etapa atualizada | `{ tagId, changes }` |
| `funnel.stage.deleted` | Etapa excluída | `{ tagId, deletedBy }` |
| `funnel.stage.reordered` | Etapas reordenadas | `{ tagIds, reorderedBy }` |

### 8.2 Estrutura do Payload

```typescript
interface Event {
  id: string;
  accountId: string | null;
  eventType: string;
  actorType: 'user' | 'agent_bot' | 'system' | 'external';
  actorId: string | null;
  entityType: string | null;
  entityId: string | null;
  channel: string | null;
  payload: Record<string, any>;
  createdAt: string;
}
```

---

## 9. Regras de Negócio

### 9.1 Multi-tenancy

| Regra | Descrição |
|-------|-----------|
| Isolamento de Dados | Todos os dados filtrados por `account_id` |
| Conta Pausada | Bloqueia acesso de todos usuários (exceto super_admin) |
| Sessão Única | Uma sessão ativa por usuário |
| Limite de Usuários | Conta não pode exceder `limite_usuarios` |

### 9.2 Autenticação

| Regra | Descrição |
|-------|-----------|
| Usuário Inativo | `user.status != 'active'` → bloqueia login |
| Usuário Suspenso | `user.status == 'suspended'` → bloqueia login |
| Conta Pausada | `account.status == 'paused'` → bloqueia login (exceto super_admin) |
| Expiração Token | JWT expira em 1 hora |
| Refresh Token | Válido por 7 dias |

### 9.3 Vendas

| Regra | Descrição |
|-------|-----------|
| Multi-item | Venda pode ter múltiplos produtos |
| Cálculo Automático | `sale.valor = SUM(items.valor_total)` |
| Recorrência | Detectada se `contact_id + product_id` já existe |
| Estorno Completo | Altera `sale.status = 'refunded'` |
| Estorno Parcial | Altera `sale.status = 'partial_refund'` |
| Validação Estorno | Requer senha do usuário + justificativa |
| Bloqueio Exclusão | Lead com vendas não pode ser excluído |

### 9.4 Kanban/Tags

| Regra | Descrição |
|-------|-----------|
| Tipo Stage | Exclusivo - lead só pode ter UMA tag type='stage' |
| Tipo Operational | Múltiplas - lead pode ter várias tags type='operational' |
| Sincronização | Criar etapa → criar label no Chatwoot |
| Exclusão | Só permitido se etapa não tem leads |
| Ordenação | Campo `ordem` define posição da coluna |

### 9.5 Permissões de Agente

| Regra | Descrição |
|-------|-----------|
| Dashboard Obrigatório | Permissão `dashboard` sempre incluída |
| Filtro Automático | Sidebar oculta módulos não autorizados |
| Proteção de Rota | Acesso direto à URL bloqueado |
| Filtro de Dados | Agents veem apenas próprias vendas/leads |

### 9.6 Calendário

| Regra | Descrição |
|-------|-----------|
| Sincronização | A cada 5 minutos ou manual |
| Conflito | Google Calendar prevalece |
| Timezone | Usa timezone da conta |
| Eventos Cancelados | Marcados como `status = 'cancelled'`, não excluídos |

---

## 10. Guia de Implementação

### 10.1 Ordem de Prioridade

#### Fase 1: Fundação (Semanas 1-2)

1. **Setup do Projeto**
   - Estrutura de pastas
   - Configuração de ambiente
   - Docker/Containers

2. **Banco de Dados**
   - Criar todas as tabelas
   - Índices e constraints
   - Migrations

3. **Autenticação**
   - JWT com refresh token
   - Middleware de autenticação
   - Validação de senha

#### Fase 2: CRUD Base (Semanas 3-4)

4. **Accounts CRUD**
   - Endpoints completos
   - Validação de dados
   - Soft delete

5. **Users CRUD**
   - Endpoints completos
   - Hash de senha (bcrypt)
   - Permissões

6. **Contacts CRUD**
   - Endpoints completos
   - Busca e filtros

7. **Products CRUD**
   - Endpoints completos
   - Validação de métodos de pagamento

#### Fase 3: Negócio (Semanas 5-6)

8. **Tags/Etapas**
   - CRUD de tags
   - Reordenação
   - Validação de exclusão

9. **Sales**
   - Criação multi-item
   - Cálculo automático
   - Detecção de recorrência
   - Estornos com validação

10. **Events/Auditoria**
    - Registro automático
    - Queries de histórico

#### Fase 4: Dashboards (Semanas 7-8)

11. **Dashboard KPIs**
    - Agregações
    - Cache de métricas

12. **Finance KPIs**
    - Relatórios financeiros
    - Gráficos

13. **Insights**
    - Análises de produtos
    - Rankings

#### Fase 5: Integrações (Semanas 9-10)

14. **Chatwoot**
    - Endpoints de teste
    - Webhooks
    - Sincronização de labels

15. **Google Calendar**
    - OAuth 2.0
    - Sincronização de eventos

### 10.2 Checklist de Testes

- [ ] Autenticação (login, logout, refresh)
- [ ] Bloqueio de usuário inativo/suspenso
- [ ] Bloqueio de conta pausada
- [ ] RBAC (super_admin, admin, agent)
- [ ] Permissões granulares de agent
- [ ] Multi-tenancy (isolamento de dados)
- [ ] CRUD de todas as entidades
- [ ] Vendas multi-item
- [ ] Estornos com validação
- [ ] Movimentação de leads no Kanban
- [ ] Sincronização Chatwoot
- [ ] OAuth Google Calendar
- [ ] Eventos de auditoria

### 10.3 Variáveis de Ambiente

```env
# Aplicação
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Banco de Dados
DATABASE_URL=postgresql://user:pass@localhost:5432/gleps

# JWT
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d

# Chatwoot (opcional)
CHATWOOT_WEBHOOK_SECRET=webhook-secret

# Google Calendar (opcional)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=http://localhost:3000/calendar/google/callback
```

---

## Changelog

| Versão | Data | Descrição |
|--------|------|-----------|
| 1.0.0 | 2026-01-26 | Versão inicial do documento |

---

> **Nota:** Este documento deve ser atualizado conforme o desenvolvimento avança. Qualquer alteração no frontend que impacte o backend deve ser refletida aqui.
