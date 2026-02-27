
# Correcao: Exclusao de Conta Retorna Sucesso mas Conta Permanece Visivel

## Diagnostico

O backend faz **soft delete** (muda status para `cancelled`) e retorna 200 corretamente. O toast "Conta excluida com sucesso!" aparece. Porem:

1. O badge de status (linha 838) so mapeia `active` para "Ativa" e **todo o resto** para "Pausada" — entao contas canceladas aparecem como "Pausada"
2. O filtro de status nao tem opcao "Canceladas"
3. A lista nao filtra contas canceladas por padrao

O resultado e que a conta parece nao ter sido excluida, quando na verdade o status mudou para `cancelled` no banco.

## Solucao

### 1. Frontend: Filtrar contas canceladas da lista padrao

**Arquivo:** `src/pages/super-admin/SuperAdminAccountsPage.tsx`

- No `filteredAccounts`, quando `statusFilter === 'all'`, ocultar contas com status `cancelled`
- Adicionar opcao "Canceladas" no dropdown de filtro para poder visualiza-las quando necessario
- Atualizar o badge para mostrar 3 estados: "Ativa" (verde), "Pausada" (laranja), "Cancelada" (vermelho)
- Atualizar o mapeamento de cores do badge para incluir `cancelled`

### 2. Frontend: Mesma correcao na pagina de detalhe

**Arquivo:** `src/pages/super-admin/SuperAdminAccountDetailPage.tsx`

- Exibir badge "Cancelada" corretamente quando status for `cancelled`

## Resultado Esperado

- Ao excluir uma conta, ela desaparece da lista padrao ("Todos")
- Super admin pode filtrar por "Canceladas" para ver contas excluidas
- Se uma conta cancelada for exibida, mostra badge vermelho "Cancelada" em vez de "Pausada"

## Detalhes Tecnicos

Alteracoes no `filteredAccounts`:
```typescript
const filteredAccounts = accounts.filter((account) => {
  const matchesSearch = account.nome.toLowerCase().includes(searchTerm.toLowerCase());
  if (statusFilter === 'all') {
    return matchesSearch && account.status !== 'cancelled';
  }
  return matchesSearch && account.status === statusFilter;
});
```

Badge atualizado:
```typescript
{account.status === 'active' ? 'Ativa' : account.status === 'cancelled' ? 'Cancelada' : 'Pausada'}
```

Nova opcao no Select:
```typescript
<SelectItem value="cancelled">Canceladas</SelectItem>
```
