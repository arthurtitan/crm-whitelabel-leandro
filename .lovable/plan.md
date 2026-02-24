
Objetivo imediato
- Tirar o deploy do loop de restart com a menor mudança possível, atacando a causa real dos logs.

Diagnóstico (com base nos logs + arquivos revisados)
1) Causa raiz principal (backend)
- O backend está quebrando no `backend/scripts/start.sh` linha 22 com:
  - `syntax error: unexpected redirection`
- No arquivo atual, a linha é:
  - `npx prisma db execute --stdin <<< "SELECT 1"`
- O operador `<<<` (here-string) é do Bash, mas o script roda com `#!/bin/sh` (Alpine/ash), que não suporta isso.
- Resultado: backend nunca sobe, entra em loop, healthcheck falha.

2) Efeito em cascata (frontend)
- O frontend cai com:
  - `host not found in upstream "backend"`
- Isso acontece porque o Nginx tenta resolver `backend` no startup, mas o serviço backend está crashando sem ficar disponível.
- Ou seja: erro do frontend aqui é consequência do erro do backend (não a causa primária).

3) Postgres
- Os logs do Postgres indicam inicialização normal.
- Aviso de locale (`locale: not found`) é comum em imagens Alpine e não é o bloqueador.

Correção rápida e eficiente (ordem de execução)
1. Corrigir apenas 1 linha no `backend/scripts/start.sh` (hotfix)
- Trocar a verificação de DB para sintaxe POSIX:
  - de: `... <<< "SELECT 1"`
  - para: `echo "SELECT 1;" | npx prisma db execute --stdin ...`
- Isso remove o erro de shell imediatamente.

2. Rebuild/deploy completo no EasyPanel
- Fazer rebuild da imagem backend (idealmente app inteiro para garantir consistência de imagem).
- Reiniciar stack após rebuild.

3. Validar backend antes de olhar frontend
- Esperado no backend:
  - “Banco de dados acessível”
  - “Aplicando migrations…”
  - “Iniciando servidor…”
- Endpoint esperado:
  - `/api/health` retornando 200

4. Validar frontend em seguida
- Esperado no frontend:
  - Nginx inicia sem `host not found in upstream`.
  - `/health` retorna `OK`.
  - Login abre e requisições `/api/*` funcionam.

Contingência (se ainda aparecer “host not found in upstream” após backend ficar saudável)
- Verificar `BACKEND_UPSTREAM` no EasyPanel:
  - valor padrão esperado: `backend:3000`
- Se o EasyPanel estiver usando outro alias interno de serviço, ajustar esse env para o nome correto do serviço backend na rede interna.
- Critério de confirmação:
  - o frontend sobe e para de reiniciar em loop.

Plano de implementação que vou aplicar após sua aprovação
1) Hotfix backend (mínimo e seguro)
- Arquivo: `backend/scripts/start.sh`
- Alteração: substituir uso de `<<<` por pipe POSIX (`echo | ... --stdin`).

2) Hardening opcional (recomendado na mesma passada, baixo risco)
- Garantir que a checagem de banco continue silenciosa e com retry como já está.
- Não alterar fluxo de migrations/seed neste momento para manter mudança mínima.

3) Verificação final pós-fix
- Revisar logs de backend e frontend.
- Confirmar:
  - backend estável (sem restart loop),
  - frontend estável,
  - login funcional via domínio.

Critérios de sucesso
- Sem mais `syntax error: unexpected redirection` no backend.
- Sem mais `host not found in upstream "backend"` no frontend.
- `/health` e `/api/health` respondendo.
- Tela de login carregando normalmente pelo domínio.
