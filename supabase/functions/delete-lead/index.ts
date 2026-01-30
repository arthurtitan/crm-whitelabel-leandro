import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DeleteLeadRequest {
  contact_id: string;
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  return typeof err === 'string' ? err : 'Unknown error';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { success: false, error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization') ?? '';
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse(401, { success: false, error: 'Usuário não autenticado' });
    }

    const body: DeleteLeadRequest = await req.json();
    const contact_id = body?.contact_id;

    if (!contact_id) {
      return jsonResponse(400, { success: false, error: 'contact_id é obrigatório' });
    }

    // Load contact (admin client because we need chatwoot ids regardless of RLS)
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('contacts')
      .select('id, account_id, chatwoot_contact_id, chatwoot_conversation_id')
      .eq('id', contact_id)
      .maybeSingle();

    if (contactError) {
      return jsonResponse(500, { success: false, error: contactError.message });
    }
    if (!contact) {
      return jsonResponse(404, { success: false, error: 'Lead não encontrado' });
    }

    // Authorization: only members of the account can delete
    const { data: isMember, error: memberError } = await supabaseUser.rpc('is_account_member', {
      _account_id: contact.account_id,
    });
    if (memberError) {
      return jsonResponse(500, { success: false, error: memberError.message });
    }
    if (!isMember) {
      return jsonResponse(403, { success: false, error: 'Sem permissão para remover este lead' });
    }

    // Safety: don’t delete leads that have sales
    const { count: salesCount, error: salesError } = await supabaseAdmin
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .eq('contact_id', contact_id);
    if (salesError) {
      return jsonResponse(500, { success: false, error: salesError.message });
    }
    if ((salesCount ?? 0) > 0) {
      return jsonResponse(400, {
        success: false,
        error: 'Não é possível remover lead com vendas registradas',
      });
    }

    // Fetch Chatwoot config
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('chatwoot_base_url, chatwoot_account_id, chatwoot_api_key')
      .eq('id', contact.account_id)
      .maybeSingle();

    if (accountError) {
      return jsonResponse(500, { success: false, error: accountError.message });
    }

    let chatwoot_attempted = false;
    let chatwoot_deleted = false;
    let chatwoot_error: string | null = null;

    // Delete contact in Chatwoot (best-effort)
    if (
      account?.chatwoot_base_url &&
      account?.chatwoot_account_id &&
      account?.chatwoot_api_key &&
      contact.chatwoot_contact_id
    ) {
      chatwoot_attempted = true;
      const baseUrl = account.chatwoot_base_url.replace(/\/$/, '');
      const url = `${baseUrl}/api/v1/accounts/${account.chatwoot_account_id}/contacts/${contact.chatwoot_contact_id}`;

      const resp = await fetch(url, {
        method: 'DELETE',
        headers: {
          api_access_token: account.chatwoot_api_key,
        },
      });

      if (resp.ok) {
        chatwoot_deleted = true;
      } else {
        chatwoot_error = await resp.text();
      }
    }

    // Clean up related data first to avoid FK errors
    await supabaseAdmin.from('lead_tags').delete().eq('contact_id', contact_id);
    await supabaseAdmin.from('lead_notes').delete().eq('contact_id', contact_id);
    await supabaseAdmin.from('calendar_events').update({ contact_id: null }).eq('contact_id', contact_id);

    const { error: deleteError } = await supabaseAdmin.from('contacts').delete().eq('id', contact_id);
    if (deleteError) {
      return jsonResponse(500, { success: false, error: deleteError.message });
    }

    return jsonResponse(200, {
      success: true,
      chatwoot_attempted,
      chatwoot_deleted,
      chatwoot_error,
    });
  } catch (err) {
    return jsonResponse(500, { success: false, error: getErrorMessage(err) });
  }
});