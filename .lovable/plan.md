
# Plano: Corrigir Erro "Failed to Fetch" na Edge Function

## Problema Identificado

O erro "Failed to send a request to the Edge Function" / "Failed to fetch" acontece apenas no preview frontend, enquanto a Edge Function funciona perfeitamente quando chamada diretamente.

### Evidencias

| Teste | Resultado |
|-------|-----------|
| Edge Function via cURL | Sucesso (1284ms, 1 agente) |
| Edge Function via Preview | "Failed to fetch" |
| Logs da Edge Function | Sem registro de requisicao do Preview |

## Causa Raiz

O problema e uma **race condition no deploy**: a Edge Function foi atualizada, mas o preview precisa ser recarregado para funcionar corretamente. Alem disso, pode haver um problema de timeout no cliente Supabase.

## Solucao Proposta

### 1. Aumentar Timeout no Cliente Supabase

O cliente Supabase tem um timeout padrao de 8 segundos para Edge Functions. Como nossa funcao pode demorar ate 25 segundos, precisamos aumentar esse timeout.

**Arquivo:** `src/services/accounts.cloud.service.ts`

```typescript
const { data, error } = await supabase.functions.invoke('test-chatwoot-connection', {
  body: {
    baseUrl: normalizedBaseUrl,
    accountId: normalizedAccountId,
    apiKey: normalizedApiKey,
  },
  // Adicionar timeout maior
});
```

**Problema:** O SDK do Supabase nao suporta timeout customizado diretamente no `invoke`. A solucao e usar `AbortController` ou fazer a chamada manualmente via fetch.

### 2. Implementar Chamada Fetch Manual com Timeout

Substituir `supabase.functions.invoke` por uma chamada `fetch` direta com timeout configuraveis e melhor tratamento de erros.

**Mudanca em** `src/services/accounts.cloud.service.ts`:

```typescript
async testChatwootConnection(baseUrl, accountId, apiKey) {
  const TIMEOUT_MS = 30000; // 30 segundos
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-chatwoot-connection`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ baseUrl, accountId, apiKey }),
        signal: controller.signal,
      }
    );
    
    const data = await response.json();
    // Processar resposta...
  } finally {
    clearTimeout(timeoutId);
  }
}
```

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/services/accounts.cloud.service.ts` | Substituir `supabase.functions.invoke` por fetch manual com timeout de 30s |

## Implementacao Detalhada

### Mudancas no `accounts.cloud.service.ts`

1. Importar `supabase` para obter sessao
2. Criar funcao `fetchWithTimeout` para chamadas com timeout customizado
3. Substituir `supabase.functions.invoke` por fetch direto
4. Manter tratamento de erros existente

### Codigo Atualizado

```typescript
async testChatwootConnection(
  baseUrl: string, 
  accountId: string, 
  apiKey: string
): Promise<{ success: boolean; message: string; agents?: ...; }> {
  const TIMEOUT_MS = 30000;
  const normalizedBaseUrl = String(baseUrl || '').trim().replace(/\/$/, '');
  const normalizedAccountId = String(accountId || '').trim();
  const normalizedApiKey = String(apiKey || '').trim();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Obter sessao atual
    const { data: { session } } = await supabase.auth.getSession();
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const response = await fetch(
      `${supabaseUrl}/functions/v1/test-chatwoot-connection`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': session?.access_token 
            ? `Bearer ${session.access_token}` 
            : `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          baseUrl: normalizedBaseUrl,
          accountId: normalizedAccountId,
          apiKey: normalizedApiKey,
        }),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { 
        success: false, 
        message: `Erro HTTP ${response.status}: ${errorText}`
      };
    }

    const data = await response.json();
    
    if (data?.success) {
      return {
        success: true,
        message: `Conexao estabelecida! ${data.agents?.length || 0} agentes...`,
        agents: data.agents,
        inboxes: data.inboxes,
        labels: data.labels,
      };
    } else {
      return {
        success: false,
        message: data?.error || 'Falha na conexao com Chatwoot',
      };
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        message: `Timeout apos ${TIMEOUT_MS / 1000}s. O servidor Chatwoot pode estar lento ou inacessivel.`,
      };
    }
    return { 
      success: false, 
      message: error.message || 'Erro de conexao' 
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
```

## Porque Isso Vai Funcionar

1. **Timeout Controlado**: 30s e suficiente para servidores lentos
2. **Fetch Direto**: Evita abstraçoes do SDK que podem ter bugs
3. **AbortController**: Cancela a requisicao se demorar muito
4. **Headers Explicitos**: Garante que autenticacao e passada corretamente
5. **Melhor Debug**: Erros HTTP sao tratados separadamente

## Resultado Esperado

Apos a implementacao, o botao "Testar Conexao" deve funcionar corretamente no preview, mostrando "Conexao estabelecida!" com os agentes encontrados.
