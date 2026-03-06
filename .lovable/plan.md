
Objetivo: destravar a sincronização do Google Calendar e eliminar o erro recorrente `calendarEvent.upsert` com UUID inválido (`found 'n' at 1`).

1) Diagnóstico confirmado
- Pelos logs, o backend em execução ainda está chamando `prisma.calendarEvent.upsert()` no `dist/services/calendar.service.js` (linha ~309), que é exatamente o caminho legado com fallback inválido (`'new'`).
- O erro em loop ocorre a cada ~30s por causa do polling automático de sync no frontend.

2) Ajustes de implementação (código)
- `backend/src/services/calendar.service.ts`
  - Reforçar o fluxo seguro (lookup por `googleEventId` + `update`/`create`) e remover qualquer possibilidade de fallback em `id`.
  - Padronizar erros de sync com `AppError` (ex.: `GOOGLE_SYNC_FAILED`) para não virar “Erro interno do servidor” genérico.
  - Garantir retorno de métricas `{ synced, created, updated, skipped }` para diagnóstico.
- `backend/src/controllers/calendar.controller.ts`
  - Propagar mensagens operacionais de sync sem mascarar (via `AppError`) para o frontend.
- `src/contexts/CalendarContext.tsx`
  - No polling automático, se receber erro crítico de sync, pausar polling e evitar flood de chamadas/erros.
  - Melhorar tratamento de erro para exibir mensagem útil ao usuário (não só genérica).
- `src/pages/admin/AdminAgendaPage.tsx`
  - Corrigir leitura de parâmetros de callback para aceitar `google_error` (além de `error`).
  - Ajustar texto de status para não mostrar “Sincronizado com null” (fallback amigável quando email estiver vazio).

3) Ajustes de observabilidade para evitar falso “redeploy completo”
- `backend/src/server.ts` + `docker-compose.yml`
  - Expor e logar `BUILD_VERSION`/`SYNC_STRATEGY` no startup e no `/api/health`.
  - Assim fica verificável no runtime se a versão nova realmente está ativa no container.

4) Validação pós-implementação
- Testar fluxo completo: conectar Google → callback → sync inicial.
- Confirmar no backend:
  - ausência total de `calendarEvent.upsert` nos logs;
  - ausência do erro UUID (`found 'n' at 1`);
  - resposta de sync com contadores.
- Confirmar no frontend:
  - sem toast de erro em loop;
  - status de conexão sem “null”;
  - eventos Google aparecendo na agenda.
