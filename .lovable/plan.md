

## Correção: Página Insights crashando — `Cannot read properties of undefined (reading 'split')`

### Causa raiz

A função `getInitials` na linha 635 de `AdminInsightsPage.tsx` recebe `name` como `undefined` quando algum perfil de agente tem `nome` nulo no banco de dados.

```typescript
// ATUAL — crasha com nome undefined
const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
};
```

### Correção

Adicionar fallback defensivo na função `getInitials`:

```typescript
const getInitials = (name: string) => {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
};
```

E também proteger o `agent.name` no ranking para nunca ser undefined:

```typescript
// Linha 454 — adicionar fallback
name: profile.nome || profile.email || 'Sem nome',
```

### Arquivo alterado

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/admin/AdminInsightsPage.tsx` | Fallback em `getInitials` (L635) + fallback em `profile.nome` (L454) |

### Resultado

A página Insights carrega normalmente mesmo com perfis sem nome cadastrado.

