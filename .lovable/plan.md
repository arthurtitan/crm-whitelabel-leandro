

# Plano: Corrigir Headers da Edge Function para Compatibilidade com Chatwoot

## Problema Real Identificado

Após sua confirmação de que a API funciona, analisei o código e identifiquei possíveis problemas de compatibilidade na requisição:

1. **Falta de User-Agent** - Algumas instâncias Chatwoot (especialmente com Cloudflare) bloqueiam requisições sem User-Agent
2. **Header Content-Type desnecessário em GET** - Pode causar problemas em alguns servidores
3. **Falta de Accept header** - O servidor pode não saber que esperamos JSON

## Comparação: Código Atual vs Documentação

```text
┌─────────────────────────────────────┬─────────────────────────────────────┐
│        CÓDIGO ATUAL                 │      DOCUMENTAÇÃO CHATWOOT          │
├─────────────────────────────────────┼─────────────────────────────────────┤
│ headers: {                          │ --header 'api_access_token: <key>'  │
│   'api_access_token': apiKey,       │                                     │
│   'Content-Type': 'application/json'│ (sem Content-Type para GET)         │
│ }                                   │ (sem User-Agent especificado)       │
└─────────────────────────────────────┴─────────────────────────────────────┘
```

## Solução Proposta

### Modificações no `supabase/functions/test-chatwoot-connection/index.ts`

1. **Adicionar User-Agent** para evitar bloqueio por bots:
```typescript
headers: {
  'api_access_token': normalizedApiKey,
  'Accept': 'application/json',
  'User-Agent': 'LovableCRM/1.0 (Chatwoot Integration)',
}
```

2. **Remover Content-Type do GET** - Não é necessário e pode causar problemas

3. **Adicionar log do host e IP** para debug adicional:
```typescript
console.log(`[Chatwoot Test] Host: ${new URL(normalizedBaseUrl).hostname}`);
```

4. **Tentar DNS diferente** - Usar fetch com redirect: 'follow' explícito

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/test-chatwoot-connection/index.ts` | Corrigir headers da requisição |

---

## Código Atualizado

```typescript
const commonInit: RequestInit = {
  method: 'GET',
  headers: {
    'api_access_token': normalizedApiKey,
    'Accept': 'application/json',
    'User-Agent': 'LovableCRM/1.0 (Chatwoot Integration)',
  },
  redirect: 'follow',
};
```

---

## Por que isso deve funcionar

1. **User-Agent** - Cloudflare e proxies reversos frequentemente bloqueiam requisições sem identificação
2. **Accept header** - Informa ao servidor que esperamos JSON, melhor do que Content-Type em GET
3. **redirect: 'follow'** - Garante que redirecionamentos HTTP sejam seguidos automaticamente
4. **Remoção de Content-Type** - Em requisições GET, este header pode causar comportamento inesperado

---

## Resultado Esperado

Após deploy, a Edge Function deve conseguir conectar ao `https://atendimento.gleps.com.br` corretamente e retornar os agentes, inboxes e labels.

