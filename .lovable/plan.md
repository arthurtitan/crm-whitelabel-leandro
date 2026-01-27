
Contexto e diagnóstico (o que eu já validei)
- No meu teste automatizado aqui, o login do Super Admin com `admin@gleps.com.br / Admin@123` funcionou e redirecionou corretamente para `/super-admin`.
- No entanto, você relatou “loading infinito” especificamente na tela de login (em qualquer navegador). Isso indica um problema de robustez do fluxo de login no frontend: mesmo que o backend autentique, algum erro/throw não tratado pode travar o estado “Entrando...” para sempre.

Hipótese mais provável (causa raiz)
- A tela `LoginPage.tsx` controla o spinner do botão com um estado local `isLoading`.
- Hoje, o `handleSubmit` faz `setIsLoading(true)` e depois `await login(...)`, mas **não está protegido por `try/finally`**. Se por qualquer motivo `login(...)` lançar uma exceção (network, bug de runtime, ou erro inesperado dentro do AuthContext), o `setIsLoading(false)` não executa e o botão fica em “Entrando...” indefinidamente.
- Isso casa exatamente com o sintoma “fica dando loading infinito” mesmo quando o `/auth/v1/token` retorna 200.

Objetivo
- Eliminar definitivamente o “loading infinito” na tela de login e garantir que, se qualquer falha ocorrer, o usuário veja erro claro e consiga tentar novamente.
- Garantir que Super Admin sempre vá para `/super-admin` (sem depender de hacks, localStorage de role ou qualquer coisa insegura).

Mudanças planejadas (frontend)
1) Blindar o fluxo de submit contra exceções (correção principal)
- Em `src/pages/LoginPage.tsx`:
  - Envolver o `await login(email, password)` em `try/catch/finally`.
  - No `finally`, sempre executar `setIsLoading(false)`.
  - No `catch`, mostrar uma mensagem amigável (“Erro ao fazer login. Tente novamente.”) e registrar `console.error` com detalhes para diagnóstico.
Resultado: mesmo se algo der errado internamente, o spinner nunca fica infinito.

2) Timeout de segurança para login “pendurado”
- Ainda em `LoginPage.tsx`:
  - Implementar um timeout (ex.: 12–15s) para o `login(...)`.
  - Se estourar, cancelar a tentativa logicamente (não tem abort real do fetch em supabase-js, mas podemos resolver no UI) e mostrar erro “Tempo excedido ao autenticar”.
Resultado: mesmo em instabilidade de rede, nada fica infinito.

3) Robustez no AuthContext para evitar estados inconsistentes
- Em `src/contexts/AuthContext.tsx`:
  - Garantir que `login()` **nunca** propague exceções (sempre retorna `{ success: false, error }` no pior caso).
  - Adicionar logs estruturados em pontos críticos:
    - início/fim do login
    - falha ao buscar `profiles`
    - falha ao buscar `user_roles`
  - Ajustar inicialização para seguir o padrão recomendado: registrar `onAuthStateChange` antes de `getSession()` (isso reduz condições de corrida em alguns cenários).
Resultado: menos chance de estados “travados” e muito mais rastreabilidade.

4) Mensagem clara se o perfil/role não estiver configurado
- Se o usuário autenticou (token ok) mas `profiles` ou `user_roles` não retornarem o necessário:
  - exibir erro específico (“Usuário autenticado, mas sem permissões configuradas. Contate o administrador.”)
  - efetuar `signOut()` para não ficar em estado quebrado
Resultado: evita loops silenciosos e deixa a falha óbvia para correção.

Validações e testes (o que vou checar após implementar)
- Login Super Admin:
  - Deve sair do “Entrando...” sempre (sucesso ou erro).
  - Em caso de sucesso: ir para `/super-admin`.
- Simular falha:
  - Forçar erro (ex.: derrubar requests / simular exceção) e confirmar que o botão para de carregar e mostra erro.
- Navegação:
  - Acessar direto `/super-admin` sem sessão → redireciona para `/login`.
  - Logar e dar refresh (F5) → deve manter sessão e abrir `/super-admin` sem travar.
- Segurança:
  - Confirmar que role continua vindo exclusivamente de `user_roles` (não armazenar role em `profiles`).

Entrega
- Assim que você aprovar, eu implemento essas mudanças nos arquivos:
  - `src/pages/LoginPage.tsx`
  - `src/contexts/AuthContext.tsx`
  - (opcional) pequenos ajustes de logging/UX em componentes de rota, se necessário.

Risco e mitigação
- Risco: alterar inicialização do AuthProvider pode afetar pequenos detalhes do fluxo de sessão.
- Mitigação: manter comportamento atual (mesma lógica), apenas reorganizando ordem e adicionando fail-safes; testar todos os papéis (super_admin/admin/agent) no preview.

O que preciso de você
- Aprovar este plano para eu aplicar as correções no código (modo de implementação).
