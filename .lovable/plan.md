

# Substituir Dados Mockados do SuperAdminDashboard por KPIs Reais

## Objetivo
Remover todos os dados fictícios do painel Super Admin e buscar KPIs reais diretamente do banco de dados (contas, usuarios, vendas, contatos). Os graficos de servidor (CPU, RAM, Disco, Rede) serao removidos ja que nao ha API de infraestrutura disponivel.

## O que muda

### 1. Criar edge function `super-admin-kpis`
Uma nova backend function que busca os KPIs reais:
- Total de contas e contas ativas/pausadas
- Total de usuarios e usuarios ativos
- Total de contatos
- Total de vendas pagas e receita total
- Vendas recentes (ultimos 30 dias) para o grafico

A funcao valida que o usuario autenticado tem role `super_admin` antes de retornar dados.

### 2. Refatorar `SuperAdminDashboard.tsx`
- Remover imports de `mockData` (getSuperAdminKPIs, getServerResources, mockServerConsumptionHistory, mockWeeklyConsumption)
- Adicionar `useEffect` + `useState` para buscar dados da edge function
- Manter os 4 KPI cards (Total Contas, Total Usuarios, Ativas, Pausadas)
- Remover os 4 cards de servidor (CPU, RAM, Disco, Rede)
- Remover os 4 graficos de consumo de servidor (CPU/RAM 24h, Rede 24h, Semanal, Disco)
- Remover o card de recomendacoes de escalabilidade
- Adicionar novos cards uteis com dados reais: Total de Contatos, Total de Vendas Pagas, Receita Total
- Adicionar estado de loading com skeletons

### 3. Configuracao
- Adicionar em `supabase/config.toml`: `verify_jwt = false` para a nova funcao
- Validacao de super_admin feita dentro da funcao via service role key

---

## Detalhes Tecnicos

### Edge Function: `supabase/functions/super-admin-kpis/index.ts`

```text
Endpoint: POST /super-admin-kpis
Auth: Bearer token do usuario logado
Validacao: Verifica user_roles para confirmar super_admin

Retorno:
{
  totalAccounts: number,
  activeAccounts: number,
  pausedAccounts: number,
  totalUsers: number,
  activeUsers: number,
  totalContacts: number,
  totalPaidSales: number,
  totalRevenue: number
}
```

### SuperAdminDashboard.tsx
- Usa `supabase.functions.invoke('super-admin-kpis')` para buscar dados
- KPI cards: 7 cards com dados reais (Contas, Usuarios, Contatos, Vendas, Receita)
- Loading state com `Skeleton` components
- Tratamento de erro com `toast`

### Itens removidos
- Cards de CPU, RAM, Disco, Rede
- Graficos de consumo 24h e semanal
- Card de recomendacoes de escalabilidade
- Todas as referencias a `mockServerConsumptionHistory`, `mockWeeklyConsumption`, `getServerResources`

