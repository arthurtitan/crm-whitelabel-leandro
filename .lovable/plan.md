
Objetivo: corrigir de forma definitiva o problema de “dados não carregando corretamente ao logar”, com foco no dashboard que aparece com alerta “Chatwoot não configurado” + skeleton infinito, mesmo com backend saudável.

Diagnóstico consolidado (com base no código e nos logs):
1) Backend está subindo corretamente após recovery de migration:
- Logs confirmam `✅ Migrations aplicadas com sucesso após recovery`, seed e servidor ativo.
- Endpoints principais respondem 200 (`/api/auth/login`, `/api/contacts`, `/api/products`, `/api/sales`, `/api/chatwoot/metrics` em alguns fluxos).

2) O problema principal atual é de estado no frontend após login em modo backend:
- Em `src/contexts/AuthContext.backend.tsx`, no método `login`, o mapeamento da conta usa apenas snake_case:
  - `response.account.chatwoot_base_url`
  - `response.account.chatwoot_account_id`
  - `response.account.chatwoot_api_key`
- Porém o backend retorna camelCase (`chatwootBaseUrl`, `chatwootAccountId`, `chatwootApiKey`) no payload de login.
- Resultado: `account.chatwoot_*` fica `undefined` logo após login direto, e o app conclui (errado) que Chatwoot não está configurado.

3) Há um segundo bug de UX que agrava:
- Em `src/hooks/useChatwootMetrics.ts`, `isLoading = query.isPending`.
- Quando a query está `enabled: false` (porque `isConfigured` caiu para false), o dashboard pode continuar em estado visual de loading (skeleton) mesmo sem requisição.
- Isso explica a tela da imagem: alerta de não configurado + skeleton persistente.

4) Indício forte no log:
- No primeiro fluxo (com impersonação) houve `POST /api/chatwoot/metrics 200`.
- No login “real” posterior, não aparece chamada de métricas no trecho enviado, compatível com `isConfigured` falso no frontend.

Correção definitiva proposta (arquivos e mudanças):
1) Normalizar o parsing do payload de auth no provider backend
Arquivo: `src/contexts/AuthContext.backend.tsx`

Implementar helper(s) internos para normalizar campos snake/camel, e reutilizar em:
- `hydrateFromToken`
- `login`
- `impersonate`

Exemplo de estratégia:
- `normalizeAccount(rawAccount)`:
  - `chatwoot_base_url = raw.chatwoot_base_url ?? raw.chatwootBaseUrl ?? undefined`
  - `chatwoot_account_id = raw.chatwoot_account_id ?? raw.chatwootAccountId ?? undefined`
  - `chatwoot_api_key = raw.chatwoot_api_key ?? raw.chatwootApiKey ?? undefined`
- `normalizeUser(rawUser)` com fallback para `chatwoot_agent_id/chatwootAgentId`, `account_id/accountId`.

E aplicar no `login` (ponto crítico), que hoje está inconsistente.

2) Corrigir o estado de loading do hook de métricas
Arquivo: `src/hooks/useChatwootMetrics.ts`

Ajustar:
- `isLoading` para não ficar true quando a query está desabilitada:
  - `const isLoading = isConfigured ? query.isPending : false;`

Também ajustar `isConfigured` para modo backend sem depender estritamente de `chatwoot_api_key` no cliente:
- Em backend, o servidor já lê credenciais no banco; o frontend não deve bloquear métricas por ausência de key local.
- Regra:
  - Backend mode: exigir `chatwoot_base_url` + `chatwoot_account_id`.
  - Cloud mode: manter regra atual com `chatwoot_api_key`.

3) Alinhar checks de “Chatwoot configurado” nas páginas administrativas
Arquivos:
- `src/pages/admin/AdminKanbanPage.tsx`
- `src/pages/admin/AdminLeadsPage.tsx`

Atualizar `hasChatwootConfig` para ser backend-aware (mesma regra do hook), evitando falso negativo em telas que hoje exigem api_key no cliente.

4) (Opcional de robustez, baixo risco) consolidar regra de configuração em util compartilhado
Novo util (ou função local em hook/contexto) para não repetir lógica divergente entre dashboard/kanban/leads.
Evita regressão futura.

Sequência de implementação:
1. Refatorar `AuthContext.backend.tsx` com normalização única de payload (snake/camel), aplicando no `login` primeiro.
2. Ajustar `useChatwootMetrics.ts`:
   - `isConfigured` por modo (backend/cloud)
   - `isLoading` condicionado a `isConfigured`.
3. Ajustar checks de `hasChatwootConfig` em Kanban e Leads para regra coerente.
4. Revisão rápida de tipagem para garantir compatibilidade sem `any` desnecessário.
5. Validar manualmente fluxo de login direto (sem impersonação).

Critérios de aceite (validação prática):
1) Login direto com usuário real:
- Dashboard não deve ficar em skeleton infinito.
- Se conta tiver integração ativa: deve disparar `POST /api/chatwoot/metrics` e renderizar KPIs.
- Se conta não tiver integração: alerta pode aparecer, mas cards devem sair de loading (mostrar estado estável, sem skeleton eterno).

2) Fluxos administrativos:
- Kanban/Leads não devem exibir falso “Chatwoot não configurado” quando a conta está configurada no backend.
- Ações que só precisam base URL + accountId devem seguir funcionando.

3) Logs esperados:
- Sem loop de erro relacionado a configuração falsa após login.
- Métricas chamadas de forma consistente no login real.

Observações importantes:
- Os erros antigos de `contacts.first_resolved_at` / `resolution_logs` nos logs parecem históricos do período antes do recovery; o foco atual é estado de autenticação/configuração no frontend pós-login.
- Os `400` antes da impersonação são coerentes com rota de conta exigindo `accountId` enquanto ainda era super_admin sem contexto de conta; não são a causa principal da tela final após login real.
