
Diagnóstico rápido (com base no código atual):
- `backend/src/server.ts` já está corrigido na linha 104: `Google Calendar: credenciais no banco de dados (por conta)`.
- `backend/src/config/env.ts` realmente não possui `GOOGLE_CLIENT_ID` (arquitetura nova: credenciais no banco por conta).
- Portanto, o erro de build que você colou é de um commit/artefato antigo (stale source no deploy), não de uma falha ainda presente no código atual.

Plano objetivo para resolver de vez:

1) Confirmar origem do deploy (causa raiz)
- Verificar no EasyPanel se o deploy está realmente puxando o commit mais recente do `main`.
- Conferir se o hash/data exibidos no “Pulling data from origin/main” são posteriores à correção do `server.ts`.

2) Forçar rebuild limpo (sem cache de camada)
- Executar novo deploy com rebuild completo para evitar uso de camada antiga de Docker.
- Garantir que o contexto usado seja o backend atualizado (arquivo `backend/src/server.ts` com a linha já corrigida).

3) Se ainda falhar após rebuild limpo
- Validar no servidor de deploy o conteúdo real de `backend/src/server.ts` (deve estar sem `env.GOOGLE_CLIENT_ID`).
- Se aparecer a versão antiga, o problema é sincronização do repositório (branch/remote incorreto), não código.

4) Validação final pós-build
- Confirmar que o backend sobe sem erro TS2339.
- Testar ponta a ponta a Agenda:
  1. abrir Agenda,
  2. clicar conectar Google,
  3. autorizar,
  4. voltar com sucesso,
  5. sincronizar eventos.

Detalhe técnico (curto):
- O TypeScript só gera esse erro se o código compilado ainda contém `env.GOOGLE_CLIENT_ID`.
- Como o código atual já não contém essa referência, a solução é alinhar o deploy com a versão correta e rebuildar sem cache.
