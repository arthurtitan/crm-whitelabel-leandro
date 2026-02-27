
# Solucao Definitiva: Backend de Metricas Chatwoot

## Diagnostico Real (sem suposicoes)

O problema NAO e formato de timestamp nem versao de API. O problema e **arquitetural**:

1. **Edge Function (funciona)**: Busca conversas, agentes e inboxes diretamente da API do Chatwoot, depois calcula TUDO localmente (~700 linhas de logica de negocio). Nunca chama `/reports/summary`. Tambem consulta `resolution_logs` no banco para metricas persistentes de resolucao.

2. **Backend Express (quebrado)**: Chama `GET /reports/summary` que **nao existe** na sua instancia Chatwoot (retorna 404). Alem disso, mesmo que existisse, retornaria dados crus do Chatwoot — nao o formato `DashboardMetrics` que o frontend espera (atendimento, resolucao, taxas, backlog, agentes, etc.).

**A solucao e portar a logica da Edge Function para o backend Express.**

## Plano de Implementacao

### 1. Criar servico dedicado de metricas no backend

**Arquivo novo:** `backend/src/services/chatwoot-metrics.service.ts`

Portar a logica completa da Edge Function para o backend Express:
- `fetchAllConversations()` — busca paginada de conversas (max 500)
- `fetchAgents()` — lista agentes
- `fetchInboxes()` — lista canais
- `classifyCurrentHandler()` — classificacao tempo real (IA/humano/nenhum)
- `classifyResolver()` — classificacao historica de resolucao
- Calculo de metricas: atendimento, resolucao, taxas, backlog, pico por hora, performance de agentes, conversas por canal
- Consulta a tabela `resolution_logs` via Prisma para metricas persistentes de resolucao
- Retorno no formato exato `DashboardMetrics` que o frontend espera

### 2. Atualizar o controller de metricas

**Arquivo:** `backend/src/controllers/chatwoot.controller.ts`

Substituir a chamada a `chatwootService.getAccountMetrics()` (que usa `/reports/summary`) pela nova logica do servico de metricas dedicado. Recebe `dateFrom`, `dateTo`, `inboxId`, `agentId` do body e retorna `{ success: true, data: DashboardMetrics }`.

### 3. Manter o servico original para outras operacoes

**Arquivo:** `backend/src/services/chatwoot.service.ts`

O metodo `getAccountMetrics` sera deprecado/removido. As demais funcoes (agents, labels, conversations, inboxes, webhooks) permanecem intactas — usam `/api/v1/` corretamente e funcionam.

### 4. Adicionar modelo Prisma para resolution_logs (se necessario)

Verificar se o schema Prisma ja inclui a tabela `resolution_logs`. Se nao, adicionar o model para que o servico possa consultar resolucoes persistentes.

## Detalhes Tecnicos

### Fluxo de dados do novo servico

```text
Frontend POST /api/chatwoot/metrics
  { dateFrom, dateTo, inboxId, agentId }
       |
       v
Backend Controller
       |
       v
chatwoot-metrics.service.ts
       |
       +---> Chatwoot API: GET /conversations (paginado)
       +---> Chatwoot API: GET /agents
       +---> Chatwoot API: GET /inboxes
       +---> Prisma: SELECT resolution_logs WHERE account_id AND resolved_at IN range
       |
       v
Calculo local de metricas
       |
       v
{ success: true, data: DashboardMetrics }
```

### Metricas calculadas localmente (identico a Edge Function)

- **Camada 1 (Tempo Real)**: Conversas abertas classificadas por handler (IA/humano/sem assignee), backlog por faixa de tempo
- **Camada 2 (Historico)**: Resolucoes do `resolution_logs` (IA vs humano), taxas de transbordo, eficiencia
- **Performance**: Agentes com atendimentos assumidos, resolvidos, tempo medio de resposta
- **Distribuicao**: Conversas por canal (inbox), pico por hora (timezone Sao Paulo)
- **Qualidade**: Conversas sem resposta, novos leads no periodo

### Vantagens desta abordagem

- **Funciona com qualquer versao do Chatwoot** — nao depende de `/reports/summary`
- **Formato identico ao que o frontend ja consome** — zero mudancas no frontend
- **Metricas persistentes** — resolucoes vem do `resolution_logs`, nao desaparecem
- **Logica testada** — a Edge Function ja roda em producao com esta mesma logica

## Sequencia de Execucao

1. Verificar schema Prisma para `resolution_logs`
2. Criar `backend/src/services/chatwoot-metrics.service.ts` (portar logica da Edge Function)
3. Atualizar `backend/src/controllers/chatwoot.controller.ts` para usar novo servico
4. Rebuild no EasyPanel
