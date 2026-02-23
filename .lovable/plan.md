
## Correcao da Movimentacao de Leads no Kanban

### Diagnostico (Causa Raiz Confirmada)

A movimentacao do lead "Despachante Brasil - ARAGUARI" para "interessado" foi executada com sucesso em duas camadas:
1. O `lead_tags` no banco foi atualizado corretamente para `interessado` (source: `kanban`)
2. A edge function `update-chatwoot-contact-labels` atualizou a label no Chatwoot de `novo_lead` para `interessado` com sucesso

**Porem**, 30 segundos depois, o polling automatico chamou `sync-chatwoot-contacts`, que:
1. Buscou todas as conversas do Chatwoot via `/conversations?status=all`
2. A API do Chatwoot retornou dados **desatualizados** (cache/eventual consistency) - mostrando `novo_lead` em vez de `interessado`
3. A funcao de sync sobrescreveu o `lead_tag` de volta para `novo_lead` com `source: chatwoot_sync`

Evidencia no banco agora: o lead tem `tag_id: fe2b7d24 (novo_lead)`, `source: chatwoot_sync`, `created_at: 00:38:xx` - confirmando que o sync reverteu a mudanca manual.

### Solucao

Adicionar uma **janela de protecao** na funcao `sync-chatwoot-contacts`: antes de sobrescrever um `lead_tag`, verificar se ele foi aplicado recentemente (ultimos 2 minutos) com `source = 'kanban'`. Se sim, o CRM e tratado como fonte de verdade e o sync pula aquele contato, permitindo que a fase "CRM -> Chatwoot push" corrija o Chatwoot na sequencia.

### Alteracoes

**Arquivo: `supabase/functions/sync-chatwoot-contacts/index.ts`**

Na secao de processamento de labels por contato (linhas ~397-438), antes de remover/aplicar lead_tags baseado nas labels do Chatwoot:

1. Buscar o `lead_tag` atual do contato incluindo `source` e `created_at`
2. Se `source = 'kanban'` e `created_at` for menor que 2 minutos atras, pular o processamento desse contato com um log informativo
3. Isso garante que mudancas manuais feitas no Kanban tenham tempo de propagar para o Chatwoot antes que o sync tente reverter

Codigo conceitual da alteracao:

```text
// Dentro do loop de processamento de labels (antes de remover/aplicar tags):

// Verificar se o lead_tag atual foi aplicado recentemente pelo Kanban
const currentLeadTag = currentLeadTags?.find(lt => true); // primeiro tag
if (currentLeadTag) {
  // Buscar source e created_at
  const { data: tagDetail } = await supabaseAdmin
    .from('lead_tags')
    .select('source, created_at')
    .eq('id', currentLeadTag.id)
    .single();

  if (tagDetail?.source === 'kanban') {
    const tagAge = Date.now() - new Date(tagDetail.created_at).getTime();
    if (tagAge < 120000) { // 2 minutos
      console.log('[Sync Contacts] Skipping contact (recent kanban move):', contactId);
      continue; // Pula para o proximo contato
    }
  }
}
```

A fase "CRM -> Chatwoot push" (linhas 612-711) ja existe e corrigira automaticamente o Chatwoot para refletir o valor correto do CRM caso o label esteja desatualizado.

### Resultado Esperado

1. Usuario move lead no Kanban -> `lead_tags` atualizado (source: kanban) + Chatwoot label atualizado
2. Sync roda em 30s -> detecta source=kanban recente -> pula overwrite -> fase CRM->Chatwoot confirma/corrige o label
3. Apos 2 minutos, se o Chatwoot ja propagou a mudanca, o sync volta a funcionar normalmente para esse contato
