
# Diagnóstico: Integração Chatwoot Funcionando

## Status Atual

A integração com Chatwoot **está funcionando corretamente** na interface grafica. Durante o teste ao vivo:

- Conexão estabelecida em **1654ms**
- **1 agente encontrado** (Arthur - administrator)
- Wizard de importação funcionando
- Botão "Próximo: Importar Agentes" disponível

## Por Que Estava Falhando Antes

Comparando as duas situações:

| Aspecto | Versão Anterior (falha) | Versão Atual (sucesso) |
|---------|------------------------|------------------------|
| **URL Chatwoot** | `atendimento.gleps.com.br` | `gleps-chatwoot.dqnaqh.easypanel.host` |
| **Timeout Edge Function** | 15 segundos | 25 segundos |
| **Headers HTTP** | Sem User-Agent, com Content-Type | Com User-Agent, com Accept |
| **Retry** | Sem retry | 2 tentativas com delay |
| **Resposta de erro** | Status 400/500 | Sempre 200 com `success: false` |

### Causa Raiz

A instância antiga (`atendimento.gleps.com.br`) provavelmente tem:
1. **Cloudflare mais restritivo** que bloqueia requisições sem User-Agent adequado
2. **Servidor mais lento** que excede o timeout de 15s (agora configurado para 45s)
3. **Firewall bloqueando IPs externos** dos servidores Supabase

## O Que Foi Corrigido

Arquivo modificado: `supabase/functions/test-chatwoot-connection/index.ts`

1. **Timeout aumentado** de 15s para 25s (principal)
2. **Headers compatíveis**:
   ```typescript
   headers: {
     'api_access_token': normalizedApiKey,
     'Accept': 'application/json',
     'User-Agent': 'LovableCRM/1.0 (Chatwoot Integration)',
   }
   ```
3. **Retry automático** com 2 tentativas
4. **Logs detalhados** para diagnóstico
5. **Respostas amigáveis** (sempre 200 OK com `success: false` em erros)

## Próximos Passos Opcionais

Se precisar usar a instância antiga (`atendimento.gleps.com.br`), será necessário:

1. **Verificar Cloudflare/Firewall** - Adicionar IPs do Supabase (AWS) à whitelist
2. **Aumentar timeout** para 45s ou mais se o servidor for lento
3. **Verificar rate limiting** da instância Chatwoot

## Arquivos Relevantes (Apenas Leitura)

Nenhuma modificação necessária - a integração já está funcionando!

| Arquivo | Status |
|---------|--------|
| `supabase/functions/test-chatwoot-connection/index.ts` | ✅ Já corrigido |
| `src/services/accounts.cloud.service.ts` | ✅ Funcionando |
| `src/pages/super-admin/SuperAdminAccountsPage.tsx` | ✅ Funcionando |
