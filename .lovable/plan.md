

## Diagnóstico Final

Agora que vejo a interface do EasyPanel, o problema fica claro:

**O EasyPanel injeta variáveis para substituição do Compose (`${VAR}`), NÃO como arquivo `.env` no disco.** A diretiva `env_file: .env` não funciona porque não existe um arquivo `.env` físico no container — o EasyPanel disponibiliza as variáveis apenas para o mecanismo de substituição do docker-compose.

O warning anterior ("variable is not set") aconteceu porque as variáveis não estavam cadastradas no EasyPanel naquele momento. Agora elas estão lá. Mas na última correção, removemos `GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}` do `environment:` e adicionamos `env_file: .env` — que aponta para um arquivo que não existe.

## Correção

Reverter a abordagem: **remover `env_file: .env`** e **restaurar as variáveis GOOGLE_* na seção `environment:`** usando `${GOOGLE_CLIENT_ID}` (sem fallback `:-`).

```text
Antes (quebrado):
  env_file: .env          ← arquivo não existe no EasyPanel
  environment:
    (sem GOOGLE_*)        ← variáveis nunca chegam ao container

Depois (correto):
  environment:
    GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
    GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
    GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI}
    ← EasyPanel substitui com os valores da sua UI
```

### Arquivos a alterar

1. **`docker-compose.yml` (raiz)**: Remover `env_file`, adicionar GOOGLE_* de volta no `environment:`
2. **`deploy/easypanel/docker-compose.yml`**: Mesmo ajuste

Isso é tudo. Após rebuild, as variáveis que já estão cadastradas no painel do EasyPanel serão injetadas corretamente.

