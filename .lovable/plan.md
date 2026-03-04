
Objetivo: corrigir de forma definitiva a ingestão das variáveis de configuração do Google Calendar no deploy (sem alterar arquitetura e sem “invenção”), garantindo que após rebuild funcione de primeira.

1) Diagnóstico fechado (com base nos logs)
- O backend sobe com `API_URL: http://localhost:3000`, que é o default do `docker-compose.yml` da raiz (não do `deploy/easypanel/docker-compose.yml`, que usa default `http://backend:3000`).
- Isso indica que, no deploy atual, o arquivo efetivamente aplicado é o compose da raiz (ou, no mínimo, ele está prevalecendo).
- Além disso, no último ajuste, as variáveis `GOOGLE_*` foram removidas do compose de `deploy/easypanel`, então esse arquivo também ficou incapaz de injetá-las caso seja usado.
- Resultado final em qualquer cenário: backend recebe `GOOGLE_*` vazio/ausente e retorna 422 corretamente.

2) Correção definitiva (sem depender de “qual compose está ativo”)
Vou aplicar a mesma política de configuração nos dois compose files:
- `docker-compose.yml` (raiz)
- `deploy/easypanel/docker-compose.yml`

Ajustes:
- Garantir presença explícita de:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`
- Remover fallback silencioso para vazio (`:-`) nessas 3 variáveis.
- Manter fallback apenas onde faz sentido operacional (ex.: `RATE_LIMIT_*`, `RUN_SEED`, `LOG_LEVEL`), evitando mascarar erro de credencial.
- Padronizar `API_URL` de produção para não cair em default local em ambiente de VPS.

3) Blindagem contra regressão silenciosa
No `backend/scripts/start.sh`:
- Manter o diagnóstico de presença das variáveis Google.
- Adicionar validação de consistência:
  - se 1 ou 2 variáveis Google vierem preenchidas e faltar alguma, abortar startup com erro claro (configuração parcial inválida).
  - se as 3 vierem preenchidas, seguir normalmente.
  - se nenhuma vier preenchida, sobe normalmente, mas marca integração Google como “não configurada”.
Isso evita estado “meio configurado” que causa comportamento imprevisível.

4) Indicador funcional no backend (para frontend e suporte)
No backend (camada calendar/status):
- Incluir no retorno de status Google um bloco de configuração:
  - `configured: boolean`
  - `missing: string[]` (ex.: `["GOOGLE_CLIENT_SECRET"]`)
Assim o frontend para de depender só da tentativa de conexão para descobrir erro e passa a mostrar status preventivo e objetivo.

5) Ajuste de UX no frontend (sem quebrar fluxo atual)
Na agenda:
- Se `configured=false`, desabilitar botão de conectar e exibir aviso direto com os campos faltantes.
- Se `configured=true`, comportamento atual segue normal.
- Mantém o tratamento já implementado para `GOOGLE_NOT_CONFIGURED` como fallback defensivo.

6) Arquivos que serão alterados
- `docker-compose.yml` (raiz)
- `deploy/easypanel/docker-compose.yml`
- `backend/scripts/start.sh`
- `backend/src/services/calendar.service.ts` (status/config metadata)
- `backend/src/controllers/calendar.controller.ts` (exposição do status enriquecido)
- `src/contexts/CalendarContext.tsx` e/ou `src/components/calendar/IntegrationCard.tsx` (UX de bloqueio preventivo)

7) Resultado esperado após rebuild
- Independentemente de qual compose o ambiente esteja usando, as variáveis Google serão consumidas da mesma forma.
- O backend deixa de operar em silêncio com config inválida/parcial.
- A UI passa a refletir estado real de configuração antes do clique.
- Sem intervenção manual pós-deploy além do rebuild.

Detalhes técnicos
```text
Fluxo final esperado:

EasyPanel Env UI
   -> Compose ativo (raiz ou deploy/easypanel, ambos padronizados)
      -> backend container env (GOOGLE_*)
         -> start.sh valida e loga estado
            -> server sobe com config consistente
               -> /api/calendar/google/status informa configured/missing
                  -> frontend habilita/bloqueia conexão corretamente
```
