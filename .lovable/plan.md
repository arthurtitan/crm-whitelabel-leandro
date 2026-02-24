
Objetivo: fazer o sistema subir e permitir login no EasyPanel com estabilidade, corrigindo os 3 pontos que hoje impedem o fluxo completo.

## Diagnóstico (com base nos logs + código)

1) Frontend está saudável  
- Nginx iniciou normal.
- Assets e rota `/login` estão sendo servidos (HTTP 200).

2) Backend está saudável  
- A API responde em `GET /api/health` com status `ok`.
- Portanto, “não há backend” não é o problema principal.

3) Falta de logs no backend é enganosa  
- Em produção, o backend só loga startup e erros (não loga toda request).
- Então “não apareceu log no backend” não significa que a API está fora.

4) Causa crítica #1: montagem de URL no frontend está incorreta para proxy local  
- `src/config/api.config.ts` usa `VITE_API_URL=/api`.
- `src/api/endpoints.ts` já inclui `/api/...`.
- `src/api/client.ts` concatena os dois => vira `/api/api/...`.
- Além disso, o `new URL()` atual não trata bem URLs relativas sem base explícita.
- Resultado: chamadas de login/API quebram antes (ou vão para caminho errado).

5) Causa crítica #2: provider de autenticação backend lê payload errado  
- Backend responde padrão `{ data: ... }`.
- `src/contexts/AuthContext.backend.tsx` tenta ler `response.user`, `response.token` diretamente.
- Mesmo com credenciais válidas, o parse quebra.

6) Causa crítica #3: não há seed automático no deploy  
- Docker roda `prisma migrate deploy` + server, mas não executa seed.
- Em banco novo, você fica sem usuários para entrar.

---

## Plano de correção (sequência segura)

### Etapa 1 — Corrigir construção de URL da API (prioridade máxima)
Arquivos:
- `src/api/client.ts`

Ações:
- Reescrever `buildUrl()` para:
  - suportar endpoint absoluto (`https://...`) sem alteração;
  - suportar base absoluta + endpoint relativo;
  - suportar base relativa (`/api`) + endpoint relativo;
  - evitar duplicação de prefixo (`/api` + `/api/...` => manter apenas um `/api`);
  - usar `window.location.origin` ao criar URL relativa com segurança.

Resultado esperado:
- Requests passam a sair para o caminho correto.
- O frontend passa a alcançar o backend via proxy Nginx.

---

### Etapa 2 — Corrigir parse de resposta no auth backend
Arquivos:
- `src/contexts/AuthContext.backend.tsx`

Ações:
- Em `login()` e `hydrateFromToken()`, extrair payload como:
  - `const payload = response.data ?? response`
- Ler `payload.user`, `payload.token`, `payload.refreshToken`, `payload.account`.
- Manter fallback para formatos antigos (compatibilidade).

Resultado esperado:
- Login passa a funcionar com resposta real do backend.
- Sessão persiste corretamente após autenticação.

---

### Etapa 3 — Garantir usuário inicial no primeiro deploy (seed controlado)
Arquivos:
- `backend/src/prisma/seed.ts`
- `backend/Dockerfile`

Ações:
1. Tornar seed “first-run safe”:
   - no início do seed, checar `await prisma.user.count()`;
   - se > 0, sair sem criar dados (evita duplicação em restart).
2. Ajustar startup do container:
   - executar migrate;
   - executar seed;
   - iniciar servidor.
   - Exemplo de ordem: `migrate deploy -> seed -> node dist/server.js`.

Resultado esperado:
- Em banco novo, já existe usuário para login.
- Em reinícios seguintes, não duplica dados.

---

### Etapa 4 — Observabilidade mínima para diagnóstico
Arquivos:
- `backend/src/server.ts` (ou middleware de logging)
- opcional: `nginx.conf` (log dedicado de `/api`)

Ações:
- Adicionar log enxuto de requisições de autenticação (método + rota + status) em produção, sem dados sensíveis.
- Manter foco em `/api/auth/*` para suporte rápido.

Resultado esperado:
- Próximos diagnósticos ficam imediatos (sem “backend silencioso”).

---

## Validação pós-correção (E2E obrigatório)

1. Rebuild/deploy no EasyPanel.
2. Confirmar logs de backend com sequência:
   - migrations aplicadas;
   - seed executado ou “seed skipped (users exist)”;
   - server listening.
3. Testar:
   - `GET /api/health` => 200.
4. Login E2E no domínio:
   - `superadmin@sistema.com / Admin@123`
   - e `carlos@clinicavidaplena.com / Admin@123`
5. Verificar no Network do navegador:
   - chamadas indo para `/api/auth/login` (sem `/api/api/...`).
6. Verificar redirecionamento após login para painel.
7. Smoke test básico de 2 telas internas para confirmar sessão/token.

---

## Riscos e mitigação

- Risco: seed com senha padrão em produção.
  - Mitigação: após primeiro acesso, trocar senha imediatamente.
  - (Opcional técnico depois): mover credenciais iniciais para variáveis de ambiente e forçar troca no primeiro login.

- Risco: impacto em chamadas antigas ao mudar URL builder.
  - Mitigação: manter suporte a endpoint absoluto e a formato atual com normalização, sem quebrar integrações existentes.

---

## Entregável final esperado

Após aplicar este plano, o sistema ficará acessível no domínio já configurado, com login funcional e fluxo estável de autenticação/API, eliminando o falso sintoma de “frontend ok, backend sem log” e removendo dependência de setup manual no primeiro deploy.
