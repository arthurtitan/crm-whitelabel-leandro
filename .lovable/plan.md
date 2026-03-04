

## Diagnóstico: variáveis sendo sobrescritas por string vazia

### Causa raiz

O problema é na mecânica do docker-compose + EasyPanel:

```text
Fluxo atual:
1. EasyPanel injeta GOOGLE_CLIENT_ID=231653... no container backend
2. docker-compose.yml tem: GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID:-}
3. A substituição ${GOOGLE_CLIENT_ID:-} acontece no NÍVEL DO COMPOSE (não do container)
4. Como no nível do compose a variável não existe, resolve para "" (string vazia)
5. O environment: explícito SOBRESCREVE o valor injetado pelo EasyPanel
6. Resultado: GOOGLE_CLIENT_ID="" dentro do container
```

O `:-` (default vazio) no docker-compose está **anulando** o valor que o EasyPanel injeta diretamente no container.

### Correção

Remover as 3 variáveis GOOGLE_* da seção `environment:` do docker-compose do EasyPanel. Assim o EasyPanel injeta os valores diretamente no container sem que o compose os sobrescreva com string vazia.

Também adicionar diagnóstico no `start.sh` para confirmar visualmente no log se as variáveis chegaram.

### Arquivos alterados

| Arquivo | Alteração |
|---------|-----------|
| `deploy/easypanel/docker-compose.yml` | Remover GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI do `environment:` do backend |
| `backend/scripts/start.sh` | Adicionar log de diagnóstico das variáveis GOOGLE antes de iniciar o servidor |

### Resultado

Após rebuild, o EasyPanel injeta as variáveis Google diretamente no container sem interferência. O log de startup mostra o status, e a conexão funciona.

