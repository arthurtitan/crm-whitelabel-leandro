

# Correcao do erro de build no backend

## Problema

O `docker build` falha com 3 erros TypeScript no arquivo `backend/src/services/chatwoot-metrics.service.ts` (linhas 545-547):

- `totalLeads` nao existe como variavel nesse escopo (e calculado depois, no `return`)
- `dateFrom` e `dateTo` nao existem (os nomes corretos sao `params.dateFrom` e `params.dateTo`)

Esses erros foram introduzidos no bloco de debug log adicionado na ultima alteracao.

## Correcao

### Arquivo: `backend/src/services/chatwoot-metrics.service.ts` (linhas 543-547)

Substituir:
```typescript
      novosLeads,
      leadsInPeriod,
      totalLeads,
      dateFrom,
      dateTo,
```

Por:
```typescript
      novosLeads,
      leadsInPeriod,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
```

Remove a referencia a `totalLeads` (que so existe no return statement) e corrige `dateFrom`/`dateTo` para `params.dateFrom`/`params.dateTo`.

## Impacto

- 1 arquivo, 3 linhas alteradas
- Corrige o build do Docker que estava falhando
- Zero alteracao de logica

