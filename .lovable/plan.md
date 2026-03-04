

## Correção: Páginas em branco na navegação interna

### Causa raiz

O sistema **não possui Error Boundary** (React). Qualquer erro JavaScript durante a renderização derruba toda a árvore de componentes, resultando em página em branco sem feedback visual.

Os logs do backend mostram respostas 200/304 normais — o problema é **exclusivamente no frontend**.

### Ponto de crash confirmado

**`src/pages/admin/AdminLeadsPage.tsx` linha 383:**
```typescript
{format(new Date(contact.created_at), 'dd/MM/yyyy', { locale: ptBR })}
```
Se qualquer contato tiver `created_at` como `null`, `undefined` ou formato inválido, `date-fns format()` lança uma exceção que derruba a página inteira.

O mesmo padrão inseguro existe em mais 5 arquivos (50 ocorrências no total).

### Plano de correção

#### 1. Criar componente ErrorBoundary
**Novo arquivo:** `src/components/ErrorBoundary.tsx`

Componente React class que captura erros de renderização e exibe UI de recuperação ("Tentar novamente") em vez de tela branca.

#### 2. Criar helper de formatação segura de datas
**Novo arquivo:** `src/utils/dateUtils.ts`

```typescript
export function safeFormatDate(date: string | number | Date | null | undefined, fmt: string, options?: { locale?: Locale }): string {
  if (!date) return '-';
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '-';
    return format(d, fmt, options);
  } catch { return '-'; }
}
```

#### 3. Aplicar ErrorBoundary nas rotas
**Arquivo:** `src/App.tsx`

Envolver cada rota admin e super-admin com `<ErrorBoundary>` para que crashes fiquem contidos por página.

#### 4. Substituir `format(new Date(...))` inseguro em todas as páginas

| Arquivo | Linhas afetadas |
|---------|----------------|
| `src/pages/admin/AdminLeadsPage.tsx` | L383 |
| `src/pages/admin/AdminKanbanPage.tsx` | L817 |
| `src/pages/admin/AdminEventsPage.tsx` | L202, L455, L481, L586 |
| `src/pages/super-admin/SuperAdminAccountsPage.tsx` | L856 |
| `src/pages/super-admin/SuperAdminAccountDetailPage.tsx` | L432, L440, L448, L456 |
| `src/pages/super-admin/SuperAdminUsersPage.tsx` | L776 |

Todas as chamadas `format(new Date(x), ...)` serão substituídas por `safeFormatDate(x, ...)`.

### Resultado esperado

- Nenhuma página fica em branco — erros mostram UI de recuperação
- Datas inválidas exibem "-" em vez de crashar
- Navegação entre todas as páginas admin funciona normalmente
- Zero impacto em dados válidos — formatação idêntica quando os dados existem

