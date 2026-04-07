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

interface InboxAssignment {
  inbox_id: number;
  inbox_name: string;
  contacts: Contact[];
}

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

async function getAccountConfig(accountId: string) {
  const supabase = getSupabase();
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

  let phone = contact.telefone.replace(/[\s\-\(\)]/g, '');
  if (!phone.startsWith('+')) phone = '+' + phone;

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

    // Dispatch action with multi-inbox support
    if (action === 'dispatch') {
      const { inbox_assignments, delay_seconds, messages, keyword, location } = body as {
        inbox_assignments: InboxAssignment[];
        delay_seconds: number;
        messages: string[];
        keyword?: string;
        location?: string;
      };

      if (!inbox_assignments?.length || !messages?.length) {
        return new Response(
          JSON.stringify({ success: false, error: 'inbox_assignments and messages required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const totalContacts = inbox_assignments.reduce((sum, a) => sum + a.contacts.length, 0);
      const delayMs = Math.max((delay_seconds || 30) * 1000, 5000);
      const supabase = getSupabase();

      // Create batch record
      const { data: batch, error: batchErr } = await supabase
        .from('dispatch_batches')
        .insert({
          account_id,
          keyword: keyword || null,
          location: location || null,
          total_contacts: totalContacts,
          status: 'running',
          delay_seconds: delay_seconds || 30,
        })
        .select('id')
        .single();

      if (batchErr || !batch) {
        throw new Error('Failed to create dispatch batch');
      }

      const batchId = batch.id;

      // Create all log entries as pending
      const logEntries = inbox_assignments.flatMap(assignment =>
        assignment.contacts.map(c => ({
          batch_id: batchId,
          contact_name: c.nome,
          phone: c.telefone,
          inbox_id: assignment.inbox_id,
          inbox_name: assignment.inbox_name,
          status: 'pending',
        }))
      );

      await supabase.from('dispatch_logs').insert(logEntries);

      // Process in background — return immediately with batch ID
      const processInBackground = async () => {
        let sentCount = 0;
        let failedCount = 0;

        // Flatten all assignments into ordered list
        const allTasks: Array<{ contact: Contact; inboxId: number; inboxName: string }> = [];
        // Round-robin across inboxes for better distribution
        const maxLen = Math.max(...inbox_assignments.map(a => a.contacts.length));
        for (let i = 0; i < maxLen; i++) {
          for (const assignment of inbox_assignments) {
            if (i < assignment.contacts.length) {
              allTasks.push({
                contact: assignment.contacts[i],
                inboxId: assignment.inbox_id,
                inboxName: assignment.inbox_name,
              });
            }
          }
        }

        for (let i = 0; i < allTasks.length; i++) {
          const task = allTasks[i];
          const phone = task.contact.telefone;

          try {
            const msgTemplate = messages[Math.floor(Math.random() * messages.length)];
            const message = msgTemplate.replace(/\{nome\}/gi, task.contact.nome);
            const { conversationId } = await createContactAndConversation(config, task.contact, task.inboxId);
            await sendMessage(config, conversationId, message);

            sentCount++;
            // Update individual log
            await supabase
              .from('dispatch_logs')
              .update({ status: 'sent', sent_at: new Date().toISOString() })
              .eq('batch_id', batchId)
              .eq('phone', phone)
              .eq('inbox_id', task.inboxId);

            // Update batch counts
            await supabase
              .from('dispatch_batches')
              .update({ sent_count: sentCount, failed_count: failedCount })
              .eq('id', batchId);

            console.log(`[dispatch] Sent to ${task.contact.nome} via inbox ${task.inboxName} (${i + 1}/${allTasks.length})`);
          } catch (err: any) {
            failedCount++;
            console.error(`[dispatch] Failed for ${task.contact.nome}:`, err.message);

            await supabase
              .from('dispatch_logs')
              .update({ status: 'failed', error_message: err.message, sent_at: new Date().toISOString() })
              .eq('batch_id', batchId)
              .eq('phone', phone)
              .eq('inbox_id', task.inboxId);

            await supabase
              .from('dispatch_batches')
              .update({ sent_count: sentCount, failed_count: failedCount })
              .eq('id', batchId);
          }

          if (i < allTasks.length - 1) {
            await sleep(delayMs);
          }
        }

        // Mark batch as completed
        await supabase
          .from('dispatch_batches')
          .update({
            status: failedCount === totalContacts ? 'failed' : 'completed',
            sent_count: sentCount,
            failed_count: failedCount,
            completed_at: new Date().toISOString(),
          })
          .eq('id', batchId);
      };

      // Fire and forget — Edge Functions stay alive for the background work
      processInBackground().catch(err => {
        console.error('[dispatch] Background processing error:', err);
        getSupabase()
          .from('dispatch_batches')
          .update({ status: 'failed', completed_at: new Date().toISOString() })
          .eq('id', batchId);
      });

      return new Response(
        JSON.stringify({ success: true, batch_id: batchId, total: totalContacts }),
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
