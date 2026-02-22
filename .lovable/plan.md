

## Correcao: Icons saindo dos KPI Cards

### Problema
Em telas largas (1280px+), o grid de 6 colunas torna os cards muito estreitos. Titulos longos como "TEMPO MEDIO RESPOSTA" e "TAXA DE TRANSBORDO" empurram os icones para fora dos limites do card porque nao ha restricao de overflow.

### Solucao

**Arquivo: `src/components/dashboard/KPICard.tsx`**

Duas mudancas:

1. Adicionar `overflow-hidden` ao Card para garantir que nada saia dos limites
2. Reduzir o tamanho do icone e padding em telas pequenas para economizar espaco horizontal

**Detalhes tecnicos:**
- Linha 50: Adicionar `overflow-hidden` na classe do Card
- Linha 57: Reduzir padding do container do icone para `p-1` em mobile e `sm:p-1.5` em telas maiores
- Linha 58: Reduzir icone para `w-3.5 h-3.5 sm:w-4 sm:h-4`

Isso garante que mesmo em colunas estreitas, o icone e o titulo fiquem contidos dentro do card.

