
# Plano: Alterar para Escopo Somente Leitura

## Objetivo

Remover a necessidade de verificação do Google alterando os escopos OAuth para usar apenas `calendar.readonly`, que não é classificado como sensível.

## Mudanças Necessárias

### 1. Edge Function: google-calendar-auth-url

**Arquivo**: `supabase/functions/google-calendar-auth-url/index.ts`

**Linhas 60-64** - Alterar escopos de:
```javascript
const scopes = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");
```

**Para:**
```javascript
const scopes = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");
```

### 2. Backend Service (opcional, para consistência)

**Arquivo**: `backend/src/services/calendar.service.ts`

Atualizar os escopos no método `getGoogleAuthUrl` para usar `calendar.readonly`.

### 3. Google Cloud Console

Após fazer as alterações no código, você precisará:

1. Ir para **APIs e Serviços** > **Tela de consentimento OAuth**
2. Clicar em **Editar app**
3. Na seção **Escopos**, remover os escopos sensíveis atuais
4. Adicionar apenas: `calendar.readonly` e `userinfo.email`
5. Salvar

---

## O que funciona com calendar.readonly

| Funcionalidade | Disponível |
|----------------|------------|
| Ver eventos do calendário | Sim |
| Ver título, horário, descrição | Sim |
| Ver link do Google Meet | Sim |
| Ver participantes | Sim |
| Ver localização | Sim |
| Criar novos eventos | Não |
| Editar eventos | Não |
| Excluir eventos | Não |

## Resultado Esperado

- Qualquer usuário poderá conectar o Google Calendar
- Não é necessário adicionar usuários de teste manualmente
- Não é necessário passar pela verificação do Google
- A sincronização de eventos continua funcionando normalmente

---

## Resumo Técnico

| Item | Detalhe |
|------|---------|
| Arquivos modificados | `supabase/functions/google-calendar-auth-url/index.ts`, `backend/src/services/calendar.service.ts` |
| Escopo removido | `calendar`, `calendar.events` (sensíveis) |
| Escopo adicionado | `calendar.readonly` (não-sensível) |
| Impacto | Remove necessidade de verificação do Google |
