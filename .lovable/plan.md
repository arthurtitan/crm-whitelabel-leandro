

# Corrigir rota "super-admin-kpis" no modo backend

## Problema

O frontend chama `GET /api/dashboard/super-admin/kpis`, mas o backend registra a rota de KPIs do Super Admin em `/api/admin/kpis`. Resultado: "Rota nao encontrada: GET /api/dashboard/super-admin-admin/kpis".

## Causa raiz

No arquivo `src/api/endpoints.ts`, o endpoint esta definido como:
```
SUPER_ADMIN_KPIS: '/api/dashboard/super-admin/kpis'
```

Porem no backend (`backend/src/routes/index.ts`), o `adminRouter` esta montado em `/admin`, gerando a rota real `/api/admin/kpis`.

## Correcao

Atualizar o endpoint no arquivo `src/api/endpoints.ts` para apontar para a rota correta do backend:

```text
Antes:  SUPER_ADMIN_KPIS: '/api/dashboard/super-admin/kpis'
Depois: SUPER_ADMIN_KPIS: '/api/admin/kpis'
```

Apenas uma linha precisa ser alterada. Nenhuma mudanca no backend.

## Impacto

- O SuperAdminDashboard ja usa `API_ENDPOINTS.DASHBOARD.SUPER_ADMIN_KPIS`, entao a correcao se propaga automaticamente.
- As demais rotas de admin (`SERVER_RESOURCES`, `CONSUMPTION_HISTORY`, `WEEKLY_CONSUMPTION`) ja estao corretas apontando para `/api/admin/...`.
- Nenhuma mudanca de backend ou banco de dados necessaria.

