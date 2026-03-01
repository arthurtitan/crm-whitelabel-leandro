

# Correcao: Leads zerados e Taxa de Transbordo no Backend Express

## Diagnostico completo

Apos analisar todo o fluxo de dados, identifiquei **4 problemas** no arquivo `backend/src/services/chatwoot-metrics.service.ts` que causam as metricas zeradas:

### Bug 1: `ai_participated = true` hardcodado (linha 480)
Toda resolucao humana e gravada como `ai_participated: true`, causando transbordo de 100%.

### Bug 2: `ON CONFLICT DO NOTHING` (linha 481)
Registros antigos corrompidos nunca sao corrigidos. Precisa ser `ON CONFLICT DO UPDATE`.

### Bug 3: `novosLeads` sobrescrito incorretamente (linhas 493-519)
Quando a coluna `first_resolved_at` existe na tabela `contacts`, o sistema tenta buscar leads pelo `chatwootContactId`. Se os contatos do Chatwoot nao estao sincronizados na tabela `contacts` do CRM (o que e provavel), a query retorna 0 registros e **sobrescreve** o valor correto de `novosLeads` com 0. Isso faz `conversasAtivas` (Novos Leads no frontend) e consequentemente `retornosNoPeriodo` ficarem errados.

### Bug 4: Falta de logs de diagnostico
Nao ha como saber remotamente se o problema e na API do Chatwoot, no filtro de datas, ou na query ao banco.

## Correcoes propostas

### Arquivo: `backend/src/services/chatwoot-metrics.service.ts`

**Alteracao 1 (linhas 477-486):** Corrigir `ai_participated` e trocar para UPSERT:

```typescript
// De:
await prisma.$executeRaw`
  INSERT INTO resolution_logs (..., ai_participated, ...)
  VALUES (..., true, ...)
  ON CONFLICT DO NOTHING
`;

// Para:
const aiParticipated =
  custom.ai_responded === true || additional.ai_responded === true ||
  custom.ai_participated === true || additional.ai_participated === true ||
  custom.handoff_to_human === true || additional.handoff_to_human === true;

await prisma.$executeRaw`
  INSERT INTO resolution_logs (account_id, conversation_id, resolved_by, resolution_type, ai_participated, resolved_at)
  VALUES (${dbAccountId}::uuid, ${conv.id}, 'human', 'inferred', ${aiParticipated}, ${resolvedAt})
  ON CONFLICT (account_id, conversation_id)
  DO UPDATE SET ai_participated = ${aiParticipated}, resolved_at = ${resolvedAt}
`;
```

**Alteracao 2 (linhas 493-519):** Corrigir a logica de `novosLeads` para NAO sobrescrever com 0 quando a tabela contacts nao tem dados sincronizados:

```typescript
// De:
if (firstResolvedAtAvailable) {
  // ... query contacts
  novosLeads = contacts.filter(...).length;  // Pode ser 0!
}

// Para:
if (firstResolvedAtAvailable) {
  // ... query contacts
  if (contacts.length > 0) {
    // So sobrescreve se o banco TEM dados sincronizados
    novosLeads = contacts.filter(...).length;
  }
  // Se contacts.length === 0, manter o valor calculado via conversas
}
```

Esta e a correcao principal do bug de leads. O valor inicial de `novosLeads` (linhas 430-438) ja esta correto -- conta sender IDs unicos de conversas criadas no periodo. Mas a query ao banco (que retorna 0 por falta de sync) sobrescreve esse valor bom com 0.

**Alteracao 3:** Adicionar logs de debug detalhados apos o calculo de leads para diagnostico remoto:

```text
[Metrics][Leads] {
  allConversationsCount, finalConversationsCount,
  uniqueSenderIds, novosLeads, leadsInPeriod,
  contactsFoundInDB, path: 'DB' | 'fallback' | 'initial'
}
```

### SQL para PostgreSQL de producao

Executar diretamente no banco de producao para limpar dados corrompidos:

```sql
-- 1. Corrigir ai_participated em resolucoes inferidas
UPDATE resolution_logs
SET ai_participated = false
WHERE resolution_type = 'inferred' AND ai_participated = true;

-- 2. Remover duplicatas (manter mais recente)
DELETE FROM resolution_logs a USING resolution_logs b
WHERE a.id < b.id
  AND a.account_id = b.account_id
  AND a.conversation_id = b.conversation_id;

-- 3. Garantir unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "resolution_logs_account_id_conversation_id_key"
  ON resolution_logs(account_id, conversation_id);
```

## Resultado esperado

Apos as correcoes:
- **Total de Leads**: Contatos unicos com atividade no periodo (ex: 22 para 30 dias)
- **Novos Leads**: Contatos cujo primeiro contato historico caiu no periodo
- **Retornos**: Total - Novos
- **Taxa de Transbordo**: 0% (conta sem IA ativa)

## Impacto

- 1 arquivo alterado: `backend/src/services/chatwoot-metrics.service.ts`
- 1 SQL de limpeza para PostgreSQL de producao
- Zero alteracao no frontend
- Deploy necessario no backend para aplicar as mudancas

