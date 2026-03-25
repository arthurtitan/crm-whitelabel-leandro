

## Aplicar configurações do domínio `goodleads.mychooice.com`

### Contexto
Os secrets `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` já estão configurados no projeto. O domínio `mychooice.com` já foi autorizado no Google Cloud Console. Faltam apenas as alterações nos arquivos de edge functions para apontar ao novo domínio.

### Alterações

**1. `supabase/functions/google-calendar-callback/index.ts`** (linha 8)
- Trocar `DEFAULT_FRONTEND_URL` de `"https://testedocrm.lovable.app"` para `"https://goodleads.mychooice.com"`

**2. `supabase/functions/google-calendar-auth-url/index.ts`** (linha 54)
- Trocar fallback origin de `"https://testedocrm.lovable.app"` para `"https://goodleads.mychooice.com"`

### Passo manual pendente
Após as alterações no código, você precisará:
- Em **Settings → Domains**, conectar o domínio `goodleads.mychooice.com`
- No registrador DNS, adicionar:
  - **A Record**: `goodleads` → `185.158.133.1`
  - **TXT Record**: `_lovable` → valor fornecido pelo Lovable
- No **Google Cloud Console**, adicionar como Authorized redirect URI:
  `https://hdiwzuesrfgefztqrqbm.supabase.co/functions/v1/google-calendar-callback`

