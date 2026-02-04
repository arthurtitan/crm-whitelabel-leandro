
# Plano: Adicionar Campos de Chatwoot ao Modal de Edição de Contas

## Problema Identificado
O modal de edição de contas na página **SuperAdminAccountsPage.tsx** está incompleto, faltando o campo **API Key Chatwoot** e a funcionalidade de teste de conexão. Isso impede que o Super Admin atualize as credenciais de integração do Chatwoot diretamente da lista de contas.

## Solução Proposta
Expandir o modal de edição para incluir todos os campos necessários para gerenciar a integração Chatwoot, seguindo o mesmo padrão já existente no modal de "Controle" da página de detalhes.

## Alterações Necessárias

### 1. Adicionar Estados para Conexão Chatwoot
Adicionar estados no componente para gerenciar o teste de conexão durante a edição:
- `editConnectionStatus` - status da conexão (idle, loading, success, error)
- `editConnectionError` - mensagem de erro, se houver

### 2. Expandir o Modal de Edição
Modificar o diálogo de edição (linhas 861-922) para incluir:

```text
+------------------------------------------+
|  Editar Conta                            |
|  Atualize as informações da conta        |
+------------------------------------------+
|  Nome                                    |
|  [_______________________________]       |
|                                          |
|  Status                                  |
|  [Ativa ▼]                               |
|                                          |
|  ─────────────────────────────────────   |
|  Integração Chatwoot                     |
|                                          |
|  URL da Instância                        |
|  [https://gleps-chatwoot.dqnaqh...]      |
|  URL do Chatwoot Cloud ou self-hosted    |
|                                          |
|  Account ID                              |
|  [3______________________________]       |
|                                          |
|  API Key               ** NOVO **        |
|  [●●●●●●●●________________]              |
|                                          |
|  [🔄 Testar Conexão]     ** NOVO **      |
|  ✓ Conexão verificada!                   |
|                                          |
+------------------------------------------+
|              [Cancelar] [Salvar]         |
+------------------------------------------+
```

### 3. Implementar Função de Teste de Conexão
Criar função `handleEditTestConnection` que:
- Usa o `accountsCloudService.testChatwootConnection()` existente
- Exibe feedback visual do status da conexão
- Mostra toast com resultado

### 4. Atualizar Serviço de Update
Verificar se o `handleUpdate` já inclui `chatwoot_api_key` na atualização (já está implementado na linha 371).

## Detalhes Técnicos

### Arquivo: `src/pages/super-admin/SuperAdminAccountsPage.tsx`

#### Novos Estados (após linha 127):
```typescript
const [editConnectionStatus, setEditConnectionStatus] = useState<ConnectionStatus>('idle');
const [editConnectionError, setEditConnectionError] = useState<string | null>(null);
```

#### Nova Função (após `handleToggleStatus`):
```typescript
const handleEditTestConnection = async () => {
  if (!editingAccount) return;
  
  setEditConnectionStatus('loading');
  setEditConnectionError(null);
  
  try {
    const result = await accountsCloudService.testChatwootConnection(
      editingAccount.chatwoot_base_url || '',
      editingAccount.chatwoot_account_id || '',
      editingAccount.chatwoot_api_key || ''
    );
    
    if (result.success) {
      setEditConnectionStatus('success');
      toast.success(result.message);
    } else {
      setEditConnectionStatus('error');
      setEditConnectionError(result.message);
      toast.error(result.message);
    }
  } catch (e: any) {
    setEditConnectionStatus('error');
    setEditConnectionError(e?.message || 'Erro inesperado');
    toast.error(e?.message || 'Erro ao testar conexão');
  }
};
```

#### Campos Adicionais no Modal (linhas 893-910):
- Campo **API Key Chatwoot** com `type="password"`
- Botão **Testar Conexão** com estados visuais
- Feedback de sucesso/erro da conexão

#### Reset do Estado ao Fechar:
Limpar `editConnectionStatus` quando o modal é fechado.

## Benefícios
- Permite editar TODOS os campos do Chatwoot de qualquer lugar
- Mantém consistência com o modal de controle na página de detalhes
- Permite verificar se as credenciais estão corretas antes de salvar
- Melhora a experiência do Super Admin ao gerenciar contas
