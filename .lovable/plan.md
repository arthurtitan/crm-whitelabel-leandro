
Contexto e evidências (o que eu verifiquei)
- Nos logs de chamadas do backend (ambiente publicado), existem chamadas para:
  - google-calendar-auth-url (200)
  - google-calendar-callback (302)
  - google-calendar-status (200)
- Não existe nenhuma chamada registrada para google-calendar-sync após o callback.
- No banco (publicado e teste) existe token salvo para o usuário (google_calendar_tokens), porém:
  - Não existem eventos source='google' em calendar_events.
  - Ou seja: a conexão está sendo gravada, mas a sincronização não está sendo disparada/efetivada — por isso a agenda não “espelha” o Google Calendar e pode aparentar “incongruência” (conectado, mas sem eventos corretos).

Causa raiz principal (por que não sincroniza mesmo com force_sync)
1) Bloqueio lógico no frontend durante o auto-sync do callback
- AdminAgendaPage tenta fazer:
  - await checkConnectionStatus()
  - await syncNow()
- Porém, dentro de CalendarContext.syncNow existe:
  - if (!isConnected) return;
- isConnected depende de state (connection.status) e o setConnection feito em checkConnectionStatus não atualiza o estado “sincronamente” para a mesma execução (closure antiga).
- Resultado: no fluxo do callback, syncNow retorna cedo (não chama a função de sync), então nenhum evento é importado.
- Isso bate 100% com a evidência: callback ocorreu, status ocorreu, mas sync nunca foi chamado.

2) Fluxo “nova aba” pode mascarar estado e gerar percepção de “não trocou”
- Hoje o connectGoogle abre sempre em nova aba (window.open).
- Em publicado, não há restrição de iframe; abrir em nova aba é desnecessário e pode confundir (usuário volta para a aba original e não vê mudança).
- Mesmo que a aba nova esteja correta, a aba antiga pode continuar exibindo estado antigo até refresh/manual.

3) Segurança/isolamento ainda está permissivo no banco para calendar_events
- Atualmente a policy de SELECT em calendar_events permite qualquer membro da conta ver qualquer evento da conta (is_account_member(account_id)), incluindo eventos Google de outros usuários.
- Mesmo que o frontend filtre por created_by, isso não impede acesso direto via API.
- Para “por usuário” ser garantido, precisamos reforçar RLS para Google events.

Objetivo funcional (critérios de aceite)
- Conectar: após concluir o OAuth, a agenda deve buscar eventos do Google da conta conectada e exibir apenas os eventos Google do usuário logado (created_by = auth.uid()).
- Trocar conta Google: ao reconectar com outra conta, deve apagar eventos Google antigos daquele usuário e exibir somente os eventos da nova conta conectada.
- Desconectar: deve remover token + apagar eventos Google do usuário e permitir conectar novamente (mesma ou outra conta).
- Publicado e Preview: funcionar nos dois (no Preview pode continuar abrindo nova aba; no Publicado preferir mesma aba).

Plano de correção (implementação)
A) Corrigir o auto-sync do callback (garantir que google-calendar-sync é chamado)
1) Ajustar CalendarContext.syncNow para não “morrer” por isConnected no fluxo de callback
Opções (vou implementar a mais robusta):
- Alterar syncNow para:
  - checar sessão (auth.getSession) e abortar se não autenticado
  - tentar invocar google-calendar-sync independente do isConnected local
  - se backend responder “Google Calendar não conectado”, exibir toast apropriado
Isso elimina o bug de closure e garante que force_sync realmente força sync.

2) Ajustar AdminAgendaPage para não depender de estado React recém-atualizado
- Manter checkConnectionStatus, mas:
  - chamar syncNow sem depender do isConnected local (após o ajuste acima)
  - após syncNow: chamar loadEvents (já é chamado dentro de syncNow) e checkConnectionStatus novamente
- Também garantir que o parâmetro force_sync seja tratado de forma consistente (hoje ele chama syncNow em setTimeout, mas sofre do mesmo problema do isConnected).

B) Melhorar o comportamento “Publicado vs Preview” no connectGoogle
3) Ajustar CalendarContext.connectGoogle para:
- Se estiver dentro de iframe (Preview): window.open(authUrl, '_blank') (mantém o workaround)
- Se estiver fora de iframe (Publicado): redirecionar na mesma aba (window.location.href = authUrl)
Isso garante que o usuário termina o OAuth e retorna para a mesma sessão/aba, reduzindo “estado antigo” e tornando o fluxo previsível.

C) Garantir limpeza e atualização imediata ao desconectar/trocar conta
4) Confirmar fluxo de desconexão completo
- Backend google-calendar-disconnect já:
  - revoga token (best effort)
  - apaga calendar_events source='google' para created_by=user.id
  - remove token
- Frontend disconnectGoogle já remove eventos Google do estado local.
Melhoria que vou adicionar:
- Após desconectar, chamar loadEvents() para garantir que a UI reflita o banco (caso o usuário recarregue/volte).

5) Troca de conta já limpa eventos no callback
- Backend google-calendar-callback já apaga eventos Google do usuário antes do upsert do token.
- Com o auto-sync corrigido, a troca passa a:
  - limpar eventos antigos
  - sincronizar e popular os novos eventos imediatamente

D) Correção de RLS para “por usuário” ser garantido no banco (evitar vazamento entre usuários)
6) Atualizar policies de calendar_events (SELECT/INSERT/UPDATE/DELETE)
- Substituir a policy permissiva de SELECT “Account members can view/manage calendar” por uma regra que:
  - permita ver eventos CRM por account_id (membro da conta)
  - permita ver eventos Google somente quando created_by = auth.uid()
Exemplo de regra (conceito):
  USING (
    (source = 'crm' AND is_account_member(account_id))
    OR
    (source = 'google' AND created_by = auth.uid())
  )
- Ajustar UPDATE/DELETE/INSERT para impedir que usuários manipulem eventos Google de outros:
  - INSERT: permitir apenas source='crm' para membros
  - UPDATE/DELETE: permitir apenas source='crm' para membros (Google será gerenciado pela função de sync/desconexão com credenciais elevadas)
- Rever policy “Admin can manage account calendar_events”: restringir a source='crm' também, para manter a promessa “por usuário” inclusive para admins (a menos que você queira que admin veja tudo; pela sua descrição, não quer).

7) Atualizar policies de google_calendar_tokens
- Remover/ajustar a policy “Account admins can manage google tokens”.
  - Tokens são sensíveis e, em arquitetura por usuário, devem ser acessíveis só pelo dono (auth.uid()=user_id) e por super admin (suporte).
- Garantir user_id NOT NULL para novos registros (se hoje estiver nullable).

8) Índices/constraints de integridade (opcional, mas recomendado)
- Adicionar unique index parcial para evitar duplicidade acidental:
  - UNIQUE (created_by, google_event_id) WHERE source='google'
Isso protege contra inserções duplicadas em casos de corrida/retries.

Arquivos e áreas que serão alteradas
Frontend
- src/contexts/CalendarContext.tsx
  - connectGoogle: mesma aba em publicado, nova aba em preview
  - syncNow: remover dependência de isConnected local, checar sessão e tentar sync
  - disconnectGoogle: chamar loadEvents após desconectar (hard refresh do estado)
- src/pages/admin/AdminAgendaPage.tsx
  - fluxo de callback: chamar syncNow de forma robusta e garantir refresh do estado

Backend (banco/policies)
- Nova migração SQL:
  - Ajustar RLS de calendar_events (SELECT/INSERT/UPDATE/DELETE)
  - Ajustar RLS de google_calendar_tokens (remover acesso por account admin)
  - (Opcional) índices/constraints

Como vou validar (teste ponta a ponta)
1) Publicado:
- Login
- Ir em /admin/agenda
- Conectar Google (deve ir na mesma aba)
- Ao voltar do Google: deve disparar sync (toast com contagem) e eventos aparecem
- Desconectar: eventos Google somem imediatamente e backend remove token/eventos
- Conectar novamente com outra conta Google: eventos antigos não aparecem; só os da conta nova

2) Preview (iframe):
- Conectar (nova aba)
- Ao finalizar OAuth, a aba de retorno deve mostrar eventos corretos
- A aba original: instruir/implementar refresh automático (dependendo do caminho escolhido; como mínimo, o botão “Sincronizar agora” deve funcionar)

3) Verificação técnica:
- Confirmar nos logs do backend que google-calendar-sync passa a ser chamado após callback
- Confirmar no banco que calendar_events source='google' passam a ser inseridos com created_by=user_id
- Confirmar que um usuário não consegue ler eventos Google de outro usuário via API (RLS)

Riscos e mitigação
- Alterar RLS pode bloquear funcionalidades existentes se houver código inserindo/atualizando eventos sem source correto.
  - Mitigação: manter CRM (source='crm') como antes; Google gerenciado apenas por funções com credenciais elevadas.
- Fluxo em nova aba no Preview:
  - Mitigação: manter window.open somente quando detectarmos iframe.

Próximo passo
- Após sua aprovação, eu implemento as mudanças de frontend + migração de RLS e em seguida valido com logs do backend (confirmando chamada efetiva ao sync) e com checagens no banco (eventos realmente criados).
