
# Corrigir Erro do Prisma no Alpine - OpenSSL Ausente

## O Problema

O build passou com sucesso, mas o container backend falha ao executar `prisma migrate deploy` porque o Alpine Linux nao inclui OpenSSL por padrao. O Prisma precisa do OpenSSL para seus binarios nativos (schema engine, migration engine).

O erro repetido nos logs:
```
prisma:warn Prisma failed to detect the libssl/openssl version to use
Error: Could not parse schema engine response: SyntaxError: Unexpected token 'E', "Error load"... is not valid JSON
```

## A Correcao

Adicionar `RUN apk add --no-cache openssl` em ambos os estagios do `backend/Dockerfile`:

### Arquivo: `backend/Dockerfile`

```text
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl    # <-- ADICIONAR

...

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache openssl    # <-- ADICIONAR
```

Especificamente:
- **Linha 8 (apos WORKDIR no builder)**: Adicionar `RUN apk add --no-cache openssl`
- **Linha 31 (apos WORKDIR no production)**: Adicionar `RUN apk add --no-cache openssl`

## Por que funciona

O Prisma usa binarios nativos que dependem de `libssl`. Sem ela no Alpine, o engine tenta carregar a biblioteca, falha com "Error loading...", e o JSON parser do Prisma recebe esse texto de erro em vez de JSON valido, gerando o erro "Unexpected token 'E'".

## Resultado Esperado

Apos esta correcao:
1. `prisma migrate deploy` executara com sucesso, criando as tabelas no PostgreSQL
2. `node dist/server.js` iniciara o backend normalmente
3. O frontend (nginx) ja esta funcionando corretamente
