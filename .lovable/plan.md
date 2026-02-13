

# Consolidar Conta Principal e Corrigir Exibicao de Dados

## Diagnostico

Apos investigacao completa do banco de dados, identifiquei os seguintes problemas:

### 1. Duplicacao massiva de contas
Existem **16 contas** no sistema, sendo 14 contas de teste/lixo. Apenas 2 sao relevantes:

- **Gleps Teste** (5f2e617d) - Conta principal com admin@gleps.com.br, conectada a `atendimento.gleps.com.br`
  - 9 resolucoes por IA (explicitas, via n8n)
  - 5 resolucoes humanas (inferidas)
  - 3 tags, 1 funil
  
- **ContaTesteAgente** (66203ae2) - Conta secundaria do Arthur (glepsai@gmail.com)
  - 21 contatos, 13 tags, 4 eventos de calendario, 1 funil
  - Apenas 2 resolucoes humanas duplicadas (nenhuma IA)
  - Conectada a outra URL do Chatwoot

### 2. Resolucoes de IA nao aparecem para o Arthur
O Arthur esta logado na conta `66203ae2` que **nao tem nenhuma resolucao de IA** nos resolution_logs. Todas as 9 resolucoes de IA estao registradas na conta `5f2e617d`. Por isso o dashboard mostra tudo zerado para IA.

### 3. Dados uteis divididos entre duas contas
Os contatos e tags do Arthur estao na conta errada, enquanto os resolution_logs reais estao na conta principal.

---

## Plano de Acao

### Etapa 1: Migrar dados uteis para a conta principal
Mover os dados do Arthur (conta `66203ae2`) para a conta principal (`5f2e617d`):
- Reatribuir o perfil do Arthur para a conta principal
- Migrar os 21 contatos
- Migrar as 13 tags (que nao conflitem)
- Migrar os 4 eventos de calendario
- Migrar o funil

### Etapa 2: Limpar resolution_logs duplicados
Remover os 2 resolution_logs duplicados da conta `66203ae2` (sao copias das mesmas conversas 26 e 31 que ja existem na conta principal).

### Etapa 3: Deletar as 15 contas de teste
Remover todas as contas exceto a `5f2e617d` (Gleps Teste), incluindo:
- Primeiro deletar dados dependentes (resolution_logs, contacts, tags, funnels, etc.)
- Depois deletar as contas

### Etapa 4: Resultado esperado
Apos a limpeza, o Dashboard de Atendimento exibira corretamente:
- **9 resolucoes por IA** (56%)
- **5 resolucoes humanas** (31%) 
- **Taxa de transbordo** calculada corretamente
- Todos os contatos, tags e eventos consolidados na conta unica

---

## Detalhes Tecnicos

### Operacoes no banco de dados (via insert tool)
1. `UPDATE profiles SET account_id = '5f2e617d-...' WHERE id = '82d84bd9-...'` (Arthur)
2. `UPDATE contacts SET account_id = '5f2e617d-...' WHERE account_id = '66203ae2-...'`
3. `UPDATE tags SET account_id = '5f2e617d-...' WHERE account_id = '66203ae2-...'`
4. `UPDATE calendar_events SET account_id = '5f2e617d-...' WHERE account_id = '66203ae2-...'`
5. `UPDATE funnels SET account_id = '5f2e617d-...' WHERE account_id = '66203ae2-...'`
6. `DELETE FROM resolution_logs WHERE account_id != '5f2e617d-...'`
7. Deletar dados orfaos de todas as 15 contas de teste
8. `DELETE FROM accounts WHERE id != '5f2e617d-...'`

### Nenhuma alteracao de codigo necessaria
A edge function `fetch-chatwoot-metrics` e o frontend ja estao corretos. O problema era exclusivamente de dados: o Arthur via dados de uma conta que nao tinha os resolution_logs de IA. Ao consolidar tudo na conta principal, os dados ja aparecerao corretamente.

