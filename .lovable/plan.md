

## Diagnóstico

O problema é claro: o backend lê credenciais Google da tabela `accounts` (campos `google_client_id`, `google_client_secret`, `google_redirect_uri`), mas esses campos estão **NULL** no banco. As credenciais existem nas env vars do EasyPanel mas não são usadas.

O `getGoogleStatus` retorna `configured: false` → UI mostra "Google Calendar não configurado no servidor".

## Estratégia mais eficiente

Fazer o `CalendarService.getGoogleCredentials()` usar **fallback para env vars** quando os campos do DB estiverem vazios. Isso faz tudo funcionar imediatamente com as env vars já configuradas no EasyPanel, sem precisar de UI de Super Admin para popular o banco.

### Alteração única: `backend/src/services/calendar.service.ts`

No método `getGoogleCredentials`, após tentar ler do banco, fazer fallback para `process.env`:

```typescript
private async getGoogleCredentials(accountId: string): Promise<GoogleCredentials | null> {
  // 1) Try DB first (per-account)
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      googleClientId: true,
      googleClientSecret: true,
      googleRedirectUri: true,
    },
  });

  if (account?.googleClientId && account?.googleClientSecret && account?.googleRedirectUri) {
    return {
      clientId: account.googleClientId,
      clientSecret: account.googleClientSecret,
      redirectUri: account.googleRedirectUri,
    };
  }

  // 2) Fallback to env vars (global)
  const envClientId = process.env.GOOGLE_CLIENT_ID;
  const envClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const envRedirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (envClientId && envClientSecret && envRedirectUri) {
    return {
      clientId: envClientId,
      clientSecret: envClientSecret,
      redirectUri: envRedirectUri,
    };
  }

  return null;
}
```

### Resultado esperado

- Com as env vars do EasyPanel (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`), o status retorna `configured: true`
- O botão "Sincronizar" aparece na Agenda em vez da mensagem de erro
- O fluxo OAuth completo funciona: clicar → autorizar no Google → callback → sincronizar eventos
- No futuro, se as credenciais forem salvas no DB por conta, elas têm prioridade sobre env vars

Nenhum outro arquivo precisa mudar. Uma alteração, ~10 linhas.

