

# Corrigir os 3 Erros Restantes do Build

Restam apenas 3 erros TypeScript para o build passar. Sao correcoees cirurgicas em 2 arquivos.

---

## Arquivo 1: `backend/src/controllers/chatwoot.controller.ts`

**Problema:** `req.params.labelId` tem tipo `string | string[]` mas `parseInt` espera `string`.

**Correcao em 2 locais:**
- Linha 219: `const labelId = parseInt(req.params.labelId as string, 10);`
- Linha 242: `const labelId = parseInt(req.params.labelId as string, 10);`

---

## Arquivo 2: `backend/src/services/chatwoot.service.ts`

**Problema:** O spread `...(options.headers || {})` pode trazer um tipo `Headers` ou array, que nao e compativel com `Record<string, string>`.

**Correcao:** Converter explicitamente os headers antes do spread:

```typescript
const baseHeaders: Record<string, string> = {
  'api_access_token': config.apiKey,
  'Content-Type': 'application/json',
};

if (options.headers) {
  const h = options.headers as Record<string, string>;
  Object.assign(baseHeaders, h);
}

const headers = baseHeaders;
```

---

Apos estas 3 correcoes, o build TypeScript do backend deve compilar sem erros.
