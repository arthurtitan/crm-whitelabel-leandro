

## Correção: Novos Leads via API de Contatos do Chatwoot

### Problema

O cálculo atual de "Novos Leads" usa `allConversations` para encontrar a conversa mais antiga de cada contato. Porém, `allConversations` é limitado a **500 conversas** (10 páginas x 50). Se a conta tem mais conversas que isso, contatos antigos parecem "novos" porque suas conversas mais antigas não foram carregadas.

Resultado na imagem: Novos Leads = 22, Total de Leads = 22 (100% novos — incorreto).

### Solução

Usar a **API de Contatos do Chatwoot** (`GET /api/v1/accounts/{id}/contacts/{contact_id}`) para obter o `created_at` de cada contato. Este campo é imutável e representa quando o contato foi registrado pela primeira vez — independente de paginação.

### Alterações

#### 1. Backend Express — `backend/src/services/chatwoot-metrics.service.ts`

**Adicionar função** `fetchContactDetails` (após `fetchWithRetry`, ~linha 161):

```typescript
async function fetchContactDetails(
  baseUrl: string,
  accountId: string,
  contactId: number,
  headers: Record<string, string>
): Promise<{ id: number; created_at: string } | null> {
  try {
    const url = `${baseUrl}/api/v1/accounts/${accountId}/contacts/${contactId}`;
    const response = await fetchWithRetry(url, headers, 1);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}
```

**Substituir o bloco novosLeads** (linhas 600-635) — tornar `async` e usar a API de contatos:

```typescript
// NOVOS LEADS: Contatos cujo created_at na API de Contatos do Chatwoot
// está dentro do período. O created_at é imutável e não depende de paginação.
let novosLeads = await (async () => {
  const contactIdsInPeriod = [...new Set(
    finalConversations
      .map((c: any) => c.meta?.sender?.id)
      .filter(Boolean)
  )] as number[];

  if (contactIdsInPeriod.length === 0) return 0;

  let count = 0;
  const batchSize = 5;
  for (let i = 0; i < contactIdsInPeriod.length; i += batchSize) {
    const batch = contactIdsInPeriod.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(id => fetchContactDetails(baseUrl, chatwootAccountId, id, headers))
    );
    for (const contact of results) {
      if (!contact?.created_at) { count++; continue; }
      const contactCreatedAt = new Date(contact.created_at);
      if (contactCreatedAt >= dateFromParsed) { count++; }
    }
  }

  logger.info(`[Metrics] Novos Leads: ${count}/${contactIdsInPeriod.length} (via Contacts API)`);
  return count;
})();
```

#### 2. Edge Function — `supabase/functions/fetch-chatwoot-metrics/index.ts`

Mesma lógica: adicionar `fetchContactDetails` e substituir o bloco `novosLeads` (linhas 615-650) pela versão com API de contatos. A função `fetchWithRetry` já existe no arquivo.

#### 3. Documentação — `docs/METRICAS_DASHBOARD.md`

Atualizar a seção "Novos Leads" para refletir que a métrica usa `contact.created_at` da API de Contatos, não o histórico de conversas.

### Performance

Para 22 contatos: 5 lotes de ~5 requests paralelos = ~5 chamadas sequenciais. Com ~200ms cada, adiciona ~1s ao tempo total. Polling é a cada 30s, então é aceitável.

### Resultado esperado

Com os dados da imagem (30 dias, 22 leads totais):
- Total de Leads: 22 (contatos com conversas criadas no período)
- Novos Leads: apenas os que têm `contact.created_at` dentro dos 30 dias
- Retornos: 22 - Novos Leads

### Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `backend/src/services/chatwoot-metrics.service.ts` | Adicionar `fetchContactDetails`, substituir lógica novosLeads |
| `supabase/functions/fetch-chatwoot-metrics/index.ts` | Mesma alteração |
| `docs/METRICAS_DASHBOARD.md` | Documentar regra via Contacts API |
