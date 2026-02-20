
## Adicionar Card "Retornos no Período"

### O que será feito

Adicionar um novo KPI Card no dashboard que exibe a contagem de contatos que **reentraram em contato** no período selecionado — ou seja, contatos que já tinham conversas anteriores e voltaram a entrar em contato.

A fórmula é simples e confiável porque já temos os dois componentes calculados:

```
Retornos no Período = Total de Leads - Novos Leads
```

- **Total de Leads**: todas as conversas com atividade no período (novas + retornos)
- **Novos Leads**: apenas contatos cujo `first_resolved_at` é NULL ou caiu no período
- **Retornos**: a diferença entre os dois — quem não é novo, é retorno

---

### Arquivos alterados

#### 1. `supabase/functions/fetch-chatwoot-metrics/index.ts`

Na resposta final (linha 823), adicionar o campo `retornosNoPeriodo` calculado diretamente:

```typescript
// Dentro do objeto data da response:
retornosNoPeriodo: Math.max(0, finalConversations.length - novosLeads),
```

O `Math.max(0, ...)` evita valores negativos em casos de borda onde `novosLeads` pudesse ser maior que `finalConversations.length`.

#### 2. `src/pages/admin/AdminDashboard.tsx`

**Mapeamento em `displayedData`** — adicionar `retornosNoPeriodo` nos três locais onde `kpis` é construído (estado inicial vazio, visão por agente, e visão geral):

```typescript
// Nos três blocos de kpis:
retornosNoPeriodo: 0,                          // default
retornosNoPeriodo: metricsData.retornosNoPeriodo ?? 0,  // visão geral
```

**Novo KPI Card** — inserir após o card "Novos Leads" (linha 315), antes de "Agendamentos":

```tsx
<KPICard
  title="Retornos no Período"
  subtitle={getAgentContextSubtitle('Reentraram em contato')}
  value={displayedData.kpis.retornosNoPeriodo}
  icon={RefreshCw}
  iconColor="text-warning"
  iconBgColor="bg-warning/10"
  isLoading={isLoading}
/>
```

**Import** — adicionar `RefreshCw` ao import de `lucide-react` (linha 5).

---

### Resultado visual esperado

A grid de KPIs passará de 5 para 6 cards:

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ Total de     │ Novos Leads  │ Retornos     │ Agendamentos │ Tempo Médio  │ Taxa de      │
│ Leads        │              │ no Período   │              │ Resposta     │ Transbordo   │
│              │ Primeiro     │ Reentraram   │              │              │              │
│ 4            │ contato no   │ em contato   │ 0            │ 2m30s        │ 25%          │
│              │ período      │              │              │              │              │
│              │              │              │              │              │              │
│              │ 1            │ 3            │              │              │              │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

- O CSS `kpi-grid-6` já está configurado para suportar 6 cards, então nenhuma mudança de layout é necessária.

---

### Arquivos alterados

1. **`supabase/functions/fetch-chatwoot-metrics/index.ts`** — adicionar `retornosNoPeriodo` na resposta (1 linha)
2. **`src/pages/admin/AdminDashboard.tsx`** — mapear o novo campo nos `kpis` + adicionar o `KPICard` + importar `RefreshCw`
