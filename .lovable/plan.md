
# Plano: Integração Funcional do Chatwoot

## Diagnóstico

O erro **"Failed to fetch"** ocorre porque o frontend está tentando chamar a API do Chatwoot diretamente do navegador. Isso é bloqueado pelo **CORS** (Cross-Origin Resource Sharing) - uma medida de segurança que impede que sites acessem APIs de outros domínios sem permissão.

## Solução

A boa notícia é que já existe uma função de backend (`test-chatwoot-connection`) pronta para ser usada. O problema é que ela não está sendo chamada corretamente. Vou:

1. Conectar o botão "Testar Conexão" à função de backend existente
2. Adicionar funcionalidades extras como buscar agentes e inboxes do Chatwoot
3. Permitir importar agentes do Chatwoot como usuários do sistema

---

## Mudanças Planejadas

### 1. Corrigir o Serviço de Contas (Frontend)

**Arquivo:** `src/services/accounts.cloud.service.ts`

O que muda:
- Ao invés de chamar `https://atendimento.gleps.com.br/api/...` diretamente
- Vai chamar a função de backend via `supabase.functions.invoke('test-chatwoot-connection', ...)`

Resultado: O botão "Testar Conexão" funcionará sem erros de CORS

### 2. Adicionar Novos Métodos ao Serviço

Novos métodos no `accounts.cloud.service.ts`:

```text
testChatwootConnection(baseUrl, accountId, apiKey)
  → Retorna: { success, message, agents?, inboxes?, labels? }

fetchChatwootAgents(baseUrl, accountId, apiKey)  
  → Retorna: lista de agentes do Chatwoot
```

### 3. Configurar Edge Function

**Arquivo:** `supabase/config.toml`

Adicionar configuração para a função funcionar sem autenticação JWT (necessário para o teste de conexão durante criação de conta):

```text
[functions.test-chatwoot-connection]
verify_jwt = false
```

### 4. Melhorar a Interface de Criação de Conta

**Arquivo:** `src/pages/super-admin/SuperAdminAccountsPage.tsx`

Após o teste de conexão bem-sucedido:
- Mostrar quantos agentes foram encontrados
- Mostrar quantos canais (inboxes) estão configurados
- Mostrar quantas etiquetas (labels) existem

---

## Detalhes Técnicos

### Fluxo Corrigido

```text
Usuário clica "Testar Conexão"
         ↓
Frontend chama Edge Function
         ↓
Edge Function acessa Chatwoot
         ↓
Retorna dados ao frontend
         ↓
Exibe resultado na tela
```

### Tipos de Resposta Expandidos

A interface `testChatwootConnection` vai retornar:

| Campo | Tipo | Descrição |
|-------|------|-----------|
| success | boolean | Se a conexão foi bem-sucedida |
| message | string | Mensagem para o usuário |
| agents | array | Lista de agentes encontrados |
| inboxes | array | Lista de canais configurados |
| labels | array | Lista de etiquetas existentes |

### Tratamento de Erros

| Erro | Mensagem para o Usuário |
|------|-------------------------|
| 401 | "API Key inválida ou sem permissões" |
| 404 | "Account ID não encontrado no Chatwoot" |
| Timeout | "Tempo esgotado. Verifique a URL da instância" |
| Rede | "Erro de conexão. Verifique a URL" |

---

## Validações e Testes

Após implementação, verificar:

1. **Teste de Conexão**: Deve funcionar com credenciais válidas do Chatwoot
2. **Erro CORS**: Não deve mais aparecer "Failed to fetch"
3. **Feedback Visual**: Exibir loading enquanto testa, sucesso ou erro após
4. **Dados Retornados**: Mostrar quantidade de agentes/inboxes/labels encontrados

---

## Arquivos que Serão Alterados

| Arquivo | Ação |
|---------|------|
| `src/services/accounts.cloud.service.ts` | Modificar para usar Edge Function |
| `supabase/config.toml` | Adicionar config da Edge Function |
| `src/pages/super-admin/SuperAdminAccountsPage.tsx` | Melhorar feedback visual |
