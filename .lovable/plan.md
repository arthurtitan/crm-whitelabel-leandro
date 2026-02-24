
Objetivo: preparar um pacote de deploy Docker realmente “à prova de EasyPanel”, com novos arquivos dedicados, removendo ambiguidades de rede/proxy e garantindo diagnóstico rápido se algo falhar de novo.

Contexto que eu revisei duas vezes no código atual:
1) Stack atual está tecnicamente consistente (frontend em Nginx porta 80, backend Express porta 3000, healthchecks, proxy /api).
2) O erro recorrente “Service is not reachable” indica problema de orquestração/roteamento entre serviços no EasyPanel (não bug de rota React), especialmente quando o upstream do Nginx depende do nome fixo `backend` e quando o fluxo de startup depende de timing de banco/migrations.
3) Hoje falta um “pacote de deploy padronizado para EasyPanel” com arquivos próprios, variáveis explícitas e validação operacional simples.

Plano de implementação (com novos arquivos)

1) Criar um pacote dedicado para EasyPanel (novos arquivos)
- Criar `deploy/easypanel/docker-compose.yml`
  - Versão específica para EasyPanel (sem campos que geram conflito).
  - Serviços: `frontend`, `backend`, `postgres`.
  - `healthcheck` explícito em todos os serviços.
  - `depends_on` com condições corretas.
  - `expose` explícito de portas internas (80, 3000, 5432) para facilitar leitura do EasyPanel.
- Criar `deploy/easypanel/.env.example`
  - Variáveis obrigatórias com nomes claros.
  - Inclui exemplo real de preenchimento para domínio e CORS.
  - Remove defaults perigosos de produção no arquivo de exemplo.
- Criar `deploy/easypanel/README.md`
  - Passo-a-passo exato para subir no EasyPanel (onde clicar, qual serviço mapear, qual porta usar, quais envs obrigatórias).
  - Checklist pós-deploy com comandos de validação.
- Criar `deploy/easypanel/diagnostics.md`
  - Fluxo de troubleshooting em 3 minutos (qual log olhar primeiro, como identificar se falha é DNS/proxy, frontend, backend ou banco).

2) Tornar o frontend resiliente ao nome do serviço backend
- Criar `deploy/easypanel/nginx/default.conf.template` (novo arquivo template)
  - `proxy_pass http://${BACKEND_UPSTREAM};`
  - `BACKEND_UPSTREAM` configurável por env (ex.: `backend:3000`).
  - Mantém `/health` e fallback SPA.
- Ajustar `Dockerfile.frontend`
  - Passar a usar template Nginx em runtime (envsubst do entrypoint oficial do Nginx).
  - Healthcheck do frontend apontando para `/health` (não só `/`), para reduzir falso positivo.
- Resultado: se o EasyPanel mudar o alias/rede, basta trocar variável sem editar código.

3) Tornar startup do backend robusto (evitar loop de boot)
- Criar `backend/scripts/start.sh` (novo arquivo)
  - Espera banco ficar disponível (retry com timeout).
  - Executa `prisma migrate deploy`.
  - Executa seed de forma controlada (idempotente e com opção de desativar por env, ex. `RUN_SEED=true/false`).
  - Só depois inicia `node dist/server.js`.
- Ajustar `backend/Dockerfile`
  - Copiar e executar `start.sh` como CMD.
- Resultado: evita race condition entre healthcheck, migrations e subida real da API.

4) Endurecer configuração de CORS para produção real
- Ajustar backend para aceitar lista de origens por env (ex.: `CORS_ORIGINS=https://app.seudominio.com,https://www.seudominio.com`), mantendo compatibilidade com `FRONTEND_URL`.
- Atualizar exemplos de env no pacote EasyPanel para garantir que não fique preso em `localhost`.
- Resultado: evita “app abre, login quebra” após deploy.

5) Padronizar organização de deploy sem quebrar ambiente atual
- Manter arquivos atuais para desenvolvimento/local.
- Deixar o pacote EasyPanel isolado em `deploy/easypanel/` para reduzir erro operacional.
- Documentar claramente “qual compose usar em cada cenário”.

Sequenciamento (ordem de execução)
1. Criar novos arquivos de deploy (`deploy/easypanel/*`).
2. Implementar template Nginx + variável `BACKEND_UPSTREAM`.
3. Implementar `backend/scripts/start.sh` e ligar no Dockerfile do backend.
4. Ajustar CORS/env para produção.
5. Revisão dupla final:
   - Revisão 1 (estática): consistência de variáveis, portas, healthchecks e paths.
   - Revisão 2 (funcional): checklist de validação de container e rota `/api/health`, `/health`, login e navegação.

Validação que será feita após implementação
- Infra:
  - Frontend responde `GET /health` = 200.
  - Backend responde `GET /api/health` = 200.
  - Backend só marca healthy após migrations/seed concluídos.
- App:
  - Tela `/login` abre.
  - Login com credenciais seed funciona.
  - Requests `/api/*` passam pelo Nginx corretamente.
- Operação no EasyPanel:
  - Serviço de domínio mapeado no `frontend:80`.
  - Backend acessível internamente via `BACKEND_UPSTREAM`.
  - Sem loop de restart por timeout de inicialização.

Riscos e mitigação
- Risco: alias interno do backend diferente de `backend`.
  - Mitigação: `BACKEND_UPSTREAM` por env + template Nginx.
- Risco: banco demora para responder no boot inicial.
  - Mitigação: `start.sh` com retries e fail-fast explícito.
- Risco: CORS bloqueando produção.
  - Mitigação: `CORS_ORIGINS` documentado e validado no pacote EasyPanel.
- Risco: erro operacional no painel.
  - Mitigação: README e diagnostics objetivos com checklist de confirmação.

Resultado esperado
- Você terá um conjunto novo de arquivos de deploy específico para EasyPanel, com configuração previsível e repetível.
- O deploy deixa de depender de “adivinhação” de rede/nome de serviço.
- Se falhar novamente, teremos diagnóstico direcionado em minutos (não tentativa cega).
