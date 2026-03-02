
Objetivo: corrigir de forma definitiva o consumo + exibição das métricas do Chatwoot no ambiente de produção (frontend + backend + Postgres), sem regressões.

Diagnóstico consolidado (com base na revisão do código e testes):
1) O fluxo de consumo no frontend está ligado corretamente:
- `AdminDashboard` usa `useChatwootMetrics`.
- Em modo backend (`VITE_USE_BACKEND=true`), o hook chama `POST /api/chatwoot/metrics`.
- O parser do hook já aceita `{ success, data }`.

2) A integração Chatwoot (credenciais fornecidas) está válida:
- A consulta real com `url=https://atendimento.gleps.com.br`, `accountId=1`, `token` retorna conversas/agentes.
- Isso confirma que o problema não é “token inválido” em si.

3) Ponto frágil identificado no backend atual:
- Em `chatwoot-metrics.service.ts`, a coleta de conversas pode degradar silenciosamente (retornar `[]`) quando há falha parcial de API/paginação/status.
- Mesmo assim, o serviço segue “com sucesso” e devolve KPIs de volume zerados (Total Leads, Novos Leads, etc.), enquanto a parte de resolução pode vir do banco (`resolution_logs`) — exatamente o padrão visto na tela.

4) Problema adicional de consistência de período:
- Filtros “7 dias/30 dias” hoje usam timestamp “agora - N dias”, não o dia cheio.
- Isso pode excluir dados do primeiro/último dia e passar sensação de “sumiu dado”.

Plano de correção definitiva (implementação):
Fase 1 — Blindagem do backend de métricas (principal)
Arquivo: `backend/src/services/chatwoot-metrics.service.ts`

1.1 Tornar a busca de conversas resiliente por estratégia em camadas:
- Tentativa A: `status=all` paginado.
- Tentativa B (fallback automático): buscar por status separados (`open`, `pending`, `resolved`, `snoozed`) e mesclar por `conversation_id`.
- Extrator robusto de payload para múltiplos formatos de resposta (`data.payload`, `payload`, array direto).

1.2 Eliminar degradação silenciosa:
- Se a coleta falhar tecnicamente (HTTP != 2xx, timeout, payload inválido) e não houver dados confiáveis, lançar erro explícito (não retornar métricas zeradas “como sucesso”).
- Só retornar zero quando for zero real, com fetch saudável.

1.3 Adicionar metadados de saúde no retorno (sem quebrar contrato existente):
- Manter `success: true, data: ...`.
- Acrescentar em `data._debug` campos de rastreio: `fetchMode`, `pagesFetched`, `fallbackUsed`, `chatwootFetchHealthy`.
- Isso ajuda suporte e diagnóstico em produção.

Fase 2 — Consistência de período (dados condizentes com o calendário)
Arquivos:
- `src/pages/admin/AdminDashboard.tsx`
- `backend/src/controllers/chatwoot.controller.ts` (ou no service, centralizado)

2.1 Normalizar datas para período inclusivo:
- `dateFrom` no início do dia.
- `dateTo` no fim do dia.
- Aplicar para filtros 7d/30d/custom para evitar cortes por horário.

2.2 Garantir timezone consistente:
- Padronizar cálculo do período em UTC internamente, mantendo exibição no timezone da conta.
- Evitar discrepância entre frontend e backend.

Fase 3 — UX de erro correta (não mascarar falha como “0”)
Arquivos:
- `src/hooks/useChatwootMetrics.ts`
- `src/pages/admin/AdminDashboard.tsx`

3.1 Se backend informar falha de fetch Chatwoot:
- Exibir alerta de integração indisponível com ação de “Tentar novamente”.
- Preservar último dado válido em tela (quando existir), evitando salto para zero falso.

3.2 Diferenciar estados:
- “Sem dados no período” (estado válido) vs “Erro de integração” (estado inválido).

Fase 4 — Verificação de deploy (para encerrar divergência produção x código)
Arquivos:
- `backend/src/server.ts` (exposição de versão/build)
- opcional: health payload

4.1 Expor versão do build no `/api/health` (ex.: commit SHA/env var) para confirmar que produção está realmente com o backend corrigido.
4.2 Checklist pós-deploy:
- backend saudável
- frontend apontando para `/api`
- chamada `POST /api/chatwoot/metrics` retornando `chatwootFetchHealthy=true`
- cards e gráficos com valores coerentes para 7d, 30d e período custom.

Critérios de aceite (definitivos):
1) Com as credenciais da conta Chatwoot informada, os cards deixam de ficar zerados quando existem conversas no período.
2) Em falha de integração real, o usuário vê erro explícito (não “0” silencioso).
3) Filtro de período exibe dados consistentes com o calendário selecionado.
4) Importação de agentes continua funcionando (sem regressão).
5) Produção e ambiente de teste passam a entregar os mesmos resultados para o mesmo período.

Risco e mitigação:
- Risco: alterar parser de conversa e impactar contas com versões diferentes do Chatwoot.
- Mitigação: manter estratégia em camadas + fallback de status + merge por ID + logs de diagnóstico, com contrato de resposta compatível.

Arquivos previstos para ajuste:
- `backend/src/services/chatwoot-metrics.service.ts` (principal)
- `backend/src/controllers/chatwoot.controller.ts` (normalização/validação de período, se necessário)
- `src/pages/admin/AdminDashboard.tsx` (ajuste do intervalo enviado)
- `src/hooks/useChatwootMetrics.ts` (tratamento de erro/degradação)
- `backend/src/server.ts` (health/version para validação de deploy)
