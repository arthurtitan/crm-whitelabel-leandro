

# Corrigir Build do Frontend - package-lock.json desatualizado

O backend compilou com sucesso! O erro agora e exclusivamente no **frontend**.

## O Problema

O `Dockerfile.frontend` usa `npm ci`, que exige sincronia perfeita entre `package.json` e `package-lock.json`. Como o Lovable atualiza dependencias automaticamente sem regenerar o lock file, o `npm ci` falha com erros de pacotes faltantes.

## A Correcao

Trocar `npm ci` por `npm install` na linha 18 do `Dockerfile.frontend`:

```text
# Antes
RUN npm ci

# Depois
RUN npm install
```

`npm install` e tolerante com lock files desatualizados e resolve as dependencias corretamente.

## Arquivo a Modificar

| Arquivo | Mudanca |
|---|---|
| `Dockerfile.frontend` | Linha 18: `npm ci` -> `npm install` |

Uma unica linha. Apos isso, tanto backend quanto frontend devem buildar sem erros no EasyPanel.

