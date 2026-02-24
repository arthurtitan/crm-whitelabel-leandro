

# Corrigir Role do Usuário glepsai@gmail.com

## Problema

O usuário `glepsai@gmail.com` (Arthur) possui role `admin` na tabela `user_roles`, mas está acessando o painel Super Admin. A política RLS da tabela `accounts` só permite operações de escrita para usuários com role `super_admin`. Por isso o INSERT falha com "new row violates row-level security policy".

## Correção

Atualizar o role do usuário `glepsai@gmail.com` de `admin` para `super_admin` na tabela `user_roles`.

### Comando SQL (via ferramenta de dados)

```sql
UPDATE user_roles 
SET role = 'super_admin' 
WHERE user_id = 'b630d7f8-fcb8-4566-bae8-7e1b611f6f42';
```

## Impacto

- Zero alteração de código.
- Após a correção, `glepsai@gmail.com` terá acesso completo ao gerenciamento de contas, incluindo criar, editar e excluir.
- O usuário precisará fazer logout e login novamente para que a sessão reflita a nova permissão.

## Validação

1. Após aplicar, fazer logout e login com `glepsai@gmail.com`.
2. Acessar o painel Super Admin > Contas.
3. Tentar criar uma nova conta com integração Chatwoot.
4. Confirmar que o erro de RLS não aparece mais.

