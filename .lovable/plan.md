

## Corrigir erro "Perfil não encontrado"

### Causa raiz
O banco de dados tem a **function** `handle_new_user()` que cria o perfil automaticamente quando um usuário é criado, mas o **trigger** que conecta essa function à tabela `auth.users` não existe. Resultado: o usuário foi criado no auth, a role foi atribuída, mas nenhum registro foi inserido na tabela `profiles`.

### Correção

**1. Criar o trigger no banco via migration**
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

**2. Inserir o perfil do usuário já criado**
```sql
INSERT INTO public.profiles (user_id, nome, email)
SELECT id, COALESCE(raw_user_meta_data->>'nome', 'Administrador'), email
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles);
```

Após isso, o login com `admin@mychooice.com` / `Admin@123` deve funcionar normalmente.

