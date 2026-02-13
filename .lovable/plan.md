

## Atualizar Token do Chatwoot

A conta principal já possui a URL e o Account ID corretos. Apenas o token (API Key) precisa ser atualizado.

**Estado atual:**
- URL: `https://atendimento.gleps.com.br` (correto)
- Account ID: `1` (correto)  
- API Key: `e2EdA2EY8EkpqkEdSW2gcSTa` (desatualizado)

**Acao:**
Atualizar o campo `chatwoot_api_key` da conta `5f2e617d-6d43-4a78-8f26-da5843855caf` para o novo token `c34KYFzSh3p4QatLaUGKzYiz`.

---

### Detalhes Tecnicos

1. Executar SQL de update na tabela `accounts`:
   ```sql
   UPDATE accounts 
   SET chatwoot_api_key = 'c34KYFzSh3p4QatLaUGKzYiz', updated_at = now()
   WHERE id = '5f2e617d-6d43-4a78-8f26-da5843855caf';
   ```

2. Validar a conexao chamando a Edge Function `test-chatwoot-connection` para confirmar que o novo token funciona corretamente.

