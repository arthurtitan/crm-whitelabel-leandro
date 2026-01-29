
# Plano: Corrigir Sincronização do Google Calendar

## Problema Identificado

A análise dos dados do banco revelou a causa raiz:

| Campo | Valor |
|-------|-------|
| Conta conectada | `arthurh856@gmail.com` |
| Usuário logado | `glepsai@gmail.com` |
| Account ID | `66203ae2-5063-4a77-af9d-4838e3f4e6fd` |
| Eventos exibidos | FirmSkin Gold, Agendamento BodySlim (da conta `arthurh856@gmail.com`) |
| Evento esperado | "teste" às 1:30am (da conta `arthurh856@gmail.com`) |

O sistema está funcionando corretamente em termos de arquitetura - ele vincula o token do Google ao `account_id`, não ao `user_id`. Isso significa que:
- O usuário `arthurh856@gmail.com` conectou seu Google Calendar à conta `ContaTesteAgente`
- O usuário `glepsai@gmail.com` está na mesma conta e vê os eventos dessa conexão

**Porém, há dois problemas reais:**

1. **O evento "teste" não está sendo exibido** - Isso indica que a sincronização não está buscando eventos corretamente, ou os eventos do banco são antigos (de uma sincronização anterior)

2. **Os eventos exibidos são de outra pessoa** - O calendário conectado é de `arthurh856@gmail.com`, mas os eventos mostrados parecem ser de uma conexão anterior que não foi limpa

## Diagnóstico Detalhado

Analisando os dados do banco:
- Eventos no banco: criados em `2026-01-29 02:48` (sincronização antiga)
- Eventos: "FirmSkin Gold", "Agendamento BodySlim", "Consulta - Arthur Henrique"
- Nenhum evento "teste" às 1:30am foi encontrado no banco

**Causa raiz**: Quando o usuário reconecta com uma conta Google diferente:
1. O callback sobrescreve o token (`upsert` com `onConflict: account_id`)
2. **Mas os eventos antigos no banco não são limpos**
3. A sincronização não é executada automaticamente

## Solução Proposta

### Parte 1: Limpar eventos antigos ao reconectar

Modificar `google-calendar-callback/index.ts` para deletar todos os eventos do Google ao reconectar:

```typescript
// Antes de salvar os novos tokens, limpar eventos antigos
await supabase
  .from("calendar_events")
  .delete()
  .eq("account_id", accountId)
  .eq("source", "google");
```

### Parte 2: Sincronização automática após callback

O callback redireciona para `/admin/agenda?google_connected=true`, mas a sincronização precisa ocorrer. Já existe lógica em `AdminAgendaPage.tsx`, mas precisamos garantir que ela execute corretamente.

### Parte 3: Forçar nova sincronização

Adicionar um parâmetro de forçar refresh na URL do callback:

```typescript
// No callback, após limpar eventos e salvar tokens:
return Response.redirect(`${FRONTEND_URL}/admin/agenda?google_connected=true&force_sync=true`);
```

## Alterações Necessárias

### Arquivo 1: `supabase/functions/google-calendar-callback/index.ts`

**Adicionar limpeza de eventos antigos antes do upsert (linha ~89)**:

```typescript
// Limpar eventos antigos do Google antes de reconectar
await supabase
  .from("calendar_events")
  .delete()
  .eq("account_id", accountId)
  .eq("source", "google");

// Upsert tokens (existente)
const { error: dbError } = await supabase
  .from("google_calendar_tokens")
  .upsert({...});
```

### Arquivo 2: `src/pages/admin/AdminAgendaPage.tsx`

**Melhorar a lógica de sincronização automática** para garantir que ela execute após conectar:

- Verificar parâmetros `google_connected=true` ou `connected`
- Forçar sincronização e reload dos eventos
- Limpar parâmetros da URL após processar

---

## Resumo Técnico

| Item | Detalhe |
|------|---------|
| Causa raiz | Eventos antigos não são limpos ao reconectar |
| Arquivos afetados | `google-calendar-callback/index.ts`, `AdminAgendaPage.tsx` |
| Mudança principal | Deletar eventos `source='google'` antes de salvar novo token |
| Resultado esperado | Apenas eventos do calendário recém-conectado serão exibidos |

## Passos de Teste

1. Desconectar o Google Calendar atual
2. Reconectar com a conta `arthurh856@gmail.com`
3. Verificar se o evento "teste" às 1:30am aparece
4. Verificar se os eventos antigos foram removidos
