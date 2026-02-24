
Objetivo
- Fazer a integração Chatwoot funcionar de verdade em produção (com agentes reais), eliminando o falso “Conexão estabelecida” com “0 agentes” quando existem agentes na conta.

Diagnóstico confirmado
1) Contrato inconsistente entre modos Cloud x Backend
- No fluxo de produção (modo backend), a tela “Criar Nova Conta” chama `accountsCloudOrBackend.testChatwootConnection(...)`.
- Em backend mode isso vai para `src/services/accounts.backend.service.ts` → `POST /api/chatwoot/test-connection`.
- Esse endpoint (`backend/src/controllers/chatwoot.controller.ts` + `backend/src/services/chatwoot.service.ts`) hoje retorna apenas `{ success, message }` sem `agents`.
- A UI em `src/pages/super-admin/SuperAdminAccountsPage.tsx` monta `agents` a partir de `result.agents || []`, então acaba sempre em 0 mesmo com conexão válida.

2) Evidência visual bate com o código
- O print mostra exatamente: sucesso + 0 agentes.
- Isso é o comportamento esperado do bug atual (não da API externa).

3) Problema secundário de confiabilidade
- `src/pages/super-admin/SuperAdminAccountDetailPage.tsx` ainda tem teste de conexão simulado (mock local) e pode dar feedback falso.
- Isso não é a origem do print atual, mas mantém inconsistência operacional em produção.

Implementação proposta (rápida e segura)
1) Padronizar resposta do backend para teste de conexão
- Arquivos:
  - `backend/src/services/chatwoot.service.ts`
  - `backend/src/controllers/chatwoot.controller.ts`
- Ajuste:
  - Fazer `testConnectionWithCredentials` retornar payload completo:
    - `success`
    - `message`
    - `agents`
    - `inboxes` (quando disponível)
    - `labels` (quando disponível)
  - Estratégia:
    - `agents` = validação primária (se falhar, `success: false`)
    - `inboxes/labels` = best effort (não derruba sucesso principal, igual comportamento tolerante já usado em Cloud)
  - Benefício:
    - Mesmo contrato no backend e no Cloud, evitando divergência entre ambientes.

2) Corrigir camada frontend do backend service
- Arquivo:
  - `src/services/accounts.backend.service.ts`
- Ajuste:
  - Consumir e normalizar o novo payload completo.
  - Garantir `agents` vindo corretamente para a tela.
  - Atualizar `fetchChatwootAgents` para usar endpoint apropriado (`/api/chatwoot/agents/fetch`) como fallback de compatibilidade, caso backend antigo esteja rodando temporariamente.
- Benefício:
  - Evita 0 agentes por falta de campo na resposta e reduz risco em deploy parcial.

3) Remover falso positivo no detalhe da conta (hardening de produção)
- Arquivo:
  - `src/pages/super-admin/SuperAdminAccountDetailPage.tsx`
- Ajuste:
  - Trocar teste simulado por chamada real `accountsCloudOrBackend.testChatwootConnection(...)`.
  - Exibir resultado real (sucesso/erro e contagem de agentes).
- Benefício:
  - Operação consistente para suporte e administração (sem “sucesso fake”).

4) Mensagens e UX de validação
- Arquivo:
  - `src/pages/super-admin/SuperAdminAccountsPage.tsx`
- Ajuste:
  - Manter UI existente, mas garantir que:
    - Se `success=true` e `agents.length>0`, exiba quantidade correta e libere passo de importação.
    - Se `success=true` e `agents.length===0`, mostrar aviso de “credenciais válidas, sem agentes na conta” (estado real, não erro técnico).
    - Se `success=false`, exibir mensagem de erro técnica retornada pelo backend.
- Benefício:
  - Feedback claro para usuário final e menos ambiguidade operacional.

Plano de validação (fim a fim)
1) Teste funcional principal (produção)
- Abrir “Criar Nova Conta” com:
  - URL: `https://atendimento.gleps.com.br`
  - Account ID: `1`
  - token novo informado
- Resultado esperado:
  - “Conexão estabelecida!”
  - contagem > 0 agentes
  - botão muda para “Próximo: Importar Agentes”
  - lista de agentes aparece na etapa seguinte

2) Teste de erro controlado
- Trocar token por inválido.
- Resultado esperado:
  - `success=false`
  - mensagem “API Key inválida ou sem permissões” (ou equivalente)
  - nenhum falso “conectado”

3) Regressão rápida
- Login e listagem de contas continuam funcionando.
- Criação de conta sem Chatwoot continua intacta.
- Endpoint `/api/health` e frontend `/health` continuam OK.

Sequência de execução
1. Backend: ajustar serviço/controlador do Chatwoot.
2. Frontend service: ajustar normalização em `accounts.backend.service.ts`.
3. UI hardening: remover mock em `SuperAdminAccountDetailPage.tsx`.
4. QA E2E no fluxo de criação/importação de agentes.
5. Publicar.

Riscos e mitigação
- Risco: deploy parcial (frontend novo com backend antigo).
  - Mitigação: fallback em `accounts.backend.service.ts` para buscar agentes via `/api/chatwoot/agents/fetch`.
- Risco: inboxes/labels variam entre instâncias Chatwoot.
  - Mitigação: tratar como opcional, sem impedir sucesso quando agentes são válidos.

Critérios de aceite
- O fluxo de criação de conta em produção deixa de mostrar falso “0 agentes” quando há agentes reais.
- O wizard avança para importação com dados reais.
- Erros de token/credenciais são mostrados corretamente.
- Tela de detalhe de conta também usa teste real (sem simulação).
