

## Plano: Corrigir Detecção de IA no Dashboard

### Diagnóstico

Encontrei **2 bugs críticos** que explicam por que as conversas da IA não estão sendo contabilizadas:

---

### Bug 1: Campo Errado para Atributos Customizados

**Problema**: O código verifica `additional_attributes`, mas o endpoint que você configurou no n8n (`/custom_attributes`) salva os dados em `custom_attributes`.

**Código atual (linha 290)**:
```typescript
const additionalAttrs = conv.additional_attributes || {};
const hasBotMarker = additionalAttrs.ai_responded === true;
```

**Correção**:
```typescript
// Verificar AMBOS os campos
const additionalAttrs = conv.additional_attributes || {};
const customAttrs = conv.custom_attributes || {};

const hasBotMarker = additionalAttrs.ai_responded === true || 
                     customAttrs.ai_responded === true ||
                     // ... outros marcadores
```

---

### Bug 2: Parsing Incorreto de Timestamps

**Problema**: O `created_at` é retornado como Unix timestamp em segundos (ex: `1769631015`), mas o código trata como string ISO.

**Evidência nos logs**:
```
created_at: 1769631015  ← Timestamp Unix em segundos
responseTimeSec: "1767861660.0"  ← Valor absurdo (56 anos!)
```

**Código atual (linha 303)**:
```typescript
const createdAtMs = new Date(conv.created_at).getTime();  // ❌ Errado!
```

**Correção**:
```typescript
// Detectar se é Unix timestamp ou ISO string
const createdAtMs = typeof conv.created_at === 'number'
  ? conv.created_at * 1000  // Unix seconds → ms
  : new Date(conv.created_at).getTime();
```

---

### Alterações Técnicas

**Arquivo**: `supabase/functions/fetch-chatwoot-metrics/index.ts`

1. **Corrigir leitura de atributos customizados**:
   - Verificar `conv.custom_attributes.ai_responded`
   - Manter fallback para `additional_attributes` por compatibilidade

2. **Corrigir parsing de timestamps**:
   - Detectar se `created_at` é número ou string
   - Aplicar mesma lógica em todos os lugares que usam timestamps

3. **Adicionar log detalhado de debug**:
   - Logar `custom_attributes` das primeiras conversas para confirmar que o atributo está chegando

---

### Fluxo Corrigido

```text
Conversa chega
     │
     ▼
┌────────────────────────────────────────┐
│ Verificar custom_attributes            │
│ └─ ai_responded === true ?             │
│    └─ SIM → Contar como IA             │
└────────────────────────────────────────┘
     │ NÃO
     ▼
┌────────────────────────────────────────┐
│ Verificar tempo de resposta            │
│ └─ < 15 segundos ?                     │
│    └─ SIM → Contar como IA             │
└────────────────────────────────────────┘
     │ NÃO
     ▼
┌────────────────────────────────────────┐
│ Verificar assignee                     │
│ └─ type === 'AgentBot' ?               │
│    └─ SIM → Contar como IA             │
│    └─ NÃO → Contar como Humano         │
└────────────────────────────────────────┘
```

---

### Validação

Após a correção, os logs devem mostrar:
```
Conv 11: {
  status: "open",
  custom_attributes: { ai_responded: true },
  responseTimeSec: "0.5",  ← Valor correto agora
  isQuickResponse: true,
  detectedAsBot: true
}

Bot detection results: {
  botConversations: 2,  ← Agora contabilizando!
  humanConversations: 1,
  ...
}
```

