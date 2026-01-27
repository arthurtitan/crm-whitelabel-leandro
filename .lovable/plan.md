
# Plano: Corrigir Timeout na Conexão com Chatwoot

## Problema Identificado

A Edge Function `test-chatwoot-connection` está dando timeout após **15 segundos** ao tentar conectar com a instância Chatwoot em `https://atendimento.gleps.com.br`. Os logs confirmam:

```
2026-01-27T07:55:24Z INFO Testing Chatwoot connection: https://atendimento.gleps.com.br/api/v1/accounts/1/agents
2026-01-27T07:55:39Z ERROR AbortError: The signal has been aborted
```

O intervalo de 15 segundos (07:55:24 → 07:55:39) mostra que o timeout está sendo atingido exatamente no limite configurado.

## Causas Prováveis

1. **Servidor Chatwoot lento** - A instância pode estar sobrecarregada
2. **Firewall/Cloudflare** - Proteções podem estar limitando ou atrasando requisições de IPs externos (servidores Supabase)
3. **Latência geográfica** - Distância entre servidor da Edge Function e servidor Chatwoot

## Solução Proposta

### 1. Aumentar Timeout da Edge Function

Aumentar de 15 segundos para **45 segundos** para dar mais tempo ao servidor Chatwoot responder:

```typescript
// Antes
const CHATWOOT_FETCH_TIMEOUT_MS = 15000;

// Depois  
const CHATWOOT_FETCH_TIMEOUT_MS = 45000;
```

### 2. Adicionar Logs de Diagnóstico

Incluir timestamps para medir exatamente quanto tempo cada etapa demora:

```typescript
console.log(`[${Date.now()}] Iniciando conexão com: ${agentsUrl}`);
// ... fetch
console.log(`[${Date.now()}] Resposta recebida em ${elapsed}ms`);
```

### 3. Melhorar Mensagens de Erro

Fornecer informações mais úteis quando ocorrer timeout:

- Mostrar a URL que estava sendo acessada
- Sugerir verificar se o servidor está acessível
- Indicar possíveis problemas de firewall

### 4. Adicionar Retry Automático

Implementar uma tentativa automática caso a primeira falhe (útil para instabilidades temporárias):

```typescript
async function fetchWithRetry(url: string, init: RequestInit, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fetchWithTimeout(url, init);
    } catch (error) {
      if (attempt === retries) throw error;
      console.log(`Tentativa ${attempt} falhou, tentando novamente...`);
      await new Promise(r => setTimeout(r, 1000)); // Espera 1s entre tentativas
    }
  }
}
```

---

## Arquivo a Modificar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/test-chatwoot-connection/index.ts` | **MODIFICAR** - Aumentar timeout, adicionar retry e logs |

---

## Código Atualizado

A Edge Function será atualizada com:

1. **Timeout de 45 segundos** (era 15s)
2. **2 tentativas automáticas** com intervalo de 2 segundos
3. **Logs detalhados** com timestamps para debug
4. **Mensagem de erro melhorada** com sugestões de solução
5. **Fallback para buscar apenas agentes** se inboxes/labels demorarem

---

## Resultado Esperado

- Conexões lentas (até 45s) serão bem-sucedidas
- Em caso de falha intermitente, haverá retry automático
- Mensagens de erro mais informativas ajudarão no diagnóstico
- Logs detalhados facilitarão debug futuro
