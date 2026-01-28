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
  initial_label_name?: string; // Label to apply to the conversation after creation
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
    const { account_id, name, phone, email, create_conversation = true, initial_label_name } = body;

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

    // Normalize phone to E.164 format (must start with +)
    let normalizedPhone = phone.replace(/[\s\-\(\)]/g, ''); // Remove spaces, dashes, parentheses
    if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+' + normalizedPhone;
    }

    // Create contact in Chatwoot
    const createContactUrl = `${baseUrl}/api/v1/accounts/${chatwoot_account_id}/contacts`;
    
    const contactPayload: Record<string, string> = {
      name,
      phone_number: normalizedPhone,
    };
    if (email) {
      contactPayload.email = email;
    }

    console.log('[create-chatwoot-contact] Creating contact in Chatwoot:', { name, phone: normalizedPhone });

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

    const contactData = await contactResponse.json();
    console.log('[create-chatwoot-contact] Chatwoot contact response:', JSON.stringify(contactData));
    
    // Handle different response formats from Chatwoot API
    let chatwoot_contact_id: number | undefined;
    if (contactData.payload?.contact?.id) {
      chatwoot_contact_id = contactData.payload.contact.id;
    } else if (contactData.payload?.id) {
      chatwoot_contact_id = contactData.payload.id;
    } else if (contactData.id) {
      chatwoot_contact_id = contactData.id;
    }

    console.log('[create-chatwoot-contact] Extracted contact ID:', chatwoot_contact_id);

    if (!chatwoot_contact_id) {
      console.error('[create-chatwoot-contact] Could not extract contact ID from response');
      return new Response(
        JSON.stringify({ success: false, error: 'Could not extract contact ID from Chatwoot response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

            // Apply initial label if provided
            if (initial_label_name && chatwoot_conversation_id) {
              console.log('[create-chatwoot-contact] Applying initial label:', initial_label_name);
              
              const labelUrl = `${baseUrl}/api/v1/accounts/${chatwoot_account_id}/conversations/${chatwoot_conversation_id}/labels`;
              
              const labelResponse = await fetch(labelUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'api_access_token': chatwoot_api_key,
                },
                body: JSON.stringify({
                  labels: [initial_label_name],
                }),
              });

              if (labelResponse.ok) {
                console.log('[create-chatwoot-contact] Initial label applied successfully');
              } else {
                const labelError = await labelResponse.text();
                console.warn('[create-chatwoot-contact] Failed to apply initial label:', labelError);
                // Don't fail the whole request, just log the warning
              }
            }
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
