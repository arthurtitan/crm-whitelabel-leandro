import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateChatwootContactRequest {
  account_id: string;
  name: string;
  phone: string;
  email?: string;
  create_conversation?: boolean;
}

interface ChatwootContactResponse {
  payload: {
    id: number;
    name: string;
    phone_number: string;
    email?: string;
  };
}

interface ChatwootInboxResponse {
  payload: Array<{
    id: number;
    name: string;
    channel_type: string;
  }>;
}

interface ChatwootConversationResponse {
  id: number;
  inbox_id: number;
  contact_id: number;
  status: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: CreateChatwootContactRequest = await req.json();
    const { account_id, name, phone, email, create_conversation = true } = body;

    // Validate required fields
    if (!account_id || !name || !phone) {
      return new Response(
        JSON.stringify({ success: false, error: 'account_id, name and phone are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch account configuration
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('chatwoot_base_url, chatwoot_account_id, chatwoot_api_key')
      .eq('id', account_id)
      .single();

    if (accountError || !account) {
      return new Response(
        JSON.stringify({ success: false, error: 'Account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { chatwoot_base_url, chatwoot_account_id, chatwoot_api_key } = account;

    if (!chatwoot_base_url || !chatwoot_account_id || !chatwoot_api_key) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chatwoot not configured for this account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize base URL (remove trailing slash)
    const baseUrl = chatwoot_base_url.replace(/\/$/, '');

    // Create contact in Chatwoot
    const createContactUrl = `${baseUrl}/api/v1/accounts/${chatwoot_account_id}/contacts`;
    
    const contactPayload: Record<string, string> = {
      name,
      phone_number: phone,
    };
    if (email) {
      contactPayload.email = email;
    }

    console.log('[create-chatwoot-contact] Creating contact in Chatwoot:', { name, phone });

    const contactResponse = await fetch(createContactUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': chatwoot_api_key,
      },
      body: JSON.stringify(contactPayload),
    });

    if (!contactResponse.ok) {
      const errorText = await contactResponse.text();
      console.error('[create-chatwoot-contact] Failed to create contact:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to create contact in Chatwoot: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const contactData: ChatwootContactResponse = await contactResponse.json();
    const chatwoot_contact_id = contactData.payload.id;

    console.log('[create-chatwoot-contact] Contact created with ID:', chatwoot_contact_id);

    let chatwoot_conversation_id: number | null = null;

    // Create conversation if requested
    if (create_conversation) {
      // First, fetch available inboxes
      const inboxesUrl = `${baseUrl}/api/v1/accounts/${chatwoot_account_id}/inboxes`;
      
      const inboxesResponse = await fetch(inboxesUrl, {
        method: 'GET',
        headers: {
          'api_access_token': chatwoot_api_key,
        },
      });

      if (inboxesResponse.ok) {
        const inboxesData: ChatwootInboxResponse = await inboxesResponse.json();
        
        if (inboxesData.payload && inboxesData.payload.length > 0) {
          // Use the first available inbox
          const inbox = inboxesData.payload[0];
          
          console.log('[create-chatwoot-contact] Creating conversation with inbox:', inbox.id, inbox.name);

          // Create conversation
          const conversationUrl = `${baseUrl}/api/v1/accounts/${chatwoot_account_id}/conversations`;
          
          const conversationResponse = await fetch(conversationUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'api_access_token': chatwoot_api_key,
            },
            body: JSON.stringify({
              contact_id: chatwoot_contact_id,
              inbox_id: inbox.id,
              status: 'open',
            }),
          });

          if (conversationResponse.ok) {
            const conversationData: ChatwootConversationResponse = await conversationResponse.json();
            chatwoot_conversation_id = conversationData.id;
            console.log('[create-chatwoot-contact] Conversation created with ID:', chatwoot_conversation_id);
          } else {
            const errorText = await conversationResponse.text();
            console.warn('[create-chatwoot-contact] Failed to create conversation:', errorText);
          }
        } else {
          console.warn('[create-chatwoot-contact] No inboxes available to create conversation');
        }
      } else {
        const errorText = await inboxesResponse.text();
        console.warn('[create-chatwoot-contact] Failed to fetch inboxes:', errorText);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        chatwoot_contact_id,
        chatwoot_conversation_id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[create-chatwoot-contact] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
