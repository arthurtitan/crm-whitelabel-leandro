

# Plano: Tabela `resolution_logs` + Edge Function `log-resolution`

## Contexto

- **IA resolve:** o n8n seta `resolved_by: "ai"` ANTES de encerrar. Neste momento, o n8n tambem chamara `log-resolution` com `resolved_by: "ai"`.
- **Humano resolve:** nao existe fluxo no n8n para marcar `resolved_by: "human"`. O humano simplesmente clica "Resolver" no Chatwoot. O CRM (edge function) infere que foi humano pela ausencia de `resolved_by: "ai"`.

## Estrategia de Logging

Dois caminhos para registrar na tabela `resolution_logs`:

| Cenario | Quem registra | Como |
|---------|--------------|------|
| IA resolve | n8n (Fluxo 3) | POST para `log-resolution` com `resolved_by: "ai"` no mesmo momento que seta o custom attribute |
| Humano resolve | Edge function `fetch-chatwoot-metrics` | Ao processar conversas resolvidas SEM `resolved_by: "ai"`, grava automaticamente como `resolved_by: "human"` se ainda nao existir log para aquela conversa+timestamp |

Isso elimina a necessidade de qualquer fluxo n8n adicional para o cenario humano.

---

## Alteracoes Necessarias

### 1. Migracao de Banco de Dados

Criar tabela `resolution_logs`:

```sql
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
```

### 2. Nova Edge Function: `log-resolution`

Endpoint chamado pelo n8n quando a IA resolve:

- **Metodo:** POST
- **Body:** `{ account_id, conversation_id, resolved_by: "ai", resolution_type?, agent_id? }`
- **Autenticacao:** `verify_jwt = false` (sera chamado pelo n8n)
- **Logica:** INSERT na tabela com `ON CONFLICT DO NOTHING` para idempotencia
- **Validacao:** Checa que `resolved_by` e "ai" ou "human", campos obrigatorios presentes

### 3. Atualizar `fetch-chatwoot-metrics`

Ao processar conversas resolvidas, para cada conversa onde o humano encerrou (inferido pela ausencia de `resolved_by: "ai"`):

- Verificar se ja existe log na tabela para aquele `conversation_id` com `resolved_at` proximo
- Se nao existir, inserir automaticamente com `resolved_by: "human"` e `resolution_type: "inferred"`
- Adicionar consulta agregada a `resolution_logs` para retornar totais historicos no response

Novos campos no response:

```json
{
  "data": {
    "historicoResolucoes": {
      "totalIA": 45,
      "totalHumano": 55,
      "percentualIA": 45,
      "percentualHumano": 55,
      "porTipo": {
        "explicit": 40,
        "handoff": 25,
        "manual_intervention": 15,
        "direct_human": 15,
        "inferred": 5
      }
    }
  }
}
```

### 4. Atualizar `supabase/config.toml`

Adicionar configuracao para a nova function:

```toml
[functions.log-resolution]
verify_jwt = false
```

### 5. Atualizar `docs/N8N_CHATWOOT_INTEGRATION.md`

- Adicionar documentacao do endpoint `log-resolution`
- Atualizar Fluxo 3 (IA Resolve) para incluir o POST ao `log-resolution`
- Explicar que resolucoes humanas sao registradas automaticamente pelo CRM

### 6. Instrucao para o n8n (Fluxo 3 - IA Resolve)

Adicionar um no HTTP Request APOS setar `resolved_by: "ai"`:

```text
POST https://ptcagwncwtuvcuqlwdzj.supabase.co/functions/v1/log-resolution

Body:
{
  "account_id": "UUID_DA_CONTA",
  "conversation_id": {{ $json.conversation.id }},
  "resolved_by": "ai",
  "resolution_type": "explicit"
}
```

---

## Resumo do Fluxo

```text
IA resolve conversa:
  n8n → POST /custom_attributes { resolved_by: "ai" }
  n8n → POST /log-resolution { resolved_by: "ai" }  ← NOVO
  n8n → POST /toggle_status (resolved)

Humano resolve conversa:
  Humano clica "Resolver" no Chatwoot (nenhum fluxo n8n)
  Dashboard abre → fetch-chatwoot-metrics detecta conversa resolvida sem "ai"
  → INSERT automatico na resolution_logs com resolved_by: "human"

Consulta historica:
  SELECT resolved_by, COUNT(*) FROM resolution_logs
  WHERE account_id = X GROUP BY resolved_by
  → ai: 10, human: 10 = 50% / 50%
```

