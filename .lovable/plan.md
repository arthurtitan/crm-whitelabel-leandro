

## Problema

O card "Leads Convertidos" no funil financeiro sempre mostra **0** porque:

1. **`TagContext.leadTags` nunca é preenchido em modo backend** — é inicializado como `[]` e só o `AdminKanbanPage` busca lead_tags (em estado local próprio), sem propagar para o contexto global.
2. **`FinanceContext.kpis.leadsConvertidos`** depende de `tagContext.leadTags` para contar leads nas etapas selecionadas — como está vazio, o resultado é sempre 0.
3. O card **não exibe quais etapas estão selecionadas** como "finais", dificultando o diagnóstico.

## Correção

### 1. `src/contexts/TagContext.tsx` — Buscar leadTags do backend

Adicionar fetch de lead_tags no `useEffect` que já busca tags, usando a mesma API `/api/lead-tags` usada pelo Kanban:

```typescript
// Após buscar tags do backend, também buscar lead_tags
useEffect(() => {
  if (!useBackend || !accountId) return;
  
  tagsBackendService.listAllTags(accountId).then(setTags).catch(console.error);
  
  // Fetch lead_tags para cálculo de KPIs
  apiClient.get('/api/lead-tags', { params: { accountId } })
    .then((response: any) => {
      const data = Array.isArray(response) ? response : (response?.data || []);
      setLeadTags(data);
    })
    .catch(console.error);
}, [accountId]);
```

### 2. `src/components/finance/FunnelConversionChart.tsx` — Mostrar nomes das etapas selecionadas

Abaixo do número de "Leads Convertidos", exibir as etapas selecionadas como badges para dar contexto visual:

```typescript
// No card de Leads Convertidos, após o valor:
{step.configurable && finalStageIds.length > 0 && (
  <div className="flex flex-wrap gap-1 justify-center mt-1">
    {stageTags
      .filter(s => finalStageIds.includes(s.id))
      .map(s => (
        <span key={s.id} className="text-[9px] px-1.5 py-0.5 rounded-full bg-background/50" 
              style={{ borderLeft: `2px solid ${s.color}` }}>
          {s.name}
        </span>
      ))}
  </div>
)}
```

### Impacto

- 2 arquivos modificados: `TagContext.tsx`, `FunnelConversionChart.tsx`
- O KPI `leadsConvertidos` passará a refletir a contagem real de leads nas etapas selecionadas
- O card mostrará visualmente quais etapas estão configuradas como conversão

