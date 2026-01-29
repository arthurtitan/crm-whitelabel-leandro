
# Correção do Auto-Sync do Google Calendar Após OAuth

## Resumo do Problema

Após o fluxo de autenticação OAuth com o Google Calendar, a sincronização automática de eventos **não está sendo disparada**, mesmo com o parâmetro `google_connected=true` na URL. O usuário precisa clicar manualmente no botão de sincronização para ver seus eventos.

## Evidências Coletadas Durante os Testes

| Componente | Status | Observação |
|------------|--------|------------|
| Conexão OAuth | OK | Redireciona corretamente para o Google |
| Callback | OK | Salva tokens no banco de dados |
| Sync Manual | OK | Funciona perfeitamente (5 eventos sincronizados) |
| Auto-Sync Callback | FALHA | Não dispara após retorno do OAuth |
| Desconexão | OK | Remove tokens e eventos corretamente |

## Causa Raiz Identificada

O fluxo atual tem uma **condição de corrida** no useEffect do `AdminAgendaPage`:

1. O callback do Google redireciona para `/admin/agenda?google_connected=true&force_sync=true`
2. O useEffect detecta o parâmetro e chama `runSync()` 
3. Porém, o componente ainda está em fase de montagem inicial
4. O `CalendarContext` pode não estar completamente hidratado quando `syncNow()` é chamado
5. Embora `syncNow` agora verifique a sessão diretamente, a execução pode ocorrer antes da sessão estar disponível

## Solução Proposta

### 1. Adicionar logs de debug para rastrear o fluxo
Inserir console.logs estratégicos para identificar exatamente onde o fluxo está falhando.

### 2. Usar estado de "pronto" para o sync
Criar um flag `isInitialized` no CalendarContext que só fica true após a hidratação completa, garantindo que o sync só seja tentado quando tudo estiver pronto.

### 3. Melhorar a detecção do callback
Usar um ref para evitar múltiplas execuções e garantir que o sync seja tentado até funcionar (com retry limitado).

### 4. Sincronizar diretamente no callback (fallback)
Se o frontend não conseguir disparar o sync após 2 tentativas, exibir mensagem orientando o usuário a clicar no botão de sincronização.

---

## Arquivos que Serão Modificados

### `src/contexts/CalendarContext.tsx`
- Adicionar estado `isInitialized` para indicar quando o contexto está pronto
- Adicionar logs de debug no `syncNow` para rastrear execução
- Expor `isInitialized` no contexto

### `src/pages/admin/AdminAgendaPage.tsx`  
- Usar `isInitialized` do contexto para aguardar antes de tentar sync
- Adicionar retry com limite para o auto-sync
- Melhorar feedback visual durante o processo de sincronização pós-callback
- Usar `useRef` para prevenir múltiplas execuções do useEffect

---

## Detalhes Técnicos da Implementação

### CalendarContext.tsx - Mudanças

```typescript
// Adicionar estado de inicialização
const [isInitialized, setIsInitialized] = useState(false);

// No useEffect inicial, marcar como inicializado após checkConnectionStatus
useEffect(() => {
  if (accountId) {
    const init = async () => {
      await checkConnectionStatus();
      await loadEvents();
      setIsInitialized(true);
      console.log('[Calendar] Context initialized');
    };
    init();
  }
}, [accountId, checkConnectionStatus, loadEvents]);

// Adicionar logs ao syncNow
const syncNow = useCallback(async () => {
  console.log('[Calendar] syncNow called');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.warn('[Calendar] syncNow: No session, aborting');
    return;
  }
  console.log('[Calendar] syncNow: Session found, proceeding...');
  // ... resto do código
}, [loadEvents]);
```

### AdminAgendaPage.tsx - Mudanças

```typescript
const { 
  // ... outros
  syncNow,
  checkConnectionStatus,
  isInitialized, // novo
} = useCalendar();

const syncAttemptedRef = useRef(false);

useEffect(() => {
  const googleConnected = searchParams.get('google_connected') || searchParams.get('google');
  
  if ((googleConnected === 'true' || googleConnected === 'connected') && !syncAttemptedRef.current) {
    // Limpar URL imediatamente
    setSearchParams({});
    
    // Aguardar contexto estar pronto
    if (!isInitialized) {
      console.log('[Agenda] Waiting for context to initialize...');
      return;
    }
    
    syncAttemptedRef.current = true;
    toast.success('Google Calendar conectado! Sincronizando eventos...');
    
    const runSync = async () => {
      console.log('[Agenda] Running post-OAuth sync...');
      await checkConnectionStatus();
      await syncNow();
      await loadEvents();
      console.log('[Agenda] Post-OAuth sync complete');
    };
    
    // Pequeno delay para garantir estabilidade
    setTimeout(runSync, 500);
  }
}, [searchParams, setSearchParams, checkConnectionStatus, syncNow, isInitialized]);
```

---

## Validação Pós-Implementação

1. **Teste no site publicado**: Login -> Agenda -> Desconectar -> Reconectar com Google -> Verificar se eventos aparecem automaticamente

2. **Verificar logs do console**: Confirmar que as mensagens `[Calendar] syncNow called` e `[Agenda] Post-OAuth sync complete` aparecem

3. **Verificar logs do backend**: Confirmar que `google-calendar-sync` é chamada após o callback OAuth

4. **Teste de troca de conta**: Desconectar -> Conectar com outra conta Google -> Verificar se apenas eventos da nova conta aparecem

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Delay muito curto | Usar 500ms em vez de 300ms para garantir estabilidade |
| Múltiplas execuções do useEffect | Usar useRef para controlar estado de tentativa |
| Contexto não inicializa | Aguardar isInitialized antes de tentar sync |
| Usuário fecha aba antes do sync | Toast informativo explicando que eventos estão sendo sincronizados |
