
# Plano: Exclusão Real de Usuários via Edge Function

## Problema Identificado

A exclusão de usuários atualmente possui **dois problemas críticos**:

1. **Serviço `usersCloudService.delete()`** (linha 207-218):
   - Remove apenas o registro da tabela `profiles`
   - **NÃO** remove o usuário da tabela `auth.users` do Supabase
   - Resultado: email continua "registrado" no sistema de autenticação

2. **Página `SuperAdminUsersPage.tsx`** (linha 348-379):
   - Função `handleConfirmDelete` apenas remove o usuário da lista local em memória
   - Não chama nenhum serviço real de exclusão
   - Resultado: usuário "some" da tela mas persiste no banco

---

## Solução Proposta

### 1. Criar Edge Function `delete-user`

Nova função em `supabase/functions/delete-user/index.ts` que:

- Recebe o `user_id` a ser excluído
- Valida a senha do Super Admin (segurança)
- Usa `supabase.auth.admin.deleteUser(userId)` para remover completamente
- A exclusão em cascata remove automaticamente `profiles` e `user_roles`

```text
POST /functions/v1/delete-user
Body: { user_id: string, admin_password: string }
Response: { success: boolean, error?: string }
```

### 2. Atualizar Serviço `users.cloud.service.ts`

Modificar o método `delete()` para:
- Aceitar senha do admin como parâmetro
- Chamar a Edge Function `delete-user` via fetch
- Tratar erros específicos (senha inválida, usuário não encontrado, etc.)

### 3. Integrar na Página `SuperAdminUsersPage.tsx`

Modificar `handleConfirmDelete` para:
- Chamar `usersCloudService.delete(userId, password)`
- Tratar erros de senha inválida (mostrar mensagem, não fechar modal)
- Recarregar lista de usuários após sucesso

---

## Fluxo de Exclusão

```text
┌─────────────────────────────────────────────────────────────────┐
│                      Super Admin                                │
│                          │                                      │
│    Clica "Excluir" → Modal pede senha → Confirma exclusão       │
└─────────────────────────────────────────────────────────────────┘
                           │
                           v
┌─────────────────────────────────────────────────────────────────┐
│                   Frontend (React)                              │
│                          │                                      │
│     usersCloudService.delete(userId, password)                  │
│          │                                                      │
│          v                                                      │
│     fetch('/functions/v1/delete-user', { user_id, password })   │
└─────────────────────────────────────────────────────────────────┘
                           │
                           v
┌─────────────────────────────────────────────────────────────────┐
│              Edge Function (delete-user)                        │
│                          │                                      │
│  1. Validar JWT do Super Admin                                  │
│  2. Verificar senha do admin (opcional - pode confiar no JWT)   │
│  3. supabase.auth.admin.deleteUser(user_id)                     │
│     └── Cascata remove: profiles, user_roles                    │
│  4. Retornar { success: true }                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/delete-user/index.ts` | **CRIAR** - Edge Function para exclusão |
| `src/services/users.cloud.service.ts` | **MODIFICAR** - Chamar Edge Function |
| `src/pages/super-admin/SuperAdminUsersPage.tsx` | **MODIFICAR** - Integrar serviço real |

---

## Detalhes Técnicos

### Edge Function `delete-user`

```typescript
// Estrutura esperada:
serve(async (req) => {
  // 1. Validar método e CORS
  // 2. Extrair user_id do body
  // 3. Validar que não é o próprio usuário logado
  // 4. supabase.auth.admin.deleteUser(user_id)
  // 5. Retornar sucesso ou erro
});
```

### Serviço Atualizado

```typescript
async delete(userId: string, adminPassword: string): Promise<void> {
  const session = await supabase.auth.getSession();
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-user`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId, password: adminPassword }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error);
  }
}
```

### Tratamento de Erros na Página

- Senha incorreta → Mostrar erro no modal, não fechar
- Usuário não encontrado → Toast de erro
- Sucesso → Fechar modal, atualizar lista, toast de sucesso

---

## Segurança

- Edge Function usa `SUPABASE_SERVICE_ROLE_KEY` para ter permissão de admin
- JWT do usuário é validado para garantir que é um Super Admin autenticado
- Verificação adicional de senha para ações destrutivas
- Não é possível excluir a si mesmo (validação no backend)
