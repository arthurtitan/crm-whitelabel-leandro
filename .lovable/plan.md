

## Metricas Reais de Servidor no Dashboard Super Admin

### O Que Existe Hoje

- `mockData.ts` define interfaces `ServerResources` (CPU, RAM, disco, rede) e `ServerConsumption` (historico por hora) com dados **falsos hardcoded**
- O backend Express ja tem endpoints `/admin/server-resources` e `/admin/consumption-history` mas retornam `Math.random()` e `process.memoryUsage()` -- dados simulados
- O `SuperAdminDashboard.tsx` **nao exibe nada disso** -- mostra apenas KPIs de negocio

### O Que Sera Feito

Implementar coleta **real** de metricas do servidor no backend Express (que rodara na VPS) e exibir no painel Super Admin. Quando o sistema estiver rodando no Docker na sua VPS, os dados serao reais do servidor.

---

### Mudancas

#### 1. Atualizar `backend/src/services/dashboard.service.ts` -- Metricas Reais

Substituir os metodos `getServerResources()` e `getConsumptionHistory()` por implementacoes reais usando:

- **`os` (Node.js nativo)**: CPU cores, total RAM, free RAM, uptime do sistema
- **`process.memoryUsage()`**: Memoria do processo Node.js
- **`child_process.execSync`**: Executar `df -h` para disco e `cat /proc/stat` / `cat /proc/net/dev` para CPU detalhado e rede (Linux)
- **Historico em memoria**: Array circular que armazena snapshots a cada 5 minutos (ultimas 24h = 288 pontos), persistido enquanto o processo roda

Metricas retornadas:

| Metrica | Fonte | Descricao |
|---------|-------|-----------|
| CPU % | `os.loadavg()` + `os.cpus()` | Uso medio de CPU |
| RAM usada/total | `os.totalmem()` / `os.freemem()` | Memoria do servidor |
| Disco usado/total | `df` command | Espaco em disco |
| Rede in/out | `/proc/net/dev` | Trafego de rede (Linux) |
| Uptime | `os.uptime()` | Tempo ativo do servidor |
| Node.js heap | `process.memoryUsage()` | Memoria do backend |

O historico de consumo sera coletado automaticamente com um `setInterval` a cada 5 minutos, armazenando em um array circular na memoria do processo.

#### 2. Criar `backend/src/services/metrics-collector.ts` -- Coletor Autonomo

Classe singleton que:
- Inicia com o servidor (`bootstrap()`)
- Coleta snapshot de CPU/RAM/disco/rede a cada 5 minutos
- Armazena ultimas 24h em array circular (288 pontos)
- Expoe metodos `getCurrentResources()` e `getHistory(period)`
- Funciona em Linux (VPS) com fallback para macOS/Windows (desenvolvimento)

#### 3. Atualizar `SuperAdminDashboard.tsx` -- Exibir Metricas

Adicionar secao "Monitoramento do Servidor" abaixo dos KPIs de negocio:

**Cards de recursos (tempo real):**
- CPU: barra de progresso com % de uso
- RAM: usado/total em GB com barra
- Disco: usado/total em GB com barra
- Rede: bandwidth in/out em MB/s
- Uptime: dias/horas ativo

**Grafico de historico (Recharts AreaChart):**
- Linhas de CPU e RAM nas ultimas 24h
- Toggle para alternar entre 24h / 7d / 30d
- Auto-refresh a cada 60 segundos

**Consumo semanal (BarChart):**
- Barras com media de CPU/RAM por dia da semana

#### 4. Criar componentes de UI

- `src/components/dashboard/ServerResourceCard.tsx` -- Card individual com barra de progresso
- `src/components/dashboard/ServerConsumptionChart.tsx` -- Grafico de historico com Recharts
- `src/components/dashboard/WeeklyConsumptionChart.tsx` -- Consumo semanal

#### 5. Conectar frontend ao backend

O `SuperAdminDashboard.tsx` chamara o backend Express diretamente (nao Edge Function) via `apiClient`:
- `GET /api/admin/server-resources` -- metricas atuais
- `GET /api/admin/consumption-history?period=24h` -- historico

Com auto-refresh de 60 segundos via `setInterval` no `useEffect`.

#### 6. Limpar mocks em `src/data/mockData.ts`

Remover:
- Interface `ServerConsumption`
- Interface `ServerResources`
- `mockServerConsumptionHistory`
- `getServerResources()`
- `mockWeeklyConsumption`

---

### Como Funcionara

Enquanto o sistema roda no Lovable Cloud, as metricas mostrarao dados do processo Node.js (limitados). Quando voce subir no Docker na VPS (Hostinger, AWS, etc.), as metricas serao **reais do servidor** -- CPU, RAM, disco e rede da sua maquina.

### Arquivos Modificados/Criados

| Arquivo | Acao |
|---------|------|
| `backend/src/services/metrics-collector.ts` | Criar -- coletor autonomo de metricas do OS |
| `backend/src/services/dashboard.service.ts` | Modificar -- usar metrics-collector real |
| `backend/src/server.ts` | Modificar -- iniciar metrics-collector no bootstrap |
| `src/components/dashboard/ServerResourceCard.tsx` | Criar -- card com barra de progresso |
| `src/components/dashboard/ServerConsumptionChart.tsx` | Criar -- grafico de historico |
| `src/components/dashboard/WeeklyConsumptionChart.tsx` | Criar -- consumo semanal |
| `src/pages/super-admin/SuperAdminDashboard.tsx` | Modificar -- adicionar secao de monitoramento |
| `src/data/mockData.ts` | Modificar -- remover mocks de servidor |

