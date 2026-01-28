

## Plano: Correção Definitiva do Sistema de Login

### Problema Identificado

O login apresenta comportamento intermitente devido a **race conditions** no `AuthContext`:

1. **Dependências problemáticas no useEffect**: O listener `onAuthStateChange` é recriado a cada mudança de `authState.user?.id` e `authState.isAuthenticated`, causando perda de eventos de autenticação
2. **Falta de verificação inicial de sessão**: Não há `getSession()` ao montar o componente, dependendo apenas do listener para sessões existentes
3. **Closures desatualizadas**: O handler usa referências de estado que ficam "stale" quando o listener é recriado

### Solução Proposta

Refatorar o `AuthContext` usando o padrão recomendado pelo Supabase com `useRef` para evitar closures stale e garantir estabilidade do listener.

---

### Mudanças Técnicas

#### 1. Refatorar AuthContext.tsx

```typescript
// Usar useRef para manter referência estável ao user atual
const currentUserRef = useRef<string | null>(null);
const isHydratingRef = useRef(false);

// useEffect com dependência APENAS em hydrateUser (função estável via useCallback)
useEffect(() => {
  let mounted = true;

  const initAuth = async () => {
    // 1. Primeiro configurar o listener ANTES de verificar sessão
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        // Usar refs para verificar estado atual sem depender do closure
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user && currentUserRef.current !== session.user.id) {
            if (!isHydratingRef.current) {
              isHydratingRef.current = true;
              await hydrateUser(session.user);
              currentUserRef.current = session.user.id;
              isHydratingRef.current = false;
            }
          }
        } else if (event === 'SIGNED_OUT') {
          currentUserRef.current = null;
          // Reset state
        }
      }
    );

    // 2. Depois verificar sessão existente
    const { data: { session } } = await supabase.auth.getSession();
    if (mounted && session?.user && !currentUserRef.current) {
      await hydrateUser(session.user);
      currentUserRef.current = session.user.id;
    } else if (mounted && !session) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }

    return subscription;
  };

  let subscription: any;
  initAuth().then(sub => { subscription = sub; });

  return () => {
    mounted = false;
    subscription?.unsubscribe();
  };
}, [hydrateUser]); // APENAS hydrateUser como dependência
```

#### 2. Simplificar LoginPage.tsx

- Remover estados intermediários complexos (`loginSuccess`)
- Confiar no redirecionamento via `useEffect` quando `isAuthenticated` mudar
- Adicionar timeout de fallback apenas para UX (não para lógica)

#### 3. Adicionar logging detalhado para debug

Console logs em pontos críticos:
- Quando `getSession()` é chamado
- Quando `onAuthStateChange` dispara cada evento
- Quando hydration inicia/completa
- Quando redirecionamento ocorre

---

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/contexts/AuthContext.tsx` | Refatorar useEffect com useRef, adicionar getSession inicial |
| `src/pages/LoginPage.tsx` | Simplificar lógica de estados |

---

### Benefícios

- Listener de auth **criado apenas uma vez** na montagem
- **Refs** previnem closures stale e re-criação desnecessária
- `getSession()` garante recuperação de sessões existentes
- Flag `isHydratingRef` previne hydrations duplicadas
- Código mais previsível e fácil de debugar

