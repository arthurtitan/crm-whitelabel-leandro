

# Correcao: "Esta operacao requer uma conta vinculada" ao testar Chatwoot

## Problema

No arquivo `backend/src/routes/chatwoot.routes.ts`, todas as rotas (exceto webhook) passam pelo middleware `requireAccountId` na linha 16. Isso bloqueia o Super Admin quando ele tenta testar a conexao Chatwoot ou buscar agentes durante a criacao de uma nova conta, pois o Super Admin nao possui `accountId` vinculado.

Os endpoints `POST /api/chatwoot/test-connection` e `POST /api/chatwoot/agents/fetch` recebem as credenciais diretamente no body da requisicao -- eles NAO precisam de um `accountId` do usuario autenticado.

## Correcao

### Arquivo: `backend/src/routes/chatwoot.routes.ts`

Mover os dois endpoints que aceitam credenciais avulsas para ANTES do middleware `requireAccountId`, mantendo apenas `authenticate` (para garantir que e um usuario logado):

```text
// ANTES do requireAccountId:
router.post('/test-connection', authenticate, requireRole('admin', 'super_admin'), handler);
router.post('/agents/fetch', authenticate, requireRole('admin', 'super_admin'), handler);

// DEPOIS do requireAccountId (todas as demais rotas que precisam de conta):
router.use(requireAccountId);
router.get('/test-connection', handler);  // GET usa accountId do usuario
router.get('/agents', handler);
// ... resto das rotas
```

Isso garante que:
- Super Admin pode testar credenciais e buscar agentes ao criar conta (sem accountId)
- Todas as outras rotas continuam protegidas por `requireAccountId`
- Nenhuma outra funcionalidade e afetada

## Impacto

- Apenas 1 arquivo backend alterado
- Zero impacto no frontend (as chamadas ja enviam credenciais no body)
- Resolve o erro "Esta operacao requer uma conta vinculada"

