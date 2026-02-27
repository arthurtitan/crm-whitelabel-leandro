
Objetivo imediato
- Corrigir definitivamente o erro na exclusão de contas em produção (sem logout forçado do super admin), tratando a causa raiz de transporte/validação de senha e endurecendo o fluxo de autenticação para não derrubar sessão por erro operacional.

Diagnóstico consolidado (com base nos logs + código atual)
- O backend recebe `DELETE /api/accounts/:id` sem `x-confirm-password` e retorna `401 Confirmação de senha requerida`.
- O frontend, em `src/api/client.ts`, atualmente faz logout global em qualquer `401` (`auth:unauthorized`), então um erro de validação operacional vira deslogar usuário.
- Existe ruído adicional no backend:
  - `GET /api/calendar/events` com `accountId null` (super_admin sem account vinculada) causando erro Prisma.
  - `POST /api/calendar/google/connect` falhando por configuração ausente de Google Calendar no servidor.
- Há inconsistência importante no painel de detalhe da conta (`SuperAdminAccountDetailPage.tsx`): ainda usa fluxo mock/local de senha/edição/exclusão, fora do backend real.

Do I know what the issue is?
- Sim. São 2 causas principais acopladas:
  1) confirmação de senha não chegando de forma confiável ao backend no delete;
  2) política de logout global agressiva para qualquer 401.

Plano estratégico de correção (sem depender de Supabase em produção)

Fase 1 — Hotfix de segurança/estabilidade (bloqueia logout indevido)
1) Ajustar validação de senha sensível no backend
- Arquivo: `backend/src/middlewares/auth.middleware.ts`
- Ação:
  - `verifyPassword` aceitar senha por `x-confirm-password` e fallback por `req.body.password`.
  - Se senha ausente: retornar erro de validação (400), não 401.
  - Se senha incorreta: retornar 403 (ou 400 de negócio), não 401.
- Resultado: falha de confirmação não derruba sessão.

2) Refinar regra de auto-logout no frontend
- Arquivo: `src/api/client.ts`
- Ação:
  - Logout automático apenas para 401 de sessão/token (expirado/inválido/ausente).
  - Não disparar `auth:unauthorized` para erros operacionais de rota protegida.
- Resultado: super admin permanece logado ao errar senha em ação crítica.

Fase 2 — Garantia de envio de senha no delete de conta
3) Blindar requisição de exclusão no frontend
- Arquivo: `src/services/accounts.backend.service.ts`
- Ação:
  - Enviar confirmação em header e fallback em body.
  - Normalizar trim da senha e falhar cedo com mensagem amigável se vazio.
- Resultado: compatibilidade com proxy/intermediário e maior robustez no transporte.

4) Revisar fluxo da tela de contas
- Arquivo: `src/pages/super-admin/SuperAdminAccountsPage.tsx`
- Ação:
  - Manter exigência de senha obrigatória.
  - Exibir mensagens distintas para: senha ausente, senha inválida, falha técnica.
  - Garantir reset de estado do modal após sucesso/erro.
- Resultado: UX previsível e sem estados quebrados.

Fase 3 — Eliminar inconsistências que continuam gerando erro em produção
5) Remover lógica mock da tela de detalhe de conta
- Arquivo: `src/pages/super-admin/SuperAdminAccountDetailPage.tsx`
- Ação:
  - Substituir `VALID_PASSWORDS` e operações locais por chamadas reais `accountsCloudOrBackend.update/delete(...)`.
- Resultado: comportamento consistente entre “lista de contas” e “detalhe da conta”.

6) Corrigir erro de calendário com super admin sem accountId
- Arquivos: `backend/src/controllers/calendar.controller.ts` (e, se necessário, roteamento/permissão)
- Ação:
  - Se `req.user.accountId` for nulo, retornar erro de domínio claro (400/403) antes de chamar Prisma.
  - Evitar invocação com `accountId null`.
- Resultado: remove erro Prisma de produção e evita cascata de falhas.

7) Tratar Google Calendar como configuração de ambiente
- Arquivo: backend env/config (sem alteração funcional obrigatória)
- Ação:
  - Validar variáveis `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` no servidor.
  - Melhorar mensagem operacional ao admin quando ausente.
- Resultado: erro deixa de ser “interno” e vira diagnóstico objetivo.

Plano de validação (produção, ponta a ponta)
- Cenário A: excluir conta com senha correta
  - Esperado: 200, conta marcada como cancelada, usuário continua autenticado.
- Cenário B: excluir com senha errada
  - Esperado: erro de validação/permissão (não 401 de sessão), sem logout.
- Cenário C: excluir sem senha
  - Esperado: bloqueio no frontend + backend retorna 400 se chegar.
- Cenário D: repetir operação em aba anônima e aba normal
  - Esperado: mesmo comportamento (descarta cache antigo).
- Cenário E: navegar após falha de exclusão
  - Esperado: sessão do super admin intacta.
- Cenário F (regressão): usuários/sales delete com confirmação de senha continuam funcionando.

Risco e mitigação
- Risco: frontend antigo em cache/rollout parcial.
- Mitigação:
  - deploy coordenado frontend+backend;
  - invalidação de cache do index e confirmação do novo bundle;
  - checagem de headers no request real durante teste.

Sequência de execução recomendada
1) Backend `verifyPassword` (status codes + fallback body/header)
2) Frontend `apiClient` (logout seletivo por token/session)
3) Frontend `accounts.backend.service` (envio robusto da senha)
4) Frontend `SuperAdminAccountsPage` (UX e mensagens)
5) Frontend `SuperAdminAccountDetailPage` (remover mock)
6) Backend `CalendarController` (guard accountId nulo)
7) Validar ambiente Google Calendar
8) Teste E2E completo em produção

Critério de aceite
- Não ocorre mais deslogar super admin ao tentar excluir conta.
- Exclusão de conta funciona com senha correta.
- Erros de senha retornam feedback correto, sem quebrar sessão.
- Logs deixam de mostrar `Argument accountId must not be null` no calendário.
