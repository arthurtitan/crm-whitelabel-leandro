

## Fix: Icons saindo dos KPI Cards

### Problema
Os icones estao sendo empurrados para fora dos cards porque os titulos longos (ex: "TOTAL DE LEADS", "TAXA DE TRANSBORDO") ocupam muito espaco horizontal, forcando o icone para fora do container.

### Solucao

**Arquivo: `src/components/dashboard/KPICard.tsx`**

Ajustar o layout do header para garantir que o icone nunca saia do card:

1. Adicionar `min-w-0` no container do titulo para permitir que o texto quebre corretamente sem empurrar o icone
2. Reduzir o titulo para `text-[9px] sm:text-[10px]` para caber melhor em colunas estreitas
3. Garantir que o icone tenha `shrink-0` (ja tem) e que o flex container respeite os limites

**Mudanca principal no header:**
```
<div className="flex items-start justify-between gap-2">
  <p className="min-w-0 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-tight">
    {title}
  </p>
  <div className={cn('p-1.5 rounded-lg shrink-0', iconBgColor)}>
    <Icon className={cn('w-4 h-4', iconColor)} />
  </div>
</div>
```

A chave e o `min-w-0` no texto que permite ele encolher em vez de empurrar o icone para fora, e remover o `flex` extra no container do icone que pode causar problemas de sizing.

