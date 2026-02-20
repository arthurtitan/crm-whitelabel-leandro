
## Novo Lead Único: Marcador Persistente no Banco de Dados

### O problema da limitação atual

A abordagem de detectar "novo lead" comparando o histórico de conversas do Chatwoot (até ~500) com o período selecionado é frágil. Se um contato tiver uma conversa muito antiga fora das 500 buscadas, ele seria incorretamente contado como novo.

### Solução: coluna `first_resolved_at` na tabela `contacts`

A lógica é simples e definitiva:

- **Sem marcador** (`first_resolved_at IS NULL`) → é um **novo lead** (nunca teve uma conversa encerrada antes)
- **Com marcador** (`first_resolved_at IS NOT NULL`) → é um contato recorrente

O marcador é gravado **uma única vez**, quando a **primeira conversa do contato é resolvida**. Depois disso, não muda nunca mais — é permanente.

```text
FLUXO:
  1ª conversa do contato aberta  →  contacts.first_resolved_at = NULL  (novo lead)
           ↓
  Conversa encerrada (1ª vez)    →  contacts.first_resolved_at = NOW()  (marcado)
           ↓
  2ª conversa, 3ª conversa...   →  contacts.first_resolved_at != NULL  (retorno)
```

### Onde o marcador é gravado

O marcador é gravado na **Edge Function `log-resolution`** — que já é acionada pelo n8n quando uma conversa é encerrada, e também pelo safety net da `fetch-chatwoot-metrics`. Ambos os caminhos precisam marcar o contato.

---

### Mudanças necessárias

#### 1. Migration SQL — nova coluna na tabela `contacts`

```sql
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS first_resolved_at timestamptz DEFAULT NULL;
```

Sem valor padrão — todos os contatos existentes começam como `NULL`, o que é seguro: o marcador será preenchido na próxima resolução de qualquer conversa.

#### 2. Edge Function `log-resolution` — gravar o marcador

Após o `INSERT` na `resolution_logs` com sucesso, fazer um `UPDATE` condicional na tabela `contacts`:

```typescript
// Buscar o contato pelo chatwoot_conversation_id
const { data: contactData } = await supabase
  .from('contacts')
  .select('id, first_resolved_at')
  .eq('chatwoot_conversation_id', Number(conversation_id))
  .eq('account_id', account.id)
  .maybeSingle();

// Só gravar se ainda não tiver sido marcado (primeira vez)
if (contactData && !contactData.first_resolved_at) {
  await supabase
    .from('contacts')
    .update({ first_resolved_at: new Date().toISOString() })
    .eq('id', contactData.id);
}
```

#### 3. Edge Function `fetch-chatwoot-metrics` — safety net também marca

No loop de sync passivo (linha ~645), após o INSERT bem-sucedido na `resolution_logs`, adicionar a mesma lógica de marcar o contato — para cobrir conversas resolvidas por humano que não passaram pelo n8n:

```typescript
// Após INSERT bem-sucedido na resolution_logs
if (!insertError) {
  syncedCount++;
  // Marcar contato como "já teve resolução" (first_resolved_at)
  const contactId = conv.meta?.sender?.id;
  if (contactId) {
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, first_resolved_at')
      .eq('chatwoot_contact_id', contactId)
      .eq('account_id', dbAccountId)
      .maybeSingle();

    if (contact && !contact.first_resolved_at) {
      await supabase
        .from('contacts')
        .update({ first_resolved_at: new Date().toISOString() })
        .eq('id', contact.id);
    }
  }
}
```

#### 4. Edge Function `fetch-chatwoot-metrics` — calcular `novosLeads` via banco

Substituir a lógica de comparação de histórico por uma consulta direta ao banco, usando os `chatwoot_contact_id` dos contatos em `finalConversations`:

```typescript
// Extrair IDs únicos dos contatos com atividade no período
const contactIdsInPeriod = [...new Set(
  finalConversations
    .map((c: any) => c.meta?.sender?.id)
    .filter(Boolean)
)];

let novosLeads = 0;
if (contactIdsInPeriod.length > 0 && accountData?.id) {
  // Contar contatos cujo first_resolved_at está NO período OU é NULL (nunca resolvido)
  // e que tiveram atividade no período
  const { data: newLeadContacts } = await supabase
    .from('contacts')
    .select('id, first_resolved_at')
    .eq('account_id', accountData.id)
    .in('chatwoot_contact_id', contactIdsInPeriod);

  // Novo lead = first_resolved_at é NULL (nunca resolvido antes) 
  // OU first_resolved_at caiu dentro do período (foi sua primeira resolução neste período)
  novosLeads = (newLeadContacts || []).filter(c => 
    !c.first_resolved_at || 
    (new Date(c.first_resolved_at) >= dateFromParsed && new Date(c.first_resolved_at) <= dateToParsed)
  ).length;
}
```

#### 5. Renomear card no frontend

**`src/pages/admin/AdminDashboard.tsx`**:

```tsx
// Card "Conversas Ativas Agora" → "Novos Leads"
title="Novos Leads"
subtitle={getAgentContextSubtitle('Primeiro contato no período')}
icon={UserPlus}
iconColor="text-success"
iconBgColor="bg-success/10"
```

Adicionar `UserPlus` ao import de `lucide-react`.

E atualizar o mapeamento em `useChatwootMetrics` / `displayedData` para ler `conversasAtivas` como `novosLeads` (o campo retornado pela API já é `conversasAtivas`, só muda o valor).

---

### Diagrama do fluxo

```text
CONTATO ENTRA (1ª vez)
contacts.first_resolved_at = NULL
         ↓
Conversa encerrada
  └─ via n8n → log-resolution → UPDATE contacts SET first_resolved_at = NOW()
  └─ via safety net (fetch-chatwoot-metrics) → mesmo UPDATE
         ↓
CONTATO RETORNA (2ª, 3ª vez)
contacts.first_resolved_at = '2026-02-04T...'  ← marcado, nunca mais muda

MÉTRICA "Novos Leads" no período X:
  Contatos com atividade no período
  WHERE first_resolved_at IS NULL (ainda na 1ª conversa, nunca resolvida)
  OR first_resolved_at BETWEEN X.from AND X.to (1ª resolução caiu no período)
```

### Por que essa abordagem elimina a limitação

| Antes | Depois |
|---|---|
| Compara `allConversations` (≤500) com período | Consulta banco (100% dos contatos registrados) |
| Pode errar se histórico tiver >500 conversas | Preciso independente do volume |
| Depende de paginação do Chatwoot | Independente do Chatwoot para a lógica de novo/retorno |
| Recalcula toda vez | Gravado uma vez, para sempre |

### Arquivos alterados

1. **Migration SQL** — coluna `first_resolved_at` em `contacts`
2. **`supabase/functions/log-resolution/index.ts`** — gravar marcador após primeira resolução
3. **`supabase/functions/fetch-chatwoot-metrics/index.ts`** — safety net grava marcador + query banco para `novosLeads`
4. **`src/pages/admin/AdminDashboard.tsx`** — renomear card para "Novos Leads"
