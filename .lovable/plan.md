

## Fix: Novos Leads - Corrigir parsing da API de Contatos do Chatwoot

### Problema

Dois bugs na implementacao atual fazem com que **todos os contatos** sejam contados como "novos", independente do periodo:

1. **Resposta aninhada em `payload`**: A API `GET /contacts/{id}` retorna `{ payload: { id, created_at, ... } }`. O codigo atual faz `return response.json()` e tenta ler `contact.created_at` diretamente — que e `undefined` porque o campo esta dentro de `payload`.

2. **Fallback incorreto**: Quando `created_at` e `undefined`, o codigo executa `count++` (conta como novo). Resultado: 100% dos contatos sao "novos".

3. **Timestamp em segundos**: O Chatwoot retorna `created_at` como Unix epoch em **segundos** (ex: `1709510400`). `new Date(1709510400)` interpreta como milissegundos e gera uma data em 1970, fazendo a comparacao falhar.

### Correcao (ambos os arquivos)

#### 1. Backend — `backend/src/services/chatwoot-metrics.service.ts`

**`fetchContactDetails`** (linhas 167-181): Extrair `data.payload`, retornar `created_at` como numero:

```typescript
async function fetchContactDetails(...): Promise<{ id: number; created_at: number } | null> {
  // ...
  const data = await response.json() as any;
  const contact = data?.payload || data;
  if (!contact?.created_at) return null;
  return { id: contact.id, created_at: contact.created_at };
}
```

**Bloco novosLeads** (linhas 640-644): Converter segundos para ms, e nao contar como novo quando sem dados:

```typescript
for (const contact of results) {
  if (!contact?.created_at) continue;  // sem dados = NAO e novo
  const createdAtMs = typeof contact.created_at === 'number'
    ? contact.created_at * 1000
    : new Date(contact.created_at).getTime();
  if (createdAtMs >= dateFromParsed.getTime()) count++;
}
```

#### 2. Edge Function — `supabase/functions/fetch-chatwoot-metrics/index.ts`

Mesma correcao em `fetchContactDetails` (linhas 144-158) e bloco novosLeads (linhas 655-659).

### Funciona para qualquer periodo

A logica compara `contact.created_at` (data de registro do contato na plataforma) contra `dateFromParsed` (inicio do periodo selecionado). Funciona igual para 7 dias, 30 dias ou periodo customizado — o que muda e so o valor de `dateFromParsed`.

### Arquivos alterados

| Arquivo | Alteracao |
|---------|-----------|
| `backend/src/services/chatwoot-metrics.service.ts` | Fix `fetchContactDetails` (extrair payload, tipo numerico) + fix comparacao timestamp |
| `supabase/functions/fetch-chatwoot-metrics/index.ts` | Mesma correcao |

