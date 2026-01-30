

## Plano: Correção do Backlog de Atendimento

### Problema Identificado
O **Backlog de Atendimento** depende do campo `waiting_since` da API do Chatwoot, que pode não estar disponível em todas as conversas ou versões do Chatwoot. Se este campo não estiver presente, o backlog retornará sempre **zeros**.

### Solução Proposta
Implementar uma lógica de **fallback** que calcule o tempo de espera de forma alternativa quando `waiting_since` não estiver disponível.

---

### Alterações Técnicas

#### 1. Edge Function: `fetch-chatwoot-metrics/index.ts`
Atualizar a lógica de cálculo do backlog (linhas 310-318):

**De:**
```typescript
if (conv.status === 'open' && conv.waiting_since) {
  const waitingMs = now - (conv.waiting_since * 1000);
  // ...
}
```

**Para:**
```typescript
if (conv.status === 'open') {
  let waitingMs: number;
  
  if (conv.waiting_since) {
    // Usar waiting_since se disponível (timestamp Unix em segundos)
    waitingMs = now - (conv.waiting_since * 1000);
  } else {
    // Fallback: usar last_activity_at ou created_at
    const lastActivity = conv.last_activity_at 
      ? conv.last_activity_at * 1000 
      : new Date(conv.created_at).getTime();
    waitingMs = now - lastActivity;
  }
  
  const waitingMinutes = waitingMs / 60000;
  
  if (waitingMinutes <= 15) backlog.ate15min++;
  else if (waitingMinutes <= 60) backlog.de15a60min++;
  else backlog.acima60min++;
}
```

#### 2. Adicionar Log de Debug
Para ajudar a diagnosticar problemas futuros:
```typescript
console.log('[Chatwoot Metrics] Backlog calculation:', {
  openConversations: finalConversations.filter(c => c.status === 'open').length,
  withWaitingSince: finalConversations.filter(c => c.waiting_since).length,
  backlog,
});
```

---

### Fluxo Atualizado

```text
┌─────────────────────────────────────────────────────────────┐
│               Cálculo do Backlog de Atendimento             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Para cada conversa com status = 'open':                    │
│                                                             │
│  1. waiting_since existe?                                   │
│     ├─ SIM → usar waiting_since como referência             │
│     └─ NÃO → usar last_activity_at ou created_at            │
│                                                             │
│  2. Calcular tempo de espera em minutos                     │
│                                                             │
│  3. Classificar:                                            │
│     ├─ ≤ 15 min  → ate15min (verde)                         │
│     ├─ 15-60 min → de15a60min (amarelo)                     │
│     └─ > 60 min  → acima60min (vermelho)                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Benefícios
- Backlog funciona mesmo sem o campo `waiting_since`
- Compatível com diferentes versões do Chatwoot
- Log de debug para diagnosticar problemas futuros

### Arquivos a Modificar
- `supabase/functions/fetch-chatwoot-metrics/index.ts`

