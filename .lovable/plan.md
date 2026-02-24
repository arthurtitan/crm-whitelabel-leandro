
Objetivo: eliminar o 401 no login com diagnóstico definitivo e tornar o bootstrap de acesso previsível no EasyPanel.

## Leitura técnica do problema (com base nos logs e código)

1. A infraestrutura está funcionando
- Frontend responde `/login` e assets com 200.
- Requisições de login chegam ao backend (`POST /api/auth/login`).
- Banco está saudável (logs normais de startup/checkpoint).

2. O erro atual não é de rede/proxy; é de credencial
- Backend retorna explicitamente `Credenciais inválidas` no `AuthService.login`.
- Isso significa: usuário não encontrado ou senha incorreta.

3. Há inconsistência entre credenciais usadas e credenciais seedadas
- Você tentou: `admin@gleps.com.br` e `glepsai@gmail.com`.
- Seed atual cria: `superadmin@sistema.com`, `carlos@clinicavidaplena.com`, etc.
- Portanto, os emails usados no print não estão garantidos no banco atual.

4. UX de erro está enganosa
- O frontend transforma qualquer 401 em “Sessão expirada” no `apiClient`.
- Em falha de login, isso mascara o erro real (“Credenciais inválidas”).

5. Há fragilidade no startup do backend
- `Dockerfile` roda seed com `2>/dev/null || echo ...`, escondendo erro real.
- Se seed falhar, o servidor pode subir sem usuários válidos e sem sinal claro no log.

## Plano de correção (ordem de execução)

### Etapa 1 — Corrigir tratamento de erro 401 no frontend (prioridade máxima)
Arquivos:
- `src/api/client.ts`
- `src/contexts/AuthContext.backend.tsx`

Ações:
- Ajustar `handleResponse` para:
  - extrair mensagem real do backend (`error.message` ou `error.error.message`);
  - **não** disparar logout global em 401 de rota pública de login (`skipAuth: true`);
  - manter limpeza de token apenas para 401 de rota autenticada.
- Ajustar `BackendAuthProvider.login` para priorizar mensagem vinda do backend.

Resultado esperado:
- Tela de login passa a mostrar “Credenciais inválidas” quando for esse o caso (sem falso “Sessão expirada”).

### Etapa 2 — Garantir usuários de acesso que você está usando
Arquivo:
- `backend/src/prisma/seed.ts`

Ações:
- Incluir upsert explícito para super admins:
  - `admin@gleps.com.br / Admin@123`
  - `glepsai@gmail.com / Admin@123`
  - manter também `superadmin@sistema.com / Admin@123`
- Reestruturar o guard do seed:
  - manter seed idempotente;
  - garantir que usuários de acesso sejam “assegurados” mesmo quando já houver dados;
  - evitar duplicar massa demo (contatos/vendas/produtos).

Resultado esperado:
- Seus dois emails passam a existir de forma previsível após deploy.

### Etapa 3 — Tornar o startup fail-fast e observável
Arquivo:
- `backend/Dockerfile`

Ações:
- Trocar comando final para:
  - `prisma migrate deploy && node dist/prisma/seed.js && node dist/server.js`
- Remover supressão de erro do seed (`2>/dev/null`) e fallback silencioso.

Resultado esperado:
- Se seed falhar, o deploy falha claramente (sem backend “meio pronto”).
- Logs passam a mostrar exatamente o que ocorreu.

### Etapa 4 — Validação pós-deploy (E2E)
Checklist:
1. Confirmar nos logs do backend:
   - migrations aplicadas;
   - seed executado e usuários assegurados;
   - servidor iniciado.
2. Testar login E2E com:
   - `admin@gleps.com.br / Admin@123`
   - `glepsai@gmail.com / Admin@123`
3. Confirmar no navegador:
   - request `POST /api/auth/login` retorna 200 no sucesso;
   - em erro proposital, mensagem exibida é “Credenciais inválidas” (não “Sessão expirada”).
4. Validar redirecionamento para rota correta após login.

## Riscos e mitigação

- Risco: senha padrão em produção.
  - Mitigação: após primeiro acesso, trocar senha imediatamente para ambas as contas.
- Risco: seed em base já populada.
  - Mitigação: manter idempotência via upsert para usuários críticos e bloquear duplicação de massa demo.

## Entregável esperado

Após aplicar este pacote:
- login deixa de falhar por falta de usuário seedado;
- mensagens de erro ficam corretas;
- bootstrap do ambiente fica confiável e auditável no EasyPanel;
- o acesso com os emails que você está usando passa a funcionar.
