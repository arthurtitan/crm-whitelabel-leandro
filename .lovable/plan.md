
Diagnóstico consolidado (com base no código + logs + screenshot):
- A migração já está resolvida (backend sobe normalmente).
- O erro atual da Agenda não é OAuth em si; é “Google Calendar não configurado no servidor”.
- O fallback em `backend/src/services/calendar.service.ts` está correto, mas o container do backend não recebe `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` via Compose.
- Causa raiz provável e objetiva: em `docker-compose.yml`, serviço `backend.environment` não declara essas 3 variáveis, então `process.env.GOOGLE_*` fica vazio no runtime.

Do I know what the issue is?
- Sim: integração não lê credenciais porque as variáveis não estão sendo injetadas no backend container (apesar de existirem no EasyPanel).

Estratégia de correção mais eficiente (mínima e robusta):

1) Garantir injeção das variáveis Google no backend (ponto crítico)
- Arquivo: `docker-compose.yml`
- No serviço `backend.environment`, adicionar:
  - `GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}`
  - `GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET:-}`
  - `GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI:-}`
- Resultado: o fallback já implementado passa a funcionar imediatamente.

2) Tornar diagnóstico confiável no backend (evitar “falso verde”)
- Arquivo: `backend/src/server.ts` (log de bootstrap)
- Ajustar log para mostrar origem de credenciais detectada em runtime (`db|env|none`) sem expor segredo.
- Arquivo: `backend/src/services/calendar.service.ts`
  - Sanitizar env com `trim()` para evitar valores com espaço acidental.
  - Retornar `source` no status (`db`, `env`, `none`) para depuração rápida.

3) Evitar cache enganando status da Agenda
- Arquivo: `backend/src/controllers/calendar.controller.ts` (rota `getGoogleStatus`)
  - Enviar `Cache-Control: no-store` para `/api/calendar/google/status`.
- Arquivo: `src/services/calendar.backend.service.ts`
  - Adicionar query param de cache-bust (`?_t=<timestamp>`) na leitura de status.
- Resultado: elimina 304 confuso durante troubleshooting/deploy.

4) Preservar arquitetura híbrida (sem retrabalho desnecessário)
- Manter prioridade: credencial por conta (DB) > fallback global (env).
- Isso permite operar hoje com EasyPanel env e, depois, migrar para configuração por conta sem quebrar fluxo.

Validação pós-correção (E2E obrigatório):
1. Deploy limpo.
2. Verificar log do backend indicando `Google creds source: env` (ou `db` se preenchido).
3. Abrir `/admin/agenda`:
   - Deve aparecer botão de conectar/sincronizar (não o alerta de não configurado).
4. Clicar em conectar → OAuth Google → callback em `/api/calendar/google/callback`.
5. Retorno para Agenda com `google_connected=true`.
6. Sincronização e listagem de eventos.
7. Testar desconectar e reconectar para validar ciclo completo.

Arquivos envolvidos no plano:
- `docker-compose.yml`
- `backend/src/services/calendar.service.ts`
- `backend/src/controllers/calendar.controller.ts`
- `backend/src/server.ts`
- `src/services/calendar.backend.service.ts`
