

# Corrigir Build do Backend no EasyPanel

## Problema
O comando `npm ci` no `backend/Dockerfile` exige um `package-lock.json`, mas esse arquivo nao existe na pasta `backend/`. O build falha com:

```
npm error The `npm ci` command can only install with an existing package-lock.json
```

## Solucao

Alterar o `backend/Dockerfile` em **2 pontos** onde `npm ci` e usado:

1. **Linha do builder stage**: trocar `RUN npm ci` por `RUN npm install`
2. **Linha do production stage**: trocar `RUN npm ci --only=production` por `RUN npm install --omit=dev`

A flag `--only=production` tambem esta obsoleta e sera substituida por `--omit=dev`.

## Alteracoes no arquivo

**Arquivo:** `backend/Dockerfile`

- Linha ~14: `RUN npm ci` -> `RUN npm install`
- Linha ~32: `RUN npm ci --only=production` -> `RUN npm install --omit=dev`

## Por que `npm install` e nao gerar o lock file

- Gerar um `package-lock.json` exigiria rodar `npm install` localmente e commitar o arquivo
- Usar `npm install` diretamente no Dockerfile e mais simples e funciona sem lock file
- Para producao, a diferenca pratica e minima ja que as versoes estao fixadas no `package.json` com `^`

## Impacto
- Zero impacto funcional
- O build vai passar no EasyPanel
- Ambos os stages (builder e production) serao corrigidos
