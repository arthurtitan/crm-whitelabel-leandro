
Objetivo: eliminar de forma definitiva o loop de “Token expirado” no Dashboard de Atendimento, garantindo renovação automática de sessão, fallback seguro para logout e fim da tempestade de requisições/logs.

1) Diagnóstico confirmado (causa raiz)
- O backend lança `new UnauthorizedError(ErrorCodes.TOKEN_EXPIRED)` no middleware de autenticação.
- Porém, em `backend/src/utils/errors.ts`, `UnauthorizedError` fixa `code: "UNAUTHORIZED"` (e não `"TOKEN_EXPIRED"`).
- No frontend (`src/api/client.ts`), a renovação automática só dispara quando `err.code === "TOKEN_EXPIRED"`.
- Resultado:
  - Não tenta refresh em muitos 401 de sessão.
  - Também não força logout, porque a regra de “session error” lista códigos específicos e não inclui `UNAUTHORIZED`.
  - O polling do dashboard continua batendo em `/api/chatwoot/metrics`, gerando erro contínuo no backend.
- Agravante: `useChatwootMetrics` está com `retry: 3` para qualquer erro, amplificando o volume de chamadas e logs.

2) Correção definitiva (em camadas)

Camada A — Contrato de erro consistente no backend
Arquivo: `backend/src/utils/errors.ts`
- Ajustar `UnauthorizedError` e `ForbiddenError` para suportarem código semântico (machine-readable) quando a mensagem vier de `ErrorCodes`.
- Estratégia recomendada:
  - Resolver automaticamente o código a partir da mensagem de `ErrorCodes` (ex.: “Token expirado” -> `TOKEN_EXPIRED`) com fallback para `UNAUTHORIZED`/`FORBIDDEN`.
- Benefício: mantém compatibilidade com todo o código existente (que hoje passa mensagens), sem quebrar outros fluxos.

Camada B — Refresh no frontend sem depender de um único código
Arquivo: `src/api/client.ts`
- Tornar o fluxo de 401 robusto:
  - Em qualquer 401 autenticado (`!skipAuth`), tentar refresh uma única vez (com mutex já existente).
  - Se refresh funcionar, refazer request original.
  - Se refresh falhar, limpar tokens e disparar `auth:unauthorized`.
- Remover dependência estrita de `err.code === "TOKEN_EXPIRED"` para tentar refresh.
- Isso cobre:
  - `TOKEN_EXPIRED`
  - `UNAUTHORIZED` com mensagem local
  - variações futuras de contrato sem quebrar sessão.

Camada C — Hardening do polling para evitar tempestade em falha de sessão
Arquivo: `src/hooks/useChatwootMetrics.ts`
- Trocar `retry: 3` por `retry` condicional:
  - não fazer retry para 401/403 (erros de autenticação/permissão);
  - manter retry para erros de rede/transitórios.
- Efeito: mesmo em sessão inválida, elimina rajadas de tentativas em sequência.

3) Mudanças por arquivo (sequência de implementação)
1. `backend/src/utils/errors.ts`
   - Introduzir resolução de código por mensagem (`ErrorCodes`) em `UnauthorizedError`/`ForbiddenError`.
2. `src/api/client.ts`
   - Reestruturar bloco `catch` do `request()`:
     - 401 autenticado -> tentar refresh -> retry 1x -> logout global se falhar.
3. `src/hooks/useChatwootMetrics.ts`
   - Ajustar política `retry` para bloquear retry em erro de auth.
4. (Opcional recomendado) `backend/src/middlewares/error.middleware.ts`
   - Rebaixar log de 401/403 para `warn` (em vez de `error`) para reduzir ruído operacional sem perder observabilidade.

4) Critérios de aceite
- Após expiração do access token:
  - dashboard não entra em loop de erro;
  - ocorre refresh automático e a tela continua atualizando;
  - no máximo 1 tentativa de refresh concorrente (mutex funcionando).
- Se refresh token estiver inválido/ausente:
  - sessão é encerrada uma vez;
  - usuário volta para login;
  - não há spam contínuo em `/api/chatwoot/metrics`.
- Logs backend deixam de ter sequência repetitiva de “Token expirado” em intervalos curtos.

5) Plano de validação (E2E)
- Cenário 1: Token expirado com refresh válido
  - Logar normalmente, forçar expiração do access token, manter refresh token.
  - Validar que a próxima chamada de métricas dispara refresh e recupera sem banner persistente.
- Cenário 2: Token expirado com refresh inválido
  - Forçar access token inválido e remover/invalidar refresh token.
  - Validar logout automático e interrupção do polling.
- Cenário 3: Concorrência
  - Disparar múltiplas chamadas simultâneas (polling + ações de tela) com token expirado.
  - Confirmar que apenas um refresh real é executado.
- Cenário 4: Regressão
  - Login, navegação normal e ações protegidas continuam funcionando.
  - Erros 403 de permissão continuam sem logout indevido.

6) Riscos e mitigação
- Risco: refresh em 401 não relacionado à sessão.
  - Mitigação: aplicar apenas quando `skipAuth` for falso; endpoints de negócio já usam 403/400 para regras de domínio.
- Risco: comportamento diferente entre ambientes.
  - Mitigação: validar em preview e em produção com logs de rede/autenticação.

Resultado esperado final
- Correção permanente do problema “Token expirado” no dashboard.
- Sessão resiliente durante polling contínuo.
- Redução drástica de ruído em logs e de requisições redundantes.
