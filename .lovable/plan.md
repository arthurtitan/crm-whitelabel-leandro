

## Correcao: Dashboard KPIs inflados + Kanban sync incompleto

### Problema 1 -- Dashboard: metricas infladas por etiquetas

**Linha 474 de `chatwoot-metrics.service.ts`:**

```typescript
return (createdAt >= dateFromParsed && createdAt <= dateToParsed) ||
       (activityDate >= dateFromParsed && activityDate <= dateToParsed);
```

Quando uma etiqueta do Kanban e adicionada/movida, o Chatwoot atualiza `last_activity_at` da conversa para "agora". Isso faz conversas antigas (criadas ha meses) aparecerem no "Total de Leads" do periodo atual. Cada etiqueta adicionada = +1 no Total de Leads.

**Correcao:** Filtrar conversas historicas APENAS por `created_at`. Atividade administrativa (labels, atribuicoes) nao deve alterar contagem de leads.

```typescript
// Antes (linha 474):
return (createdAt >= dateFromParsed && createdAt <= dateToParsed) ||
       (activityDate >= dateFromParsed && activityDate <= dateToParsed);

// Depois:
return (createdAt >= dateFromParsed && createdAt <= dateToParsed);
```

**Arquivo:** `backend/src/services/chatwoot-metrics.service.ts` (linhas 463-476)

Remover completamente o calculo de `activityDate` (linhas 468-472) e simplificar o filtro.

---

### Problema 2 -- Kanban: sync nao busca todas as conversas

**Linha 740 de `chatwoot.service.ts`:**

```typescript
const response = await this.makeRequest<any>(config, `/conversations?page=${page}`);
```

Sem `status=all`, a API do Chatwoot retorna apenas conversas `open`. Leads com conversas resolvidas/pendentes que possuem labels sao ignorados.

**Correcao:**

```typescript
const response = await this.makeRequest<any>(config, `/conversations?status=all&page=${page}`);
```

**Arquivo:** `backend/src/services/chatwoot.service.ts` (linha 740)

---

### Problema 3 -- Documentacao desatualizada

**Arquivo:** `docs/METRICAS_DASHBOARD.md` (linhas 257-263)

O documento diz que conversas sao incluidas se `created_at` OU `last_activity_at` esta no periodo. Precisa ser atualizado para refletir que apenas `created_at` e usado.

**Antes:**
```
Uma conversa e incluida no periodo se:
- created_at esta dentro do intervalo OU
- last_activity_at esta dentro do intervalo
```

**Depois:**
```
Uma conversa e incluida no periodo se:
- created_at esta dentro do intervalo

Mudancas administrativas (etiquetas, atribuicoes de agente) NAO alteram
a contagem de leads no periodo pois nao modificam o created_at.
```

---

### Resumo

| Arquivo | Mudanca |
|---------|---------|
| `backend/src/services/chatwoot-metrics.service.ts` | Remover `last_activity_at` do filtro de conversas historicas (linhas 463-476) |
| `backend/src/services/chatwoot.service.ts` | Adicionar `status=all` ao endpoint de sync (linha 740) |
| `docs/METRICAS_DASHBOARD.md` | Atualizar criterio de inclusao (linhas 257-263) |

### Impacto

- **Dashboard**: Total de Leads refletira apenas conversas CRIADAS no periodo -- etiquetas nao inflam mais
- **Kanban**: Sync buscara TODAS as conversas (abertas, resolvidas, pendentes, snoozed), importando leads com labels corretamente
- **Atendimento ao Vivo e Backlog**: Nao afetados (ja usam filtros separados de conversas abertas)

