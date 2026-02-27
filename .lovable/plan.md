
# Auditoria e Correcao: Metricas do Dashboard vs Dados Reais do Chatwoot

## Dados Encontrados na Investigacao

### O que o Dashboard exibe (screenshots):
| Metrica | 30 dias | 7 dias |
|---|---|---|
| Total de Leads | 22 | 3 |
| Novos Leads | 0 | 0 |
| Retornos | 22 | 3 |
| Resolucao IA | 0 (0%) | 0 (0%) |
| Resolucao Humano | 4 (100%) | 2 (100%) |
| Transbordo | 4 (100%) | 2 (100%) |
| Backlog Humano | 0/0/0 | 0/0/0 |

### O que o banco de dados contém:
- `contacts` table: **VAZIA** (0 registros) - nenhum contato sincronizado
- `resolution_logs`: 15 registros (9 AI + 6 humano), todos entre Feb 12-16
- Unique constraint e em `(account_id, conversation_id, resolved_at)`, permitindo multiplas entradas por conversa

## Bugs Identificados

### Bug 1: Novos Leads SEMPRE 0 (CRITICO)

**Causa raiz:** A logica de novos leads depende da tabela `contacts` ter registros com `chatwoot_contact_id` e `first_resolved_at` populados. Como a tabela contacts esta VAZIA, a query retorna 0 resultados e `novosLeads = 0`.

**Consequencia:** `retornosNoPeriodo = totalLeads - 0 = totalLeads`. Todos os leads aparecem como "retornos", o que e incorreto.

**Edge Function (linhas 741-765):** Query contra contacts retorna vazio, novosLeads fica 0.
**Backend (linhas 492-520):** Mesma query via Prisma, mesmo resultado.

**Correcao:** Quando a query ao banco retorna 0 contatos correspondentes, usar fallback baseado nos dados da API do Chatwoot. Agrupar todas as conversas por `sender.id`, verificar se a conversa mais antiga de cada contato foi criada dentro do periodo. Se sim, e um "novo lead".

```typescript
// FALLBACK: Se DB nao tem contacts sincronizados, inferir de allConversations
if (novosLeads === 0 && contactIdsInPeriod.length > 0) {
  const convsBySender = new Map();
  for (const conv of allConversations) {
    const sid = conv.meta?.sender?.id;
    if (!sid) continue;
    if (!convsBySender.has(sid)) convsBySender.set(sid, []);
    convsBySender.get(sid).push(conv);
  }
  
  let fallbackNovos = 0;
  for (const contactId of contactIdsInPeriod) {
    const allConvs = convsBySender.get(contactId) || [];
    const earliestMs = Math.min(...allConvs.map(c => {
      const raw = c.created_at;
      return typeof raw === 'number' ? raw * 1000 : new Date(raw).getTime();
    }));
    if (earliestMs >= dateFromParsed.getTime()) {
      fallbackNovos++;
    }
  }
  novosLeads = fallbackNovos;
}
```

### Bug 2: Resolucoes IA = 0 quando n8n nao esta ativo

**Causa raiz:** O sync de resolution_logs (linha 668 EF / 468 backend) **pula** conversas com `resolved_by === 'ai'` no Chatwoot, esperando que o n8n as registre via endpoint `log-resolution`. Se o n8n nao estiver rodando, NENHUMA resolucao IA e registrada no banco.

O fallback que calcula resolucoes a partir dos dados brutos so e ativado quando `totalIA === 0 AND totalHumano === 0`. Mas se existem entradas humanas no banco (como as 6 que existem), o fallback NAO e acionado, e as resolucoes IA ficam zeradas.

**Correcao:** Mudar a condicao do fallback para tambem suplementar resolucoes IA quando o banco nao tem nenhuma. Quando `totalIA === 0` mas existem conversas resolvidas com marcadores de IA no Chatwoot, calcular via fallback apenas a parte de IA.

```typescript
// FALLBACK PARCIAL: Se DB nao tem resolucoes IA mas Chatwoot tem
if (historicoResolucoes.totalIA === 0) {
  const resolvedConvs = finalConversations.filter(c => c.status === 'resolved');
  let fallbackIA = 0;
  for (const conv of resolvedConvs) {
    const result = classifyResolver(conv);
    if (result.type === 'ai') fallbackIA++;
  }
  if (fallbackIA > 0) {
    historicoResolucoes.totalIA = fallbackIA;
    // Recalcular percentuais
    const total = historicoResolucoes.totalIA + historicoResolucoes.totalHumano;
    historicoResolucoes.percentualIA = Math.round((historicoResolucoes.totalIA / total) * 100);
    historicoResolucoes.percentualHumano = 100 - historicoResolucoes.percentualIA;
  }
}
```

### Bug 3: Taxa de Transbordo incorreta em cenarios sem IA

Quando IA = 0, a formula `transbordo / (ia + transbordo) * 100` retorna `transbordo / transbordo = 100%`. Isso esta tecnicamente correto pela regra (toda resolucao humana = transbordo), mas se IA deveria ter registros (Bug 2), a taxa fica inflada.

**Correcao:** Sera automaticamente corrigida ao resolver o Bug 2. Com as resolucoes IA corretas, a taxa refletira a proporcao real.

## Arquivos Afetados

### 1. `supabase/functions/fetch-chatwoot-metrics/index.ts`
- **Linhas 740-765:** Adicionar fallback de novosLeads via API quando contacts table vazia
- **Linhas 798-830:** Mudar condicao do fallback de resolucoes para suplementar IA quando totalIA === 0 (nao apenas quando ambos sao 0)

### 2. `backend/src/services/chatwoot-metrics.service.ts`
- **Linhas 492-520:** Adicionar mesmo fallback de novosLeads
- **Linhas 556-587:** Mesma correcao do fallback parcial de IA

## Mudancas Necessarias por Arquivo

### Edge Function (`fetch-chatwoot-metrics/index.ts`)

**Mudanca A** - Apos o bloco de novosLeads (linha 765), adicionar fallback:
- Construir mapa de conversas por sender.id usando `allConversations` (todas as conversas, nao filtradas)
- Para cada contato unico no periodo, verificar se sua conversa mais antiga esta dentro do periodo
- Se sim, contar como novo lead

**Mudanca B** - Alterar condicao do fallback (linha 799):
- DE: `if (historicoResolucoes.totalIA === 0 && historicoResolucoes.totalHumano === 0)`
- PARA: Duas etapas - fallback total (quando ambos 0) + fallback parcial IA (quando so IA = 0)

### Backend (`chatwoot-metrics.service.ts`)

**Mudanca C** - Apos o bloco de novosLeads (linha 520), adicionar mesmo fallback via `allConversations`

**Mudanca D** - Alterar condicao do fallback (linha 556), mesma logica da Mudanca B

## Resultado Esperado

| Cenario | Antes | Depois |
|---|---|---|
| Contacts table vazia | Novos Leads = 0, Retornos = Total | Novos Leads calculado via API, Retornos correto |
| n8n nao ativo, humano resolve | IA = 0 (mesmo com bots respondendo) | IA contabilizada via fallback parcial |
| Taxa Transbordo sem IA | 100% sempre | Proporcional ao mix real IA/Humano |

## Consideracoes

- O fallback de novosLeads depende do `allConversations` (max 500 conversas). Para contas com historico > 500 conversas, pode haver imprecisao marginal (contato com conversas muito antigas pode ser classificado como "novo")
- As resolucoes IA via fallback sao uma rede de seguranca. A solucao definitiva e garantir que o n8n esteja chamando o endpoint `log-resolution` para resolucoes IA
- Deploy da Edge Function e automatico. Backend Express requer rebuild no VPS
