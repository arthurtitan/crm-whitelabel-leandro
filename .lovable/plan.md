

# Correcao: Navegacao ao sair da impersonacao

## Problema

Quando o Super Admin clica em "Sair" na barra de impersonacao, o sistema restaura o estado do usuario original corretamente, mas **nao navega** de volta ao painel Super Admin. O usuario permanece na rota `/admin` (dashboard do cliente), que exibe o erro "Chatwoot nao configurado" porque a conta do Super Admin nao possui integracao.

## Causa raiz

As funcoes `exitImpersonation` nos dois AuthContexts (`AuthContext.tsx` e `AuthContext.backend.tsx`) apenas atualizam o estado React, sem fazer navegacao. Os botoes "Sair" nos layouts chamam `exitImpersonation` diretamente, sem redirecionar.

## Correcao

Alterar os dois pontos de chamada nos layouts (`AdminLayout.tsx` e `SuperAdminLayout.tsx`) para navegar ao `/super-admin` apos sair da impersonacao. Isso e mais limpo do que colocar navegacao dentro do contexto de autenticacao (que nao deve conhecer rotas).

### Arquivos alterados

**1. `src/layouts/AdminLayout.tsx`**
- Criar funcao `handleExitImpersonation` que chama `exitImpersonation()` e depois `navigate('/super-admin')`
- Substituir as 3 referencias a `exitImpersonation` pelo novo handler (dropdown menu item, botao na barra amarela)

**2. `src/layouts/SuperAdminLayout.tsx`**
- Mesma alteracao: criar `handleExitImpersonation` com navegacao para `/super-admin`
- Substituir as referencias nos mesmos pontos (dropdown e barra)

### Exemplo da mudanca

```typescript
// Em ambos os layouts:
const handleExitImpersonation = useCallback(() => {
  exitImpersonation();
  navigate('/super-admin');
}, [exitImpersonation, navigate]);

// Substituir onClick={exitImpersonation} por onClick={handleExitImpersonation}
```

## Impacto

- Zero alteracao nos contextos de autenticacao ou backend
- Apenas 2 arquivos frontend alterados
- Comportamento esperado: ao clicar "Sair", o Super Admin volta ao painel de administracao global
