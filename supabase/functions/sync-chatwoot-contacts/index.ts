import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChatwootConversation {
  id: number;
  status: string;
  labels: string[];
  meta: {
    sender: {
      id: number;
      name: string;
      email?: string;
      phone_number?: string;
      identifier?: string;
    };
    channel?: string;
  };
  inbox_id: number;
  created_at: number;
  updated_at: number;
}

interface SyncResult {
  success: boolean;
  contacts_created: number;
  contacts_updated: number;
  lead_tags_applied: number;
  lead_tags_removed: number;
  errors: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { account_id } = await req.json();

    if (!account_id) {
      return new Response(
        JSON.stringify({ error: 'account_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Sync Contacts] Starting sync for account:', account_id);

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
      console.error('[Sync Contacts] Account not found:', accountError);
      return new Response(
        JSON.stringify({ error: 'Account not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { chatwoot_base_url, chatwoot_account_id, chatwoot_api_key } = accountData;

    if (!chatwoot_base_url || !chatwoot_account_id || !chatwoot_api_key) {
      return new Response(
        JSON.stringify({ error: 'Chatwoot not configured for this account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get existing tags for this account (to map labels to tag_ids)
    const { data: existingTags } = await supabaseAdmin
      .from('tags')
      .select('id, name, slug, chatwoot_label_id')
      .eq('account_id', account_id)
      .eq('type', 'stage')
      .eq('ativo', true);

    // Create multiple lookup maps for flexible matching
    const tagsBySlug = new Map(existingTags?.map(t => [t.slug.toLowerCase(), t]) || []);
    const tagsByName = new Map(existingTags?.map(t => [t.name.toLowerCase(), t]) || []);
    // Also map by normalized name (removing special chars like underscores)
    const tagsByNormalizedName = new Map(existingTags?.map(t => [
      t.name.toLowerCase().replace(/[^a-z0-9]/g, ''), 
      t
    ]) || []);
    
    // Helper to find tag by label (tries multiple matching strategies)
    const findTagByLabel = (labelSlug: string) => {
      const normalizedLabel = labelSlug.toLowerCase();
      const strippedLabel = normalizedLabel.replace(/[^a-z0-9]/g, '');
      
      // Try exact slug match first
      if (tagsBySlug.has(normalizedLabel)) return tagsBySlug.get(normalizedLabel);
      // Try exact name match
      if (tagsByName.has(normalizedLabel)) return tagsByName.get(normalizedLabel);
      // Try normalized name match (strips underscores, hyphens, etc.)
      if (tagsByNormalizedName.has(strippedLabel)) return tagsByNormalizedName.get(strippedLabel);
      // Try slug match with stripped version
      if (tagsBySlug.has(strippedLabel)) return tagsBySlug.get(strippedLabel);
      
      return undefined;
    };
    console.log('[Sync Contacts] Found', existingTags?.length || 0, 'existing stage tags');

    // Fetch all conversations from Chatwoot (paginated)
    const allConversations: ChatwootConversation[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const conversationsUrl = `${chatwoot_base_url}/api/v1/accounts/${chatwoot_account_id}/conversations?status=all&page=${page}`;
      console.log('[Sync Contacts] Fetching page', page, 'from:', conversationsUrl);

      const response = await fetch(conversationsUrl, {
        headers: {
          'api_access_token': chatwoot_api_key,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Sync Contacts] Chatwoot API error:', response.status, errorText);
        throw new Error(`Chatwoot API error: ${response.status}`);
      }

      const data = await response.json();
      const conversations = data.data?.payload || data.payload || [];
      
      if (conversations.length === 0) {
        hasMore = false;
      } else {
        allConversations.push(...conversations);
        page++;
        // Safety limit
        if (page > 50) hasMore = false;
      }
    }

    console.log('[Sync Contacts] Total conversations fetched:', allConversations.length);

    const result: SyncResult = {
      success: true,
      contacts_created: 0,
      contacts_updated: 0,
      lead_tags_applied: 0,
      lead_tags_removed: 0,
      errors: [],
    };

    // Process each conversation
    for (const conv of allConversations) {
      try {
        const sender = conv.meta?.sender;
        if (!sender) continue;

        // Check if contact already exists by chatwoot_contact_id
        const { data: existingContact } = await supabaseAdmin
          .from('contacts')
          .select('id')
          .eq('account_id', account_id)
          .eq('chatwoot_contact_id', sender.id)
          .maybeSingle();

        let contactId: string;

        if (existingContact) {
          // Update existing contact
          const { error: updateError } = await supabaseAdmin
            .from('contacts')
            .update({
              nome: sender.name || null,
              email: sender.email || null,
              telefone: sender.phone_number || null,
              chatwoot_conversation_id: conv.id,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingContact.id);

          if (updateError) {
            result.errors.push(`Failed to update contact ${sender.id}: ${updateError.message}`);
            continue;
          }

          contactId = existingContact.id;
          result.contacts_updated++;
        } else {
          // Determine origin based on inbox/channel
          let origem: 'whatsapp' | 'instagram' | 'site' | 'outro' = 'outro';
          const channel = conv.meta?.channel?.toLowerCase() || '';
          if (channel.includes('whatsapp') || channel.includes('twilio')) {
            origem = 'whatsapp';
          } else if (channel.includes('instagram')) {
            origem = 'instagram';
          } else if (channel.includes('web') || channel.includes('website')) {
            origem = 'site';
          }

          // Create new contact
          const { data: newContact, error: createError } = await supabaseAdmin
            .from('contacts')
            .insert({
              account_id,
              nome: sender.name || null,
              email: sender.email || null,
              telefone: sender.phone_number || null,
              origem,
              chatwoot_contact_id: sender.id,
              chatwoot_conversation_id: conv.id,
            })
            .select('id')
            .single();

          if (createError || !newContact) {
            result.errors.push(`Failed to create contact for ${sender.id}: ${createError?.message}`);
            continue;
          }

          contactId = newContact.id;
          result.contacts_created++;
        }

        // Get current lead_tags for this contact (only stage tags we manage)
        const stageTagIds = existingTags?.map(t => t.id) || [];
        if (stageTagIds.length === 0) continue;

        const { data: currentLeadTags } = await supabaseAdmin
          .from('lead_tags')
          .select('id, tag_id')
          .eq('contact_id', contactId)
          .in('tag_id', stageTagIds);

        const currentTagIds = new Set(currentLeadTags?.map(lt => lt.tag_id) || []);
        
        // Determine which tags should be applied based on Chatwoot labels
        const chatwootLabels = conv.labels || [];
        const expectedTagIds = new Set<string>();
        
        console.log('[Sync Contacts] Processing labels for contact', contactId, ':', chatwootLabels);
        
        for (const labelSlug of chatwootLabels) {
          const tag = findTagByLabel(labelSlug);
          if (tag) {
            expectedTagIds.add(tag.id);
            console.log('[Sync Contacts] Matched label', labelSlug, 'to tag', tag.name);
          } else {
            console.log('[Sync Contacts] No match for label:', labelSlug);
          }
        }

        // Remove tags that are no longer in Chatwoot labels
        for (const leadTag of (currentLeadTags || [])) {
          if (!expectedTagIds.has(leadTag.tag_id)) {
            const { error: deleteError } = await supabaseAdmin
              .from('lead_tags')
              .delete()
              .eq('id', leadTag.id);

            if (!deleteError) {
              result.lead_tags_removed++;
              console.log('[Sync Contacts] Removed lead_tag for contact:', contactId, 'tag:', leadTag.tag_id);
            }
          }
        }

        // Add tags that exist in Chatwoot but not in our DB
        for (const tagId of expectedTagIds) {
          if (!currentTagIds.has(tagId)) {
            const { error: tagError } = await supabaseAdmin
              .from('lead_tags')
              .insert({
                contact_id: contactId,
                tag_id: tagId,
                source: 'chatwoot_sync',
              });

            if (!tagError) {
              result.lead_tags_applied++;
            }
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error processing conversation ${conv.id}: ${errorMsg}`);
      }
    }

    console.log('[Sync Contacts] Result:', JSON.stringify(result));

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Sync Contacts] Error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
