
# Plano de Correção Completa: Sistema de Autenticação e Chatwoot

## Problemas Identificados

### 1. Login Travando na Tela "Carregando seu perfil..."
**Causa Raiz:**
Através dos logs de console e testes no browser, identifico que:
- A hidratação do usuário está atingindo timeout de 12 segundos
- Quando a sessão já existe (INITIAL_SESSION ou TOKEN_REFRESHED), o sistema tenta re-hidratar mas falha ou demora excessivamente
- O `fetchWithTimeout` usando `Promise.race` não cancela efetivamente a Promise do Supabase - apenas ignora o resultado, causando comportamento inconsistente

**Log real capturado:**
```
[Auth] Event: SIGNED_IN
[Auth] Hydrating user: eda770a4-79e4-4656-94df-42a23e433f31
[Auth] Hydration failed: Timeout
```

### 2. Chatwoot "Failed to send a request to the Edge Function"
**Causa Raiz:**
- A Edge Function `test-chatwoot-connection` estava desligada (cold start)
- Após deployment, ela funciona corretamente (testei e retornou dados)

---

## Mudanças Planejadas

### Arquivo 1: `src/contexts/AuthContext.tsx`

**Mudança Principal:** Simplificar drasticamente o fluxo de hidratação e remover timeout problemático.

**Antes (problemático):**
```typescript
const fetchWithTimeout = async <T,>(promise: Promise<T>, timeoutMs: number) => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), timeoutMs)
  );
  return Promise.race([promise, timeout]);
};
```

**Problemas:**
1. O timeout de 12s é muito longo para UX, mas às vezes não é suficiente
2. `Promise.race` não cancela a query real do Supabase
3. A Promise original continua rodando e pode resolver após o timeout

**Depois (simples e robusto):**
```typescript
// Remover fetchWithTimeout completamente
// Confiar no timeout nativo do Supabase SDK (60s por padrão)
// Se falhar, o erro será tratado normalmente
```

**Fluxo de Hidratação Simplificado:**
1. Fazer fetch paralelo de `profiles` e `user_roles` diretamente
2. Se houver erro de rede, o SDK do Supabase retornará erro
3. Mostrar erro claro ao usuário em vez de timeout genérico
4. Remover refs de concorrência desnecessários

**Código Novo para `hydrateUser`:**
```typescript
const hydrateUser = useCallback(async (supabaseUser: SupabaseUser): Promise<boolean> => {
  console.log('[Auth] Hydrating user:', supabaseUser.id);

  try {
    // Fetch profile and role in parallel - sem timeout artificial
    const [profileResult, roleResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('user_id, email, nome, status, permissions, account_id, chatwoot_agent_id')
        .eq('user_id', supabaseUser.id)
        .maybeSingle(),
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', supabaseUser.id)
        .maybeSingle(),
    ]);

    // ... resto da lógica igual
  } catch (error: any) {
    // Tratar erro real, não timeout artificial
  }
}, []);
```

**Mudança no Listener de Auth:**
```typescript
const handleAuthChange = async (event: string, session: any) => {
  if (!mounted) return;
  console.log('[Auth] Event:', event);

  if (session?.user) {
    // Hidratar apenas se não temos usuário OU se o ID mudou
    if (!authState.user || authState.user.id !== session.user.id) {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      await hydrateUser(session.user);
    }
    // Se já está hidratado com mesmo ID, não fazer nada
  } else if (event === 'SIGNED_OUT' || !session) {
    // Limpar estado
    setAuthState({
      user: null,
      account: null,
      isAuthenticated: false,
      isLoading: false,
      authError: null,
    });
  }
};
```

### Arquivo 2: `src/pages/LoginPage.tsx`

**Mudança:** Remover o timeout de 15s para o login e simplificar o fluxo.

**Antes:**
```typescript
const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
  setTimeout(() => {
    console.warn('[LoginPage] SignIn timeout reached');
    resolve({ success: false, error: 'Tempo excedido...' });
  }, SIGNIN_TIMEOUT_MS);
});

const result = await Promise.race([login(email, password), timeoutPromise]);
```

**Depois:**
```typescript
const result = await login(email, password);
// Sem timeout artificial - o SDK do Supabase tem seu próprio timeout
```

### Arquivo 3: `src/pages/NotFound.tsx`

**Mudança:** Trocar `<a href="/">` por `<Link to="/">` para evitar reload completo.

**Antes:**
```tsx
<a href="/" className="text-primary underline hover:text-primary/90">
  Return to Home
</a>
```

**Depois:**
```tsx
<Link to="/login" className="text-primary underline hover:text-primary/90">
  Voltar para o Login
</Link>
```

---

## Resumo das Correções

| Problema | Causa | Solução |
|----------|-------|---------|
| Login trava em "Carregando perfil" | Timeout artificial de 12s interferindo | Remover timeout, confiar no SDK |
| Re-hidratação desnecessária | Verificação por ref não funciona bem | Verificar pelo state diretamente |
| Navegação recarrega tudo | Algumas tags `<a>` em vez de `<Link>` | Trocar para `<Link>` do React Router |
| Chatwoot "Failed to send" | Edge Function não estava ativa | Já corrigido via deploy |

---

## Detalhes Técnicos

### Por que o timeout era problemático

O padrão `Promise.race([fetch, timeout])` tem um problema fundamental:

1. Se o timeout "ganha", a Promise do fetch continua executando
2. Se o fetch completar depois, pode setar estado em momento inesperado
3. O Supabase SDK já tem retry/timeout interno configurado

### Nova Arquitetura de Hidratação

```text
SIGNED_IN event
    |
    v
authState.user?.id === session.user.id ?
    |                     |
   YES                   NO
    |                     |
    v                     v
  (noop)          setAuthState(loading)
                          |
                          v
                  Promise.all([profile, role])
                          |
                     success?
                    /      \
                  YES       NO
                   |         |
                   v         v
              setAuthState  signOut + 
              (hydrated)    setAuthState(error)
```

### Arquivos Modificados

1. `src/contexts/AuthContext.tsx` - Simplificar hidratação
2. `src/pages/LoginPage.tsx` - Remover timeout artificial
3. `src/pages/NotFound.tsx` - Usar Link do React Router

---

## Resultados Esperados

1. Login resolve em ~1-3 segundos (tempo real de rede)
2. Sem timeouts artificiais causando falsos erros
3. Navegação entre páginas é instantânea (sem re-hidratação)
4. Erros reais do banco/rede são mostrados claramente
5. Edge Function do Chatwoot já está funcionando

---

## Validação Pós-Implementação

1. Login como Super Admin - deve funcionar em segundos
2. Navegar para Contas, Usuários - sem tela de loading
3. Testar conexão Chatwoot - deve retornar agentes/inboxes
4. Logout e login novamente - fluxo limpo
5. Refresh da página (F5) - sessão mantida sem travamento
