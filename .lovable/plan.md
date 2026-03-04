

## Diagnóstico: Google Calendar não configurado no ambiente de produção

### Causa raiz

O erro é claro no log:

```
Error: Google Calendar não configurado
at CalendarService.getGoogleAuthUrl
```

No arquivo `backend/src/services/calendar.service.ts` (linha 193), a função verifica:

```typescript
if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
  throw new Error('Google Calendar não configurado');
}
```

As variáveis `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI` estão **vazias** no `.env` de produção do Docker. O arquivo `backend/.env` confirma:

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/google/callback
```

### O que precisa ser feito

**Isso não é um bug de código** — é uma configuração de ambiente faltante.

Você precisa definir as seguintes variáveis de ambiente no seu Docker/EasyPanel de produção:

| Variável | Valor |
|----------|-------|
| `GOOGLE_CLIENT_ID` | Seu Client ID do Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Seu Client Secret do Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | `https://360.gleps.com.br/api/calendar/google/callback` |

### Onde obter as credenciais

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/)
2. Vá em **APIs & Services → Credentials**
3. Crie ou edite um **OAuth 2.0 Client ID** (tipo: Web Application)
4. Em **Authorized redirect URIs**, adicione: `https://360.gleps.com.br/api/calendar/google/callback`
5. Copie o **Client ID** e **Client Secret** gerados

### Como aplicar

No painel do EasyPanel (ou no `docker-compose.yml` de produção), adicione as 3 variáveis ao serviço `backend` e reinicie o container.

### Melhoria de UX (opcional)

Posso melhorar o frontend para exibir uma mensagem amigável ("Google Calendar ainda não configurado pelo administrador") em vez de "Erro interno do servidor" quando as credenciais não estão definidas. Isso evitaria confusão futura.

