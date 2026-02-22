

## Correcao Definitiva: KPI Card Icons

### Problema Raiz

Ha **duplo padding** no KPI Card:
- O componente `Card` (card.tsx) aplica `p-5` por padrao
- O `CardContent` dentro do KPICard aplica `p-4 sm:p-5` adicional
- Isso consome ~40-50px de espaco horizontal desnecessariamente, deixando pouco espaco para titulo + icone em colunas estreitas

Alem disso, o titulo precisa de `overflow-hidden` junto com `min-w-0` para garantir que o texto nunca empurre o icone.

### Solucao

**Arquivo 1: `src/components/dashboard/KPICard.tsx`**

Reescrever o layout do header com as melhores praticas de flex layout:

1. Remover o padding do Card via `p-0` no className (anular o `p-5` herdado)
2. Manter apenas o padding do CardContent (`p-4 sm:p-5`) como unico controle de spacing
3. Adicionar `overflow-hidden` no container do titulo para cortar texto longo sem empurrar o icone
4. Usar `flex-1 min-w-0` no wrapper do titulo (padrao correto para flex items que devem encolher)

Estrutura final do header:
```
<div className="flex items-start justify-between gap-2">
  <p className="flex-1 min-w-0 overflow-hidden text-ellipsis text-[9px] sm:text-[10px] ...">
    {title}
  </p>
  <div className="p-1 sm:p-1.5 rounded-lg shrink-0 ...">
    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 ..." />
  </div>
</div>
```

**Arquivo 2: Nenhuma outra mudanca necessaria**

O `overflow-hidden` no Card e o ajuste de grid no `index.css` ja estao corretos das iteracoes anteriores.

### Detalhes Tecnicos

No `KPICard.tsx`:
- Linha 50: Adicionar `p-0` ao Card para anular o padding base herdado
- Linha 54: Adicionar `flex-1 overflow-hidden text-ellipsis` ao titulo `<p>`

Isso resolve definitivamente o problema pois:
- O titulo nunca pode ultrapassar o espaco disponivel (overflow-hidden corta)
- O icone sempre mantem sua posicao fixa (shrink-0)
- Nao ha padding duplicado desperdicando espaco

