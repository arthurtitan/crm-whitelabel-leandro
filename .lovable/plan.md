
Objetivo: corrigir definitivamente o erro `new row violates row-level security policy for table "accounts"` quando você está logado como `admin@gleps.com.br`, sem quebrar o isolamento “admin só da própria conta” e “super admin global”.

Diagnóstico consolidado (com evidência)
1. O usuário `admin@gleps.com.br` já está com role `super_admin` na tabela `user_roles`.
2. O erro de RLS continua porque o frontend está em modo backend (`VITE_USE_BACKEND=true` no `docker-compose.yml`), mas páginas Super Admin ainda chamam serviços cloud diretamente (`accountsCloudService` / `usersCloudService`).
3. Nesse cenário, o login é feito no backend JWT (Express), não na sessão do backend cloud do frontend; então as chamadas diretas ao banco cloud chegam sem sessão válida de usuário e caem em RLS ao inserir em `accounts`.
4. Em resumo: não é mais problema de role; é problema de mistura de camadas (backend mode + cloud service direto).

Escopo da correção
- Não haverá mudança de regra de acesso (as regras já estão corretas).
- Não haverá mudança de schema/roles no banco agora.
- Correção será no frontend/services para usar sempre a camada certa conforme modo de execução.

Plano de implementação

1) Eliminar uso direto de serviços cloud nas telas Super Admin
Arquivos:
- `src/pages/super-admin/SuperAdminAccountsPage.tsx`
- `src/pages/super-admin/SuperAdminUsersPage.tsx`
- `src/pages/super-admin/SuperAdminAccountDetailPage.tsx`

Ações:
- Trocar imports de `accountsCloudService` e `usersCloudService` por `accountsCloudOrBackend` e `usersCloudOrBackend` (já existentes em `src/services/index.ts`).
- Ajustar chamadas para manter o mesmo fluxo funcional (listar/criar/editar conta, importar usuários).
- Resultado: em produção com `VITE_USE_BACKEND=true`, toda operação Super Admin passa por `/api/...` (backend), sem bater no RLS da base cloud.

2) Padronizar contrato dos serviços backend para o formato esperado pela UI
Arquivos:
- `src/services/accounts.backend.service.ts`
- `src/services/users.backend.service.ts`

Ações:
- Desempacotar respostas `{ data: ... }` de forma consistente em `getById/create/update` (hoje está parcialmente inconsistente).
- Mapear campos camelCase do backend para o shape usado nas telas (snake_case) quando necessário, para evitar regressões no wizard e nas tabelas.
- Ajustar `delete` de usuário para enviar confirmação de senha no header exigido pelo backend (`x-confirm-password`), garantindo compatibilidade com middleware de segurança.

3) Garantir importação de agentes Chatwoot no modo backend
Arquivo:
- `src/services/accounts.backend.service.ts`

Ações:
- Melhorar `testChatwootConnection` para:
  - testar credenciais em `/api/chatwoot/test-connection`;
  - em sucesso, buscar agentes em `/api/chatwoot/agents/fetch`;
  - retornar payload unificado (`success`, `message`, `agents`, `inboxes`, `labels`) compatível com o wizard atual.
- Resultado: fluxo “criar conta + integrar Chatwoot + selecionar/importar agentes” funciona no backend mode.

4) Validação funcional e de segurança (E2E)
Checklist de validação:
1. Login com `admin@gleps.com.br`.
2. Criar conta no Super Admin com integração Chatwoot.
3. Confirmar que:
   - não aparece mais erro de RLS;
   - rede usa `/api/accounts`, `/api/chatwoot/...`, `/api/users` (não `/rest/v1/accounts`).
4. Importar usuários do Chatwoot e confirmar criação dos usuários na conta nova.
5. Teste de autorização:
   - usuário `admin` comum não deve acessar `/super-admin` (deve cair em `unauthorized`);
   - `super_admin` mantém acesso global.

Riscos e mitigação
- Risco: diferenças de formato entre retorno backend e UI quebrarem render.
  - Mitigação: normalização explícita no service layer (passo 2).
- Risco: fluxo de importação depender de dados extras além de agentes.
  - Mitigação: manter contrato completo no retorno (mesmo que `inboxes/labels` vazios inicialmente).

Entregável esperado
- Erro de RLS ao criar conta desaparece para `admin@gleps.com.br`.
- Fluxo completo de criação de conta com integração e importação de usuários funciona no seu ambiente com backend.
- Isolamento de acesso permanece correto: admin restrito à própria conta, super admin com acesso global.
