

## Correção: Página Insights crashando mesmo com conta válida

### Diagnóstico real

O problema **não é** o nome do perfil (a correção anterior do `getInitials` já está aplicada). O crash real acontece **antes** da renderização, nos `useMemo` que processam dados.

A causa são chamadas inseguras a `parseISO()` e `isWithinInterval()` em **17 pontos** do arquivo. Quando qualquer campo de data (`created_at`, `paid_at`, `start`) vem como `null` ou `undefined` da API, `parseISO(undefined)` retorna `Invalid Date`, e `isWithinInterval(Invalid Date, ...)` lança exceção — derrubando toda a página.

### Pontos de crash confirmados

```text
Linha 115: parseISO(sale.created_at)      — filtro de vendas
Linha 139: parseISO(contact.created_at)   — filtro de leads
Linha 152: parseISO(event.start)          — filtro de agendamentos
Linha 257: parseISO(sale.created_at)      — análise temporal (3x)
Linha 333: parseISO(contact.created_at)   — ciclo de venda
Linha 334: parseISO(sale.paid_at)         — ciclo de venda (paid_at é nullable!)
Linha 371: parseISO(sale.paid_at)         — velocidade conversão
Linha 519: parseISO(temporalData.worstDay.date) — insight temporal
```

O campo `paid_at` é **explicitamente nullable** no tipo `Sale`, e `event.start` pode vir vazio da API do calendário.

### Correção

Criar uma função `safeParse` no início do componente que retorna `null` para datas inválidas, e ajustar todos os `useMemo` para filtrar registros com datas inválidas em vez de crashar:

```typescript
const safeParse = (val: string | null | undefined): Date | null => {
  if (!val) return null;
  try {
    const d = parseISO(val);
    return isNaN(d.getTime()) ? null : d;
  } catch { return null; }
};
```

Cada `filter` e `forEach` passará a validar a data antes de usá-la:
```typescript
// Antes (crasha):
const saleDate = parseISO(sale.created_at);
const inDateRange = isWithinInterval(saleDate, ...);

// Depois (seguro):
const saleDate = safeParse(sale.created_at);
if (!saleDate) return false;
const inDateRange = isWithinInterval(saleDate, ...);
```

### Arquivo alterado

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/admin/AdminInsightsPage.tsx` | Adicionar `safeParse` + proteger 17 chamadas de `parseISO` nos useMemo de filtros, temporal, marketing, velocidade e insights automáticos |

### Resultado

A página Insights carrega normalmente com a conta `medeiros@gleps.com`, mesmo que algum registro tenha data nula ou inválida — esses registros são simplesmente ignorados nos cálculos.

