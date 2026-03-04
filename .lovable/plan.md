

## Correção definitiva: Google Calendar — erro 500 mascarado em produção

### Causa raiz identificada

O problema não está nas variáveis de ambiente (sua configuração está correta). O problema é que o backend **mascara** o erro real em produção:

1. `calendar.service.ts` lança um `Error('Google Calendar não configurado')` genérico
2. O `errorHandler` em produção **esconde** a mensagem de qualquer `Error` que não seja `AppError`, retornando apenas `"Erro interno do servidor"` (linha 127)
3. O frontend nunca recebe a mensagem real, então o toast de mensagem amigável que adicionamos anteriormente nunca dispara

### Correções (3 arquivos)

**1. `backend/src/services/calendar.service.ts`** — Usar `AppError` em vez de `Error` genérico

Nas linhas 193-194 e 218-219, trocar:
```typescript
// ANTES
throw new Error('Google Calendar não configurado');

// DEPOIS
throw new AppError('Google Calendar não configurado no servidor. Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI.', 422, 'GOOGLE_NOT_CONFIGURED');
```

Isso garante que o middleware retorna status 422 com a mensagem real, em vez de 500 genérico.

**2. `backend/src/server.ts`** — Log de diagnóstico no startup

Adicionar após o bootstrap um log que confirma se o Google Calendar está configurado:
```typescript
logger.info(`📅 Google Calendar: ${env.GOOGLE_CLIENT_ID ? 'configurado' : 'NÃO configurado'}`);
```

Assim, após cada rebuild, o log mostra imediatamente se as variáveis chegaram ao container.

**3. `src/contexts/CalendarContext.tsx`** — Capturar também o código `GOOGLE_NOT_CONFIGURED`

Ajustar a detecção de erro para também verificar o campo `code` da resposta, não apenas a string da mensagem:
```typescript
const code = error?.response?.data?.error?.code || '';
const msg = error?.response?.data?.error?.message || error?.message || '';
if (code === 'GOOGLE_NOT_CONFIGURED' || msg.includes('não configurado')) {
  toast.error('Google Calendar ainda não foi configurado...');
}
```

### Resultado após rebuild

- Se as variáveis estiverem no container: a conexão funciona normalmente
- Se não estiverem: o log de startup mostra `📅 Google Calendar: NÃO configurado` e o frontend exibe mensagem amigável em vez de "Erro interno do servidor"
- Zero intervenção manual necessária

