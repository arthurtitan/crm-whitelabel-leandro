
# Plano: Experiência Premium de Atualização do Kanban

## Problema Atual
O Kanban sofre de "flickering" visual onde toda a tela pisca a cada atualização de dados. Isso acontece porque:
- O estado `isLoading` faz o conteúdo desaparecer completamente
- Cada sincronização chama `fetchData()` que reseta tudo
- Não há atualização em tempo real - usuário depende de cliques manuais

## Solução Proposta
Implementar um sistema de atualização "silenciosa" com três pilares:

### 1. Atualização em Tempo Real (Realtime)
Os novos leads aparecerão automaticamente no Kanban sem necessidade de clicar em "Sincronizar", usando a tecnologia nativa do backend.

### 2. Merge Inteligente de Dados
Em vez de substituir todos os dados a cada atualização, o sistema vai:
- Adicionar novos leads suavemente
- Atualizar leads existentes sem remover da tela
- Mover leads entre colunas com animação

### 3. Animações de Transição
Cards de leads terão animações CSS ao entrar/sair, criando uma experiência visual premium.

---

## Detalhes Técnicos

### Arquivo 1: Hook de Realtime para Contatos
**Novo arquivo**: `src/hooks/useRealtimeContacts.ts`

Cria um hook que:
- Subscreve às mudanças na tabela `contacts`
- Processa INSERT/UPDATE/DELETE de forma granular
- Faz merge com estado existente sem flickering

```text
┌─────────────────────────────────────────────────────────────────┐
│                     useRealtimeContacts                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐     ┌───────────────┐     ┌──────────────────┐   │
│  │ Supabase │────▶│ postgres_      │────▶│ Merge Inteligente│   │
│  │ Realtime │     │ changes        │     │ (sem flickering) │   │
│  └──────────┘     └───────────────┘     └──────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│ Eventos: INSERT → adiciona ao topo                              │
│          UPDATE → atualiza no lugar                             │
│          DELETE → remove com fade-out                           │
└─────────────────────────────────────────────────────────────────┘
```

### Arquivo 2: Hook de Realtime para Lead Tags
**Novo arquivo**: `src/hooks/useRealtimeLeadTags.ts`

Subscreve às mudanças na tabela `lead_tags` para mover cards entre colunas automaticamente.

### Arquivo 3: Atualização do FinanceContext
**Modificar**: `src/contexts/FinanceContext.tsx`

Mudanças:
- Separar `isLoading` inicial de `isFetching` em background
- Implementar merge de dados sem resetar estado
- Integrar hooks de realtime

### Arquivo 4: Atualização do AdminKanbanPage
**Modificar**: `src/pages/admin/AdminKanbanPage.tsx`

Mudanças:
- Remover loading state que esconde o Kanban inteiro
- Usar indicador sutil de sincronização no header
- Separar loading inicial (skeleton) de refresh silencioso

### Arquivo 5: Animações de Cards
**Modificar**: `src/components/kanban/LeadCard.tsx` e `src/index.css`

Adicionar:
- Classes CSS para animação de entrada (`animate-in fade-in slide-in-from-top`)
- Transições suaves de posição

### Arquivo 6: Migração do Banco (Realtime)
Habilitar realtime nas tabelas `contacts` e `lead_tags`:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_tags;
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Kanban pisca a cada sync | Leads aparecem suavemente |
| Botão "Sincronizar" obrigatório | Atualização automática em tempo real |
| Tela inteira recarrega | Apenas cards afetados atualizam |
| Sem feedback de atividade | Indicador sutil no header |

## Sequência de Implementação

1. Habilitar Realtime nas tabelas (migração)
2. Criar hooks de realtime (`useRealtimeContacts`, `useRealtimeLeadTags`)
3. Refatorar FinanceContext para merge inteligente
4. Atualizar AdminKanbanPage com loading states separados
5. Adicionar animações CSS nos cards
6. Testar sincronização bidirecional

---

## Observações
- A sincronização automática acontecerá a cada 30 segundos em background como fallback
- O botão "Sincronizar" permanece para forçar atualização imediata se necessário
- Leads novos terão destaque visual temporário (glow) ao aparecer
