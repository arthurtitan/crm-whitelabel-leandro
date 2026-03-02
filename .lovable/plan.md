

## Criar Documentacao das Metricas do Dashboard

Criar o arquivo `docs/METRICAS_DASHBOARD.md` com a documentacao completa de cada metrica exibida no Dashboard de Atendimento.

### Conteudo do documento

O documento cobrira todas as metricas organizadas em secoes:

**1. Arquitetura de duas camadas**
- Camada 1 (Tempo Real): conversas com status `open`, ignora filtro de data
- Camada 2 (Historico): conversas filtradas pelo periodo selecionado

**2. KPIs Principais (6 cards)**
- **Total de Leads**: COUNT(DISTINCT sender.id) das conversas no periodo
- **Novos Leads**: Contatos cujo primeiro contato historico cai dentro do periodo. Prioriza coluna `first_resolved_at` da tabela `contacts`, com fallback para inferencia via conversa mais antiga do sender
- **Retornos no Periodo**: MAX(0, Total de Leads - Novos Leads)
- **Agendamentos**: Eventos tipo `meeting`/`appointment` do calendario local no periodo
- **Tempo Medio de Resposta**: Media de `(first_reply_created_at - created_at)` para conversas com agente humano
- **Taxa de Transbordo**: `transbordo / (resolucoes_IA + transbordo) * 100`

**3. Atendimento em Tempo Real**
- Classificacao do handler atual via `classifyCurrentHandler` com 6 niveis de prioridade (human_active, AgentBot, ai_responded, etc.)

**4. Resolucao (Historico)**
- Fonte primaria: tabela `resolution_logs` (PostgreSQL)
- Fallback: classificacao via `classifyResolver` com 7 niveis de prioridade
- Detalhamento: IA explicita, bot nativo, inferida, humano explicito, humano inferido, nao classificado

**5. Taxas Calculadas**
- % Resolucao IA, % Resolucao Humano, Taxa de Transbordo, Eficiencia da IA

**6. Pico por Hora, Backlog, Performance de Agentes, Qualidade**
- Cada metrica com formula, fonte e criterio de inclusao

**7. Filtros e Periodo**
- Normalizacao para inicio/fim do dia
- Criterio de inclusao: `created_at` OU `last_activity_at` dentro do intervalo

**8. Glossario**
- Sender, Assignee, AgentBot, Transbordo, Resolution Log, custom_attributes

### Arquivo a criar
- `docs/METRICAS_DASHBOARD.md`

