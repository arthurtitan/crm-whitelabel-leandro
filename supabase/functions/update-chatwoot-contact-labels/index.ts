import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateLabelsRequest {
  account_id: string;
  contact_id: string;
  new_stage_tag_id: string;
  old_stage_tag_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: UpdateLabelsRequest = await req.json();
    const { account_id, contact_id, new_stage_tag_id, old_stage_tag_id } = body;

    if (!account_id || !contact_id || !new_stage_tag_id) {
      return new Response(
        JSON.stringify({ error: 'account_id, contact_id, and new_stage_tag_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Update Contact Labels] Starting for contact:', contact_id, 'new stage:', new_stage_tag_id);

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
      console.error('[Update Contact Labels] Account not found:', accountError);
      return new Response(
        JSON.stringify({ error: 'Account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { chatwoot_base_url, chatwoot_account_id, chatwoot_api_key } = accountData;

    if (!chatwoot_base_url || !chatwoot_account_id || !chatwoot_api_key) {
      console.log('[Update Contact Labels] Chatwoot not configured, skipping');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'Chatwoot not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get contact's Chatwoot conversation ID
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('contacts')
      .select('chatwoot_conversation_id, chatwoot_contact_id')
      .eq('id', contact_id)
      .single();

    if (contactError || !contact) {
      console.error('[Update Contact Labels] Contact not found:', contactError);
      return new Response(
        JSON.stringify({ error: 'Contact not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!contact.chatwoot_conversation_id) {
      console.log('[Update Contact Labels] No Chatwoot conversation linked');
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'No Chatwoot conversation' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the new tag name (to use as label)
    const { data: newTag } = await supabaseAdmin
      .from('tags')
      .select('name, slug')
      .eq('id', new_stage_tag_id)
      .single();

    if (!newTag) {
      return new Response(
        JSON.stringify({ error: 'New tag not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the old tag name if provided
    let oldTagName: string | null = null;
    if (old_stage_tag_id) {
      const { data: oldTag } = await supabaseAdmin
        .from('tags')
        .select('name, slug')
        .eq('id', old_stage_tag_id)
        .single();
      oldTagName = oldTag?.name || null;
    }

    const conversationId = contact.chatwoot_conversation_id;

    // First, get the current labels on the conversation
    const getLabelsUrl = `${chatwoot_base_url}/api/v1/accounts/${chatwoot_account_id}/conversations/${conversationId}/labels`;
    console.log('[Update Contact Labels] Fetching current labels from:', getLabelsUrl);

    const labelsResponse = await fetch(getLabelsUrl, {
      headers: {
        'api_access_token': chatwoot_api_key,
        'Content-Type': 'application/json',
      },
    });

    if (!labelsResponse.ok) {
      const errorText = await labelsResponse.text();
      console.error('[Update Contact Labels] Failed to fetch labels:', labelsResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Failed to fetch labels: ${labelsResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const labelsData = await labelsResponse.json();
    let currentLabels: string[] = labelsData.payload || [];
    console.log('[Update Contact Labels] Current labels:', currentLabels);

    // Helper: normalize label for comparison (treat hyphens and underscores as equivalent)
    const normalizeLabel = (s: string) => s.toLowerCase().replace(/[-_\s]+/g, '_').replace(/[^a-z0-9_]/g, '');

    // Get all stage tags for this account to know which labels to remove
    const { data: allStageTags } = await supabaseAdmin
      .from('tags')
      .select('name, slug')
      .eq('account_id', account_id)
      .eq('type', 'stage')
      .eq('ativo', true);

    // Build a set of normalized stage identifiers for matching
    const normalizedStageSet = new Set<string>();
    for (const t of (allStageTags || [])) {
      normalizedStageSet.add(normalizeLabel(t.name));
      normalizedStageSet.add(normalizeLabel(t.slug));
    }
    console.log('[Update Contact Labels] Normalized stage set:', Array.from(normalizedStageSet));

    // Remove all stage-related labels from current labels
    const filteredLabels = currentLabels.filter(label => {
      const normalized = normalizeLabel(label);
      const isStageLabel = normalizedStageSet.has(normalized);
      if (isStageLabel) {
        console.log('[Update Contact Labels] Removing stage label:', label, '(normalized:', normalized, ')');
      }
      return !isStageLabel;
    });

    // Add the new stage label using slug with underscores (Chatwoot format)
    const newLabelName = newTag.slug.toLowerCase().replace(/-/g, '_');
    console.log('[Update Contact Labels] New label from slug:', newTag.slug, '->', newLabelName);
    filteredLabels.push(newLabelName);

    console.log('[Update Contact Labels] New labels to set:', filteredLabels);

    // Update labels on the conversation
    const updateLabelsUrl = `${chatwoot_base_url}/api/v1/accounts/${chatwoot_account_id}/conversations/${conversationId}/labels`;
    
    const updateResponse = await fetch(updateLabelsUrl, {
      method: 'POST',
      headers: {
        'api_access_token': chatwoot_api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        labels: filteredLabels,
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('[Update Contact Labels] Failed to update labels:', updateResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Failed to update labels: ${updateResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updateResult = await updateResponse.json();
    console.log('[Update Contact Labels] Labels updated successfully:', updateResult);

    return new Response(
      JSON.stringify({ 
        success: true, 
        old_label: oldTagName,
        new_label: newLabelName,
        all_labels: filteredLabels,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Update Contact Labels] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
