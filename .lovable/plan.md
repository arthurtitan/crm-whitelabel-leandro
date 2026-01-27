
Objetivo
- Resolver de forma permanente o problema intermitente de login que fica “Entrando...” e/ou termina em “Tempo excedido ao autenticar”, principalmente no Super Admin.
- Garantir que o login nunca fique preso: ou autentica e redireciona, ou falha com mensagem clara e possibilidade de tentar novamente, sem “estado quebrado”.

Diagnóstico (com base no que observei agora)
- A autenticação por senha está funcionando: o request POST /auth/v1/token retorna 200 e os logs de autenticação no backend confirmam logins bem-sucedidos.
- Em execuções “boas”, depois do token, o app faz:
  1) GET /profiles (200)
  2) GET /user_roles (200)
  3) GET /accounts (200)
  e redireciona corretamente para /super-admin.
- Porém, quando o usuário relata o erro, a tela mostra “Tempo excedido…” após ~15s. Esse erro é disparado pelo timeout no LoginPage (Promise.race). Ou seja: o método login() do AuthContext não está “resolvendo” dentro do prazo em alguns cenários.
- Causa raiz mais provável (e comum nesse tipo de stack):
  - O AuthContext.login() hoje faz 2 coisas “pesadas” em sequência: (a) signInWithPassword + (b) buscar profile/role/account imediatamente após o sign-in.
  - Ao mesmo tempo, o listener onAuthStateChange(SIGNED_IN) também busca profile/role/account.
  - Isso cria redundância (duas hidratações) e, pior, um cenário de “corrida/lock”: logo após o sign-in, a biblioteca ainda pode estar persistindo sessão/atualizando estado interno; disparar consultas de banco imediatamente pode ficar aguardando esse estado (ou lock) e não enviar requests, causando o “travamento” e, consequentemente, estourando o timeout do LoginPage.
  - Isso explica a intermitência: não é credencial inválida; é timing/estado interno no pós-login.

Estratégia de correção permanente
- Separar claramente:
  1) “Autenticar” (obter sessão) — deve ser rápido e previsível
  2) “Hidratar contexto do usuário” (profile/role/account) — deve acontecer num único lugar, com controle de concorrência, timeout próprio e tratamento de erro
- Remover a redundância e evitar consultas imediatamente após o signIn dentro do mesmo fluxo do login().

Mudanças planejadas (código)

1) Refatorar AuthContext: login() vira “apenas autenticar”
Arquivos: src/contexts/AuthContext.tsx
- Alterar login(email, password):
  - Passa a chamar apenas supabase.auth.signInWithPassword({ email, password })
  - Se der erro: retorna { success: false, error: ... } (mantém comportamento atual)
  - Se der sucesso: retorna { success: true } imediatamente
  - Importante: NÃO chamar fetchUserData dentro de login() e NÃO setar user/account diretamente aqui.
- Isso garante que:
  - O LoginPage não fica esperando hidratação para liberar o botão.
  - O fluxo não corre risco de “lock/race” pós-login.
  - Acaba a duplicidade (hoje a hidratação ocorre dentro de login() e também no SIGNED_IN).

2) Centralizar a hidratação do usuário somente no onAuthStateChange (+ INITIAL_SESSION)
Arquivos: src/contexts/AuthContext.tsx
- Criar uma função interna “hydrate(session.user)” que:
  - Busca profile e role (em paralelo) e só depois busca account (condicional).
  - Seleciona apenas colunas necessárias (evitar select('*') por performance e por segurança de dados no payload):
    - profiles: user_id, email, nome, status, permissions, account_id, chatwoot_agent_id
    - user_roles: role
    - accounts: id, nome, status, chatwoot_base_url, chatwoot_account_id (não trazer api_key para o cliente)
  - Para super_admin: pular o fetch de account por padrão (deixa account = null). Isso reduz uma chamada e elimina dependência desnecessária no login do Super Admin.
- Implementar controle de concorrência:
  - Um “hydrationInFlightRef” (ref) ou “requestId” para impedir 2 hidratações simultâneas e evitar que resultados “antigos” sobrescrevam os mais novos.
- Adicionar timeout próprio e retry leve para hidratação (não o timeout do LoginPage):
  - Ex.: 8s por etapa e até 1 retry (total ~16s) antes de falhar.
  - Se estourar/falhar:
    - Fazer signOut para evitar sessão “meio logada”
    - Setar estado como não autenticado
    - Guardar uma mensagem de erro no contexto (ex.: authError) para a UI exibir.
- Ajustar listener:
  - Tratar SIGNED_IN: rodar hydrate(session.user)
  - Tratar INITIAL_SESSION: se vier session.user, rodar hydrate(session.user)
  - Tratar SIGNED_OUT: limpar tudo
  - TOKEN_REFRESHED: opcionalmente não re-hidratar (ou re-hidratar com debounce), para evitar ruído

3) Ajustar LoginPage para não depender do timeout “errado”
Arquivos: src/pages/LoginPage.tsx
- O timeout atual (15s) está “punindo” a hidratação e não apenas o sign-in.
- Com a mudança acima, login() vai resolver rápido, então:
  - Remover o Promise.race do login() OU manter um timeout menor apenas para o signIn (ex.: 10–15s) — mas sem envolver a hidratação.
- Após “success: true”, a tela deve entrar num estado claro:
  - “Autenticado. Carregando seu perfil…” usando authLoading do contexto
  - E o redirecionamento continua sendo feito via useEffect quando isAuthenticated + user estiverem prontos.
- Exibir erro de hidratação:
  - Adicionar leitura de um novo campo do AuthContext (authError) e mostrar na UI, com botão “Tentar novamente” que:
    - chama logout() (garante limpeza)
    - limpa mensagem e permite nova tentativa
- Evitar inconsistência “token ok, erro exibido”:
  - Se o usuário receber erro, garantir que a sessão foi realmente finalizada (signOut) para não ficar autenticado silenciosamente.

4) Observabilidade para confirmar a causa e evitar regressões
Arquivos: src/contexts/AuthContext.tsx e src/pages/LoginPage.tsx
- Adicionar logs com duração (performance):
  - Tempo do signIn
  - Tempo do fetch profile / role / account
  - Em qual etapa houve timeout/erro
- (Opcional) Se quiser auditoria persistida, podemos gravar evento no backend (tabela events) quando houver falha de hidratação. Isso ajuda a detectar instabilidades recorrentes.

Critérios de sucesso (o que vamos validar no preview)
- Login Super Admin:
  - Não deve mais aparecer “Tempo excedido…” em cenários normais.
  - Não pode ficar preso em “Entrando…”.
  - Deve redirecionar para /super-admin assim que hidratar.
- Cenário de falha (simulado por instabilidade):
  - Deve mostrar mensagem clara (sem loop e sem spinner infinito).
  - Deve permitir tentar novamente sem precisar recarregar a página.
- Regressão:
  - Admin e Agent continuam autenticando e redirecionando corretamente.
  - Sessão ao recarregar (F5) continua funcionando (via INITIAL_SESSION/hidratação).

Arquivos que serão modificados
- src/contexts/AuthContext.tsx
  - refatorar login()
  - centralizar hidratação no onAuthStateChange e INITIAL_SESSION
  - adicionar timeout/retry da hidratação
  - (opcional) adicionar authError no estado do contexto
  - otimizar selects e pular account para super_admin
- src/pages/LoginPage.tsx
  - remover/ajustar timeout para não depender da hidratação
  - exibir estado “Carregando perfil…”
  - exibir authError e ação “Tentar novamente”

Riscos e mitigação
- Risco: ao remover a hidratação do login(), o redirecionamento pode depender 100% do onAuthStateChange.
  - Mitigação: tratar INITIAL_SESSION, usar controle de concorrência, e ter timeout com signOut + erro visível se a hidratação não concluir.
- Risco: super_admin sem account carregado pode impactar telas que assumem account.
  - Mitigação: super_admin routes não usam wrappers de account; e, se necessário, carregaremos account somente quando o super_admin acessar módulos /admin (sob demanda).

Sequência de execução
1) Refatorar AuthContext.login() para apenas autenticar
2) Implementar hydrate() robusto (timeout/retry/concorrência) e plugar em SIGNED_IN + INITIAL_SESSION
3) Ajustar LoginPage para refletir estados (autenticando vs carregando perfil vs erro) sem timeout indevido
4) Testar login/logout e refresh em Super Admin, Admin e Agent no preview
5) Se ainda houver intermitência: adicionar fallback de hidratação via backend function dedicada (plano B), mas a refatoração acima tende a resolver o problema de forma definitiva por eliminar a condição de corrida pós-login

