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

interface ChatwootLabel {
  id: number;
  title: string;
  description?: string;
  color: string;
  show_on_sidebar: boolean;
}

interface SyncResult {
  success: boolean;
  contacts_created: number;
  contacts_updated: number;
  contacts_deleted: number;
  lead_tags_applied: number;
  lead_tags_removed: number;
  stages_created: number;
  errors: string[];
}

// Helper to generate slug from label name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')  // Replace spaces with underscores
    .replace(/[^a-z0-9_]/g, '')  // Remove special chars except underscores
    .substring(0, 50);  // Limit length
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

    const baseUrl = chatwoot_base_url.replace(/\/$/, '');

    // Fetch all labels from Chatwoot for auto-creating stages
    console.log('[Sync Contacts] Fetching labels from Chatwoot...');
    const labelsUrl = `${baseUrl}/api/v1/accounts/${chatwoot_account_id}/labels`;
    const labelsResponse = await fetch(labelsUrl, {
      headers: {
        'api_access_token': chatwoot_api_key,
        'Content-Type': 'application/json',
      },
    });

    const chatwootLabelsMap = new Map<string, ChatwootLabel>();
    if (labelsResponse.ok) {
      const labelsData = await labelsResponse.json();
      const labels: ChatwootLabel[] = labelsData.payload || labelsData || [];
      for (const label of labels) {
        chatwootLabelsMap.set(label.title.toLowerCase(), label);
      }
      console.log('[Sync Contacts] Loaded', chatwootLabelsMap.size, 'labels from Chatwoot');
    } else {
      console.warn('[Sync Contacts] Could not fetch labels from Chatwoot');
    }

    // Get or create default funnel for this account
    let { data: defaultFunnel } = await supabaseAdmin
      .from('funnels')
      .select('id')
      .eq('account_id', account_id)
      .eq('is_default', true)
      .maybeSingle();

    if (!defaultFunnel) {
      // Create default funnel if it doesn't exist
      const { data: newFunnel, error: funnelError } = await supabaseAdmin
        .from('funnels')
        .insert({
          account_id,
          name: 'Funil Principal',
          slug: 'funil_principal',
          is_default: true,
        })
        .select('id')
        .single();

      if (funnelError) {
        console.error('[Sync Contacts] Failed to create default funnel:', funnelError);
        return new Response(
          JSON.stringify({ error: 'Failed to create default funnel' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      defaultFunnel = newFunnel;
    }

    // Get existing tags for this account (to map labels to tag_ids)
    const { data: existingTags } = await supabaseAdmin
      .from('tags')
      .select('id, name, slug, chatwoot_label_id, ordem')
      .eq('account_id', account_id)
      .eq('type', 'stage')
      .eq('ativo', true);

    // Create multiple lookup maps for flexible matching
    const tagsBySlug = new Map(existingTags?.map(t => [t.slug.toLowerCase(), t]) || []);
    const tagsByName = new Map(existingTags?.map(t => [t.name.toLowerCase(), t]) || []);
    const tagsByNormalizedName = new Map(existingTags?.map(t => [
      t.name.toLowerCase().replace(/[^a-z0-9]/g, ''), 
      t
    ]) || []);
    
    // Build additional lookup maps with hyphen/underscore normalization
    const tagsBySlugUnderscore = new Map(existingTags?.map(t => [t.slug.toLowerCase().replace(/-/g, '_'), t]) || []);
    const tagsBySlugHyphen = new Map(existingTags?.map(t => [t.slug.toLowerCase().replace(/_/g, '-'), t]) || []);
    const tagsByNameUnderscore = new Map(existingTags?.map(t => [t.name.toLowerCase().replace(/\s+/g, '_'), t]) || []);

    // Helper to find tag by label (tries multiple matching strategies including hyphen/underscore equivalence)
    const findTagByLabel = (labelSlug: string) => {
      const normalizedLabel = labelSlug.toLowerCase();
      const strippedLabel = normalizedLabel.replace(/[^a-z0-9]/g, '');
      const withUnderscore = normalizedLabel.replace(/-/g, '_');
      const withHyphen = normalizedLabel.replace(/_/g, '-');
      
      if (tagsBySlug.has(normalizedLabel)) return tagsBySlug.get(normalizedLabel);
      if (tagsBySlug.has(withHyphen)) return tagsBySlug.get(withHyphen);
      if (tagsBySlugUnderscore.has(withUnderscore)) return tagsBySlugUnderscore.get(withUnderscore);
      if (tagsBySlugHyphen.has(withHyphen)) return tagsBySlugHyphen.get(withHyphen);
      if (tagsByName.has(normalizedLabel)) return tagsByName.get(normalizedLabel);
      if (tagsByNameUnderscore.has(withUnderscore)) return tagsByNameUnderscore.get(withUnderscore);
      if (tagsByNormalizedName.has(strippedLabel)) return tagsByNormalizedName.get(strippedLabel);
      if (tagsBySlug.has(strippedLabel)) return tagsBySlug.get(strippedLabel);
      
      return undefined;
    };

    console.log('[Sync Contacts] Found', existingTags?.length || 0, 'existing stage tags');

    // Get max order for new stages
    let maxOrder = existingTags?.reduce((max, t) => Math.max(max, t.ordem || 0), 0) || 0;

    // Fetch all conversations from Chatwoot (paginated)
    const allConversations: ChatwootConversation[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const conversationsUrl = `${baseUrl}/api/v1/accounts/${chatwoot_account_id}/conversations?status=all&page=${page}`;
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
        if (page > 50) hasMore = false;
      }
    }

    console.log('[Sync Contacts] Total conversations fetched:', allConversations.length);

    const result: SyncResult = {
      success: true,
      contacts_created: 0,
      contacts_updated: 0,
      contacts_deleted: 0,
      lead_tags_applied: 0,
      lead_tags_removed: 0,
      stages_created: 0,
      errors: [],
    };

    // Collect all chatwoot_contact_ids from conversations for reconciliation
    const activeChatwootContactIds = new Set<number>(
      allConversations.map(conv => conv.meta?.sender?.id).filter(Boolean)
    );
    console.log('[Sync Contacts] Active Chatwoot contact IDs:', activeChatwootContactIds.size);

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

        // Process labels for this conversation
        const chatwootLabels = conv.labels || [];
        console.log('[Sync Contacts] Processing labels for contact', contactId, ':', chatwootLabels);

        // Find stage labels and auto-create if needed
        const stageLabelsWithTags: { label: string; tag: any }[] = [];

        for (const labelSlug of chatwootLabels) {
          let tag = findTagByLabel(labelSlug);

          // If tag doesn't exist, create it as a stage
          if (!tag) {
            console.log('[Sync Contacts] Label not found as stage, creating:', labelSlug);
            
            // Get label details from Chatwoot (color, etc.)
            const chatwootLabel = chatwootLabelsMap.get(labelSlug.toLowerCase());
            const labelColor = chatwootLabel?.color || '#6B7280';
            const labelName = chatwootLabel?.title || labelSlug;

            // Create new stage tag
            maxOrder++;
            const newSlug = generateSlug(labelName);

            const { data: newTag, error: tagError } = await supabaseAdmin
              .from('tags')
              .insert({
                account_id,
                funnel_id: defaultFunnel!.id,
                name: labelName,
                slug: newSlug,
                color: labelColor.startsWith('#') ? labelColor : `#${labelColor}`,
                type: 'stage',
                ativo: true,
                ordem: maxOrder,
                chatwoot_label_id: chatwootLabel?.id || null,
              })
              .select('id, name, slug, chatwoot_label_id, ordem')
              .single();

            if (tagError || !newTag) {
              console.error('[Sync Contacts] Failed to create stage tag:', tagError);
              result.errors.push(`Failed to create stage for label ${labelSlug}: ${tagError?.message}`);
              continue;
            }

            tag = newTag;
            result.stages_created++;

            // Update lookup maps with new tag
            tagsBySlug.set(newSlug.toLowerCase(), tag);
            tagsByName.set(labelName.toLowerCase(), tag);
            tagsByNormalizedName.set(labelName.toLowerCase().replace(/[^a-z0-9]/g, ''), tag);

            console.log('[Sync Contacts] Created new stage tag:', tag.name, 'with ID:', tag.id);
          }

          stageLabelsWithTags.push({ label: labelSlug, tag });
        }

        // Apply "last label wins" logic - only keep the last stage label
        // Chatwoot arrays typically have newest labels at the end
        const lastStageTag = stageLabelsWithTags.length > 0 
          ? stageLabelsWithTags[stageLabelsWithTags.length - 1].tag 
          : null;

        // Get current lead_tags for this contact (all stage tags we manage)
        const allStageTagIds = Array.from(tagsBySlug.values()).map(t => t.id);
        
        if (allStageTagIds.length > 0) {
          const { data: currentLeadTags } = await supabaseAdmin
            .from('lead_tags')
            .select('id, tag_id')
            .eq('contact_id', contactId)
            .in('tag_id', allStageTagIds);

          const currentTagIds = new Set(currentLeadTags?.map(lt => lt.tag_id) || []);

          // Remove all existing stage tags that are not the target tag
          for (const leadTag of (currentLeadTags || [])) {
            if (!lastStageTag || leadTag.tag_id !== lastStageTag.id) {
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

          // Apply the last stage tag if not already applied
          if (lastStageTag && !currentTagIds.has(lastStageTag.id)) {
            const { error: tagError } = await supabaseAdmin
              .from('lead_tags')
              .insert({
                contact_id: contactId,
                tag_id: lastStageTag.id,
                source: 'chatwoot_sync',
              });

            if (!tagError) {
              result.lead_tags_applied++;
              console.log('[Sync Contacts] Applied stage tag:', lastStageTag.name, 'to contact:', contactId);
            }
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error processing conversation ${conv.id}: ${errorMsg}`);
      }
    }

    // ============== RECONCILIATION: Delete orphaned contacts ==============
    // Step 1: Delete contacts WITH chatwoot_contact_id that are no longer in Chatwoot
    console.log('[Sync Contacts] Starting reconciliation - checking for orphaned contacts...');
    
    const { data: dbContactsWithChatwoot } = await supabaseAdmin
      .from('contacts')
      .select('id, chatwoot_contact_id')
      .eq('account_id', account_id)
      .not('chatwoot_contact_id', 'is', null);
    
    const orphanedContacts = (dbContactsWithChatwoot || []).filter(
      contact => !activeChatwootContactIds.has(contact.chatwoot_contact_id as number)
    );
    
    console.log('[Sync Contacts] Found', orphanedContacts.length, 'orphaned contacts (with chatwoot_contact_id) to delete');
    
    for (const orphan of orphanedContacts) {
      try {
        // Delete lead_tags first (foreign key constraint)
        const { error: leadTagsError } = await supabaseAdmin
          .from('lead_tags')
          .delete()
          .eq('contact_id', orphan.id);
        
        if (leadTagsError) {
          result.errors.push(`Failed to delete lead_tags for orphan ${orphan.id}: ${leadTagsError.message}`);
          continue;
        }
        
        // Delete the contact
        const { error: contactError } = await supabaseAdmin
          .from('contacts')
          .delete()
          .eq('id', orphan.id);
        
        if (contactError) {
          result.errors.push(`Failed to delete orphan contact ${orphan.id}: ${contactError.message}`);
          continue;
        }
        
        result.contacts_deleted++;
        console.log('[Sync Contacts] Deleted orphaned contact:', orphan.id);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error deleting orphan ${orphan.id}: ${errorMsg}`);
      }
    }

    // Step 2: "Strict mirror" - Check contacts WITHOUT chatwoot_contact_id
    // Search Chatwoot by phone/email, if not found -> delete from Kanban
    // IMPORTANT: Skip contacts created less than 5 minutes ago (grace period for Chatwoot integration)
    console.log('[Sync Contacts] Starting strict mirror - checking unlinked contacts...');
    
    // Calculate cutoff time (5 minutes ago)
    const gracePeriodMinutes = 5;
    const cutoffTime = new Date(Date.now() - gracePeriodMinutes * 60 * 1000).toISOString();
    
    const { data: unlinkedContacts } = await supabaseAdmin
      .from('contacts')
      .select('id, nome, telefone, email, created_at')
      .eq('account_id', account_id)
      .is('chatwoot_contact_id', null)
      .lt('created_at', cutoffTime); // Only process contacts older than grace period
    
    console.log('[Sync Contacts] Found', unlinkedContacts?.length || 0, 'unlinked contacts to verify in Chatwoot (excluding contacts < 5min old)');
    
    // Helper function to normalize phone for search
    const normalizePhoneForSearch = (phone: string | null): string | null => {
      if (!phone) return null;
      // Remove all non-numeric characters except +
      let normalized = phone.replace(/[^\d+]/g, '');
      // Ensure starts with +
      if (!normalized.startsWith('+')) {
        normalized = '+' + normalized;
      }
      return normalized;
    };

    for (const contact of (unlinkedContacts || [])) {
      try {
        let foundInChatwoot = false;
        
        // Try to find by phone first
        const normalizedPhone = normalizePhoneForSearch(contact.telefone);
        if (normalizedPhone) {
          const searchUrl = `${baseUrl}/api/v1/accounts/${chatwoot_account_id}/contacts/search?q=${encodeURIComponent(normalizedPhone)}`;
          const searchResponse = await fetch(searchUrl, {
            headers: {
              'api_access_token': chatwoot_api_key,
              'Content-Type': 'application/json',
            },
          });
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const contacts = searchData.payload || [];
            if (contacts.length > 0) {
              foundInChatwoot = true;
              // Link the contact to Chatwoot
              const chatwootContact = contacts[0];
              console.log('[Sync Contacts] Found unlinked contact in Chatwoot by phone:', contact.nome, '-> Chatwoot ID:', chatwootContact.id);
              
              await supabaseAdmin
                .from('contacts')
                .update({ chatwoot_contact_id: chatwootContact.id })
                .eq('id', contact.id);
            }
          }
        }
        
        // If not found by phone, try email
        if (!foundInChatwoot && contact.email) {
          const searchUrl = `${baseUrl}/api/v1/accounts/${chatwoot_account_id}/contacts/search?q=${encodeURIComponent(contact.email)}`;
          const searchResponse = await fetch(searchUrl, {
            headers: {
              'api_access_token': chatwoot_api_key,
              'Content-Type': 'application/json',
            },
          });
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const contacts = searchData.payload || [];
            if (contacts.length > 0) {
              foundInChatwoot = true;
              // Link the contact to Chatwoot
              const chatwootContact = contacts[0];
              console.log('[Sync Contacts] Found unlinked contact in Chatwoot by email:', contact.nome, '-> Chatwoot ID:', chatwootContact.id);
              
              await supabaseAdmin
                .from('contacts')
                .update({ chatwoot_contact_id: chatwootContact.id })
                .eq('id', contact.id);
            }
          }
        }
        
        // If not found in Chatwoot at all -> delete from Kanban (strict mirror)
        if (!foundInChatwoot) {
          console.log('[Sync Contacts] Unlinked contact not found in Chatwoot, deleting:', contact.nome, contact.id);
          
          // Delete lead_tags first
          await supabaseAdmin
            .from('lead_tags')
            .delete()
            .eq('contact_id', contact.id);
          
          // Delete the contact
          const { error: deleteError } = await supabaseAdmin
            .from('contacts')
            .delete()
            .eq('id', contact.id);
          
          if (!deleteError) {
            result.contacts_deleted++;
            console.log('[Sync Contacts] Deleted unlinked contact:', contact.id);
          } else {
            result.errors.push(`Failed to delete unlinked contact ${contact.id}: ${deleteError.message}`);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        result.errors.push(`Error checking unlinked contact ${contact.id}: ${errorMsg}`);
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
