

## Problema

O callback do Google OAuth redireciona para `localhost` porque a variável `FRONTEND_URL` no container backend não está definida como `https://360.gleps.com.br`. O docker-compose tem fallback `${FRONTEND_URL:-http://localhost}` e o EasyPanel provavelmente não está injetando o valor correto.

## Correção

### `docker-compose.yml`

Alterar o valor de `FRONTEND_URL` no serviço backend de interpolação dinâmica para valor literal (hardcoded), seguindo o mesmo padrão já adotado para outras credenciais críticas (conforme memória da arquitetura):

```yaml
FRONTEND_URL: https://360.gleps.com.br
```

Isso garante que o callback do Google (`/api/calendar/google/callback`) redirecione para o domínio correto após a autorização OAuth, em vez de `localhost`.

### Impacto

- Arquivo único: `docker-compose.yml` (linha ~58)
- Também corrige o CORS implicitamente se `CORS_ORIGINS` depender do mesmo domínio
- Requer rebuild do container backend para aplicar

