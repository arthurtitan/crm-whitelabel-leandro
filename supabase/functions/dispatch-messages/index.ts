import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Contact {
  nome: string;
  telefone: string;
}

async function getAccountConfig(accountId: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('accounts')
    .select('chatwoot_base_url, chatwoot_account_id, chatwoot_api_key')
    .eq('id', accountId)
    .single();

  if (error || !data) throw new Error('Account not found');
  if (!data.chatwoot_base_url || !data.chatwoot_account_id || !data.chatwoot_api_key) {
    throw new Error('Chatwoot not configured');
  }

  return {
    baseUrl: data.chatwoot_base_url.replace(/\/$/, ''),
    accountId: data.chatwoot_account_id,
    apiKey: data.chatwoot_api_key,
  };
}

async function listInboxes(config: { baseUrl: string; accountId: string; apiKey: string }) {
  const res = await fetch(`${config.baseUrl}/api/v1/accounts/${config.accountId}/inboxes`, {
    headers: { 'api_access_token': config.apiKey },
  });
  if (!res.ok) throw new Error('Failed to fetch inboxes');
  const data = await res.json();
  return (data.payload || []).map((i: any) => ({
    id: i.id,
    name: i.name,
    channel_type: i.channel_type,
    phone_number: i.phone_number || null,
  }));
}

async function createContactAndConversation(
  config: { baseUrl: string; accountId: string; apiKey: string },
  contact: Contact,
  inboxId: number
) {
  const base = `${config.baseUrl}/api/v1/accounts/${config.accountId}`;
  const headers = {
    'Content-Type': 'application/json',
    'api_access_token': config.apiKey,
  };

  // Normalize phone
  let phone = contact.telefone.replace(/[\s\-\(\)]/g, '');
  if (!phone.startsWith('+')) phone = '+' + phone;

  // 1. Create contact
  const contactRes = await fetch(`${base}/contacts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: contact.nome, phone_number: phone }),
  });

  let contactId: number;
  if (contactRes.ok) {
    const cData = await contactRes.json();
    contactId = cData.payload?.contact?.id || cData.payload?.id || cData.id;
  } else {
    // Contact may already exist — try to search
    const searchRes = await fetch(`${base}/contacts/search?q=${encodeURIComponent(phone)}&include_contacts=true`, {
      headers: { 'api_access_token': config.apiKey },
    });
    if (!searchRes.ok) throw new Error(`Cannot create or find contact: ${contact.nome}`);
    const searchData = await searchRes.json();
    const found = (searchData.payload || []).find((c: any) =>
      c.phone_number?.replace(/\D/g, '') === phone.replace(/\D/g, '')
    );
    if (!found) throw new Error(`Contact creation failed and not found: ${contact.nome}`);
    contactId = found.id;
  }

  // 2. Create conversation
  const convRes = await fetch(`${base}/conversations`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ contact_id: contactId, inbox_id: inboxId, status: 'open' }),
  });

  let conversationId: number;
  if (convRes.ok) {
    const convData = await convRes.json();
    conversationId = convData.id;
  } else {
    // If conversation already exists, search for it
    const convSearchRes = await fetch(
      `${base}/contacts/${contactId}/conversations`,
      { headers: { 'api_access_token': config.apiKey } }
    );
    if (!convSearchRes.ok) throw new Error('Cannot create or find conversation');
    const convSearchData = await convSearchRes.json();
    const existing = (convSearchData.payload || []).find(
      (c: any) => c.inbox_id === inboxId
    );
    if (!existing) throw new Error('Conversation creation failed');
    conversationId = existing.id;
  }

  return { contactId, conversationId };
}

async function sendMessage(
  config: { baseUrl: string; accountId: string; apiKey: string },
  conversationId: number,
  message: string
) {
  const res = await fetch(
    `${config.baseUrl}/api/v1/accounts/${config.accountId}/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': config.apiKey,
      },
      body: JSON.stringify({
        content: message,
        message_type: 'outgoing',
        private: false,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to send message: ${err}`);
  }
  return res.json();
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, account_id } = body;

    if (!account_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'account_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = await getAccountConfig(account_id);

    // List inboxes action
    if (action === 'list-inboxes') {
      const inboxes = await listInboxes(config);
      return new Response(
        JSON.stringify({ success: true, inboxes }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Dispatch action
    if (action === 'dispatch') {
      const { inbox_id, delay_seconds, messages, contacts } = body as {
        inbox_id: number;
        delay_seconds: number;
        messages: string[];
        contacts: Contact[];
      };

      if (!inbox_id || !messages?.length || !contacts?.length) {
        return new Response(
          JSON.stringify({ success: false, error: 'inbox_id, messages and contacts required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const delayMs = Math.max((delay_seconds || 30) * 1000, 5000);
      const results: Array<{ nome: string; status: string; error?: string }> = [];

      for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        try {
          // Pick random message variant
          const msgTemplate = messages[Math.floor(Math.random() * messages.length)];
          const message = msgTemplate.replace(/\{nome\}/gi, contact.nome);

          // Create contact + conversation
          const { conversationId } = await createContactAndConversation(config, contact, inbox_id);

          // Send message
          await sendMessage(config, conversationId, message);

          results.push({ nome: contact.nome, status: 'sent' });
          console.log(`[dispatch] Sent to ${contact.nome} (${i + 1}/${contacts.length})`);
        } catch (err: any) {
          console.error(`[dispatch] Failed for ${contact.nome}:`, err.message);
          results.push({ nome: contact.nome, status: 'failed', error: err.message });
        }

        // Delay between sends (skip after last)
        if (i < contacts.length - 1) {
          await sleep(delayMs);
        }
      }

      const sent = results.filter(r => r.status === 'sent').length;
      const failed = results.filter(r => r.status === 'failed').length;

      return new Response(
        JSON.stringify({ success: true, sent, failed, total: contacts.length, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[dispatch-messages] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
