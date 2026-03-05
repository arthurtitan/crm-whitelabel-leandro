

## Diagnóstico

As cores no CRM/Kanban estão corretas (dots coloridos), mas no Chatwoot os previews de cor aparecem cinzas/escuros apesar dos códigos hex estarem corretos (22C55E, F59E0B, etc.).

**Causa raiz**: O método `createLabel` no `chatwoot.service.ts` remove o `#` do hex:
```typescript
color: (input.color || '#6366F1').replace('#', ''),  // Envia "22C55E" ao invés de "#22C55E"
```

A API do Chatwoot espera o formato **com** `#` para renderizar a cor corretamente na sidebar. Sem o `#`, o Chatwoot armazena o valor mas não consegue interpretar como cor válida.

O mesmo problema ocorre no `updateLabel`:
```typescript
if (input.color) body.color = input.color.replace('#', '');
```

## Correção

**Arquivo: `backend/src/services/chatwoot.service.ts`**

1. No `createLabel` (linha 280): parar de remover o `#`:
```typescript
color: input.color || '#6366F1',   // Manter "#22C55E" formato completo
```

2. No `updateLabel` (linha 302): parar de remover o `#`:
```typescript
if (input.color) body.color = input.color;   // Manter "#22C55E"
```

## Atualizar labels existentes

Após o deploy, basta clicar **"Enviar Etapas"** no Kanban — o `syncAllLabels` vai chamar `updateLabel` para cada tag, enviando a cor com `#` e corrigindo todas as labels no Chatwoot de uma vez.

