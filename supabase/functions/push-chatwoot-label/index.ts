import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushLabelRequest {
  account_id: string;
  action: 'create' | 'update' | 'delete';
  label: {
    title: string;
    color: string;
    description?: string;
  };
  tag_id?: string; // For update/delete: ID of the tag in our DB
  chatwoot_label_id?: number; // For update/delete: existing Chatwoot label ID
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: PushLabelRequest = await req.json();
    const { account_id, action, label, tag_id, chatwoot_label_id } = body;

    if (!account_id || !action || !label) {
      return new Response(
        JSON.stringify({ error: 'account_id, action, and label are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Push Label] ${action} label for account:`, account_id, label);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get account's Chatwoot config
    const { data: accountData, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('chatwoot_base_url, chatwoot_account_id, chatwoot_api_key')
      .eq('id', account_id)
      .single();

    if (accountError || !accountData) {
      console.error('[Push Label] Account not found:', accountError);
      return new Response(
        JSON.stringify({ error: 'Account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { chatwoot_base_url, chatwoot_account_id, chatwoot_api_key } = accountData;

    if (!chatwoot_base_url || !chatwoot_account_id || !chatwoot_api_key) {
      // Chatwoot not configured - just return success (no sync needed)
      console.log('[Push Label] Chatwoot not configured, skipping sync');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Chatwoot not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Chatwoot API expects color WITH the # prefix
    const normalizedColor = label.color.startsWith('#') ? label.color : `#${label.color}`;

    let result: { success: boolean; chatwoot_label_id?: number; error?: string };

    if (action === 'create') {
      // Create label in Chatwoot
      const createUrl = `${chatwoot_base_url}/api/v1/accounts/${chatwoot_account_id}/labels`;
      console.log('[Push Label] Creating label at:', createUrl);

      const response = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'api_access_token': chatwoot_api_key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: label.title,
          color: normalizedColor,
          description: label.description || `Created from CRM Kanban`,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Push Label] Chatwoot API error:', response.status, errorText);
        
        // Check if label already exists (409 conflict or similar)
        if (response.status === 422 || errorText.includes('already')) {
          console.log('[Push Label] Label might already exist, attempting to find it');
          
          // Try to find existing label
          const listUrl = `${chatwoot_base_url}/api/v1/accounts/${chatwoot_account_id}/labels`;
          const listResponse = await fetch(listUrl, {
            headers: { 'api_access_token': chatwoot_api_key },
          });
          
          if (listResponse.ok) {
            const labels = await listResponse.json();
            const existingLabel = labels.payload?.find((l: any) => 
              l.title.toLowerCase() === label.title.toLowerCase()
            );
            
            if (existingLabel) {
              result = { success: true, chatwoot_label_id: existingLabel.id };
              
              // Update our tag with the found chatwoot_label_id
              if (tag_id) {
                await supabaseAdmin
                  .from('tags')
                  .update({ chatwoot_label_id: existingLabel.id })
                  .eq('id', tag_id);
              }
            } else {
              result = { success: false, error: 'Label creation failed and could not find existing' };
            }
          } else {
            result = { success: false, error: `Chatwoot API error: ${response.status}` };
          }
        } else {
          result = { success: false, error: `Chatwoot API error: ${response.status}` };
        }
      } else {
        const data = await response.json();
        const newLabelId = data.id || data.payload?.id;
        console.log('[Push Label] Label created with ID:', newLabelId);
        
        result = { success: true, chatwoot_label_id: newLabelId };
        
        // Update our tag with the chatwoot_label_id
        if (tag_id && newLabelId) {
          await supabaseAdmin
            .from('tags')
            .update({ chatwoot_label_id: newLabelId })
            .eq('id', tag_id);
        }
      }
    } else if (action === 'update') {
      if (!chatwoot_label_id) {
        result = { success: false, error: 'chatwoot_label_id required for update' };
      } else {
        // Update label in Chatwoot
        const updateUrl = `${chatwoot_base_url}/api/v1/accounts/${chatwoot_account_id}/labels/${chatwoot_label_id}`;
        console.log('[Push Label] Updating label at:', updateUrl);

        const response = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'api_access_token': chatwoot_api_key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: label.title,
            color: normalizedColor,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Push Label] Chatwoot update error:', response.status, errorText);
          result = { success: false, error: `Chatwoot API error: ${response.status}` };
        } else {
          console.log('[Push Label] Label updated successfully');
          result = { success: true, chatwoot_label_id };
        }
      }
    } else if (action === 'delete') {
      if (!chatwoot_label_id) {
        result = { success: true }; // Nothing to delete in Chatwoot
      } else {
        // Delete label in Chatwoot
        const deleteUrl = `${chatwoot_base_url}/api/v1/accounts/${chatwoot_account_id}/labels/${chatwoot_label_id}`;
        console.log('[Push Label] Deleting label at:', deleteUrl);

        const response = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'api_access_token': chatwoot_api_key,
          },
        });

        if (!response.ok && response.status !== 404) {
          const errorText = await response.text();
          console.error('[Push Label] Chatwoot delete error:', response.status, errorText);
          result = { success: false, error: `Chatwoot API error: ${response.status}` };
        } else {
          console.log('[Push Label] Label deleted successfully');
          result = { success: true };
        }
      }
    } else {
      result = { success: false, error: `Unknown action: ${action}` };
    }

    console.log('[Push Label] Result:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Push Label] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
