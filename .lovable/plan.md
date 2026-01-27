
# Plano: Otimização do Sistema de Autenticação e Rotas

## Problema Identificado

O sistema apresenta lentidão e travamentos após login/logout porque:

1. O AuthContext está com lógica excessivamente complexa (retries, timeouts de 15s, múltiplos estados)
2. O logout não aguarda a conclusão antes de navegar
3. Os contextos (Tag, Finance, etc) recarregam dados mockados pesados a cada mount
4. O ProtectedRoute bloqueia a UI enquanto `isLoading = true`

---

## Mudanças Planejadas

### 1. Simplificar o AuthContext

**Arquivo:** `src/contexts/AuthContext.tsx`

Remover toda a complexidade desnecessária:
- Reduzir timeout de 15s para 5s (suficiente para conexões normais)
- Remover sistema de retries (se falhar uma vez, mostrar erro claro)
- Simplificar a função `hydrateUser` para um fluxo linear sem complexidade
- Garantir que o estado `isLoading` seja setado corretamente em todos os cenários

Antes (complexo):
```text
- fetchWithTimeout com retries
- hydrationIdRef para controle de concorrência
- Múltiplas verificações de hydrationId
- Timeout de 15 segundos
```

Depois (simples):
```text
- Fetch direto com AbortController para timeout
- Único fluxo de hidratação
- Timeout de 5 segundos
- Erro claro se falhar
```

### 2. Corrigir o Logout nos Layouts

**Arquivos:** `src/layouts/SuperAdminLayout.tsx`, `src/layouts/AdminLayout.tsx`

Problema atual:
```typescript
const handleLogout = () => {
  logout();          // Async, mas não aguarda
  navigate('/login'); // Navega antes do logout completar
};
```

Solução:
```typescript
const handleLogout = async () => {
  await logout();     // Aguarda conclusão
  navigate('/login'); // Navega apenas após logout
};
```

### 3. Otimizar o ProtectedRoute

**Arquivo:** `src/components/auth/ProtectedRoute.tsx`

Adicionar fallback com timeout para evitar loading infinito:
- Se `isLoading` por mais de 3s, redirecionar para login
- Isso previne o usuário ficar preso na tela de loading

### 4. Lazy Loading para Contextos Pesados

**Arquivo:** `src/App.tsx`

Mover os contextos pesados (Tag, Finance, Product, Calendar) para serem carregados sob demanda, não no boot da aplicação.

Estrutura atual:
```text
App
  └── AuthProvider
        └── Routes
              └── ProtectedRoute
                    └── AdminFinanceWrapper (carrega 4 contextos)
                          └── AdminLayout
                                └── Page
```

O problema é que `AdminFinanceWrapper` carrega dados mockados pesados mesmo antes do usuário estar autenticado.

---

## Detalhes Técnicos

### AuthContext Simplificado

| Antes | Depois |
|-------|--------|
| 600+ linhas | ~300 linhas |
| Retries com delay | Falha rápida com mensagem clara |
| Timeout 15s | Timeout 5s |
| hydrationIdRef complexo | Estado simples |
| fetchWithTimeout genérico | AbortController nativo |

### Fluxo de Hidratação Otimizado

```text
1. signInWithPassword (retorno imediato)
2. onAuthStateChange SIGNED_IN
3. Promise.all([profile, role]) com timeout 5s
4. Se super_admin: pronto
5. Se admin/agent: fetch account
6. Setar estado final
```

### Tratamento de Logout

```text
1. Usuário clica "Sair"
2. Setar isLoading = true
3. Chamar supabase.auth.signOut()
4. Limpar estados locais
5. Setar isLoading = false
6. Navegar para /login
```

---

## Arquivos a Serem Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/contexts/AuthContext.tsx` | Simplificar lógica de hidratação, reduzir timeout |
| `src/layouts/SuperAdminLayout.tsx` | Adicionar `await` no logout |
| `src/layouts/AdminLayout.tsx` | Adicionar `await` no logout |
| `src/components/auth/ProtectedRoute.tsx` | Adicionar timeout de segurança |
| `src/App.tsx` | Otimizar estrutura de providers |

---

## Resultados Esperados

1. Login resolve em menos de 2 segundos (em condições normais)
2. Logout completa instantaneamente sem travamentos
3. Navegação fluida entre páginas
4. Sem estados "presos" de loading
5. Código mais simples e fácil de manter

---

## Validação

Após implementação, testar:

1. Login como Super Admin, Admin e Agent
2. Navegação entre páginas no painel
3. Logout e relogin imediato
4. Refresh da página (F5)
5. Acesso direto a URLs protegidas
