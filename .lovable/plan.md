
# Plano: Correção da Criação de Usuários Importados do Chatwoot

## Resumo Executivo

O problema foi identificado: usuários importados do Chatwoot são criados no banco de dados, mas a **senha digitada pelo Super Admin não está sendo corretamente associada** ao registro de autenticação. O login só funcionou após usar a Edge Function `set-user-password` para redefinir a senha manualmente.

---

## Diagnóstico

### O que foi verificado:
1. O usuário `glepsai@gmail.com` existe no banco (`profiles` e `auth.users`)
2. A Edge Function `create-user` está recebendo os parâmetros corretos
3. O código em `EmbeddedUserCreationForm` passa corretamente `{ user, password }` para `handleUserCreated`
4. O código em `handleUserCreated` usa `data.password` na chamada para `usersCloudService.create`

### Possíveis causas raiz:
1. **Deploy não aplicado**: As correções de código podem não ter sido publicadas quando o usuário foi criado
2. **Problema na Edge Function `create-user`**: A função pode estar recebendo a senha mas não está sendo armazenada corretamente no Supabase Auth
3. **Falta de logs**: Não há logging na Edge Function para verificar se a senha está chegando

---

## Plano de Correção

### Etapa 1: Adicionar Logging na Edge Function `create-user`
Adicionar logs para rastrear exatamente o que está sendo recebido e processado.

**Arquivo:** `supabase/functions/create-user/index.ts`

```typescript
// Adicionar log para debug (sem expor senha)
console.log("Creating user:", { 
  email, 
  nome, 
  role, 
  account_id, 
  hasPassword: !!password,
  passwordLength: password?.length 
});
```

### Etapa 2: Verificar se o problema persiste
Após o deploy, testar a criação de um novo usuário importado do Chatwoot:
1. Deletar o usuário `glepsai@gmail.com` existente
2. Importar novamente com uma senha conhecida
3. Verificar os logs da Edge Function
4. Tentar fazer login

### Etapa 3: Correção alternativa (se necessário)
Se o problema persistir, adicionar uma chamada explícita para `set-user-password` logo após a criação do usuário, garantindo que a senha seja sempre definida corretamente.

**Arquivo:** `src/services/users.cloud.service.ts`

```typescript
async create(input: CreateUserInput): Promise<Profile> {
  // ... código existente para criar usuário ...

  const userId = result.user.id;

  // Garantir que a senha seja definida via set-user-password como fallback
  const setPasswordResponse = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-user-password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({
        userId: userId,
        password: input.password,
      }),
    }
  );

  if (!setPasswordResponse.ok) {
    console.warn('Failed to explicitly set password, user may need password reset');
  }

  // ... resto do código ...
}
```

---

## Seção Tecnica

### Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `supabase/functions/create-user/index.ts` | Adicionar logging para debug |
| `src/services/users.cloud.service.ts` | Adicionar chamada redundante ao `set-user-password` como fallback |

### Fluxo Corrigido

```text
+-------------------+     +------------------+     +-------------------+
| EmbeddedUserForm  | --> | handleUserCreated| --> | usersCloudService |
| (coleta senha)    |     | (passa senha)    |     | .create()         |
+-------------------+     +------------------+     +-------------------+
                                                           |
                                                           v
                                              +------------------------+
                                              | Edge Function          |
                                              | create-user            |
                                              | (cria auth.users)      |
                                              +------------------------+
                                                           |
                                                           v
                                              +------------------------+
                                              | Edge Function          |
                                              | set-user-password      |
                                              | (define senha - backup)|
                                              +------------------------+
```

---

## Resultado Esperado

Apos a implementacao:
- Usuarios importados do Chatwoot terao senhas funcionais imediatamente
- Logs permitirao debug se problemas persistirem
- Fallback com `set-user-password` garante que a senha seja sempre definida
