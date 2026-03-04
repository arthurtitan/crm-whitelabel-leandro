

## Erro de Validação do Prisma

O problema é uma incompatibilidade entre o schema e a migration:

- O model `Account` declara `googleCalendarToken GoogleCalendarToken?` (relação **1:1**), que exige um `@unique` em `accountId` no model `GoogleCalendarToken`
- A migration `0007` removeu o unique index de `account_id` e colocou em `user_id`
- Prisma não consegue validar uma relação 1:1 sem unique na foreign key → erro de validação

### Correção (1 linha)

**`backend/prisma/schema.prisma` linha 46**: Mudar de relação singular para lista:

```prisma
// De:
googleCalendarToken GoogleCalendarToken?

// Para:
googleCalendarTokens GoogleCalendarToken[]
```

Isso permite múltiplos tokens por conta (um por usuário), alinhado com o isolamento por usuário implementado na migration 0007.

Também precisa atualizar qualquer referência a `googleCalendarToken` (singular) no código do backend para `googleCalendarTokens` (plural), se existir em queries Prisma.

