## Metricas Reais de Servidor no Dashboard Super Admin

### Status: ✅ IMPLEMENTADO

### O Que Foi Feito

1. **`backend/src/services/metrics-collector.ts`** — Coletor singleton de métricas reais do OS:
   - CPU via `os.cpus()` com delta entre coletas
   - RAM via `os.totalmem()` / `os.freemem()`
   - Disco via `df -B1 /` (Linux/macOS) com fallback Windows
   - Rede via `/proc/net/dev` (Linux)
   - Histórico circular de 288 pontos (24h a cada 5min)

2. **`backend/src/services/dashboard.service.ts`** — Métodos `getServerResources()` e `getConsumptionHistory()` agora usam dados reais do metrics-collector

3. **`backend/src/server.ts`** — Collector inicia automaticamente no bootstrap

4. **Frontend atualizado:**
   - `src/components/dashboard/ServerResourceCard.tsx` — Card com barra de progresso colorida
   - `src/components/dashboard/ServerConsumptionChart.tsx` — AreaChart CPU/RAM com toggle 24h/7d/30d
   - `src/components/dashboard/WeeklyConsumptionChart.tsx` — BarChart médias semanais
   - `src/pages/super-admin/SuperAdminDashboard.tsx` — Seção completa de monitoramento com auto-refresh 60s

5. **Limpeza:** Removidas interfaces `ServerResources`, `ServerConsumption` e mocks do `mockData.ts`

### Endpoints da API

- `GET /api/admin/server-resources` — Métricas atuais
- `GET /api/admin/consumption-history?period=24h` — Histórico
- `GET /api/admin/weekly-consumption` — Consumo semanal médio
