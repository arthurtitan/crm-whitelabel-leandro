import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chatwoot_account_id, conversation_id, resolved_by, resolution_type, agent_id, ai_participated } = await req.json();

    // Validação
    if (!chatwoot_account_id || !conversation_id || !resolved_by) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campos obrigatórios: chatwoot_account_id, conversation_id, resolved_by' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['ai', 'human'].includes(resolved_by)) {
      return new Response(
        JSON.stringify({ success: false, error: 'resolved_by deve ser "ai" ou "human"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Lookup: chatwoot_account_id → UUID do CRM
    const { data: accounts, error: accountError } = await supabase
      .from('accounts')
      .select('id')
      .eq('chatwoot_account_id', String(chatwoot_account_id))
      .limit(1);

    const account = accounts?.[0] || null;

    if (accountError) {
      throw accountError;
    }

    if (!account) {
      console.error('[log-resolution] Conta não encontrada para chatwoot_account_id:', chatwoot_account_id);
      return new Response(
        JSON.stringify({ success: false, error: `Conta com chatwoot_account_id=${chatwoot_account_id} não encontrada no CRM` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // INSERT com ON CONFLICT DO NOTHING para idempotência
    const { data, error } = await supabase
      .from('resolution_logs')
      .insert({
        account_id: account.id,
        conversation_id: Number(conversation_id),
        resolved_by,
        resolution_type: resolution_type || 'explicit',
        agent_id: agent_id ? Number(agent_id) : null,
        ai_participated: ai_participated === true,
        resolved_at: new Date().toISOString(),
      })
      .select()
      .maybeSingle();

    if (error) {
      // Unique constraint violation = duplicate, treat as success
      if (error.code === '23505') {
        console.log('[log-resolution] Duplicate ignored:', { conversation_id, resolved_by });
        return new Response(
          JSON.stringify({ success: true, duplicate: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    console.log('[log-resolution] Logged:', { id: data?.id, conversation_id, resolved_by, account_id: account.id });

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao registrar resolução';
    console.error('[log-resolution] Error:', msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
