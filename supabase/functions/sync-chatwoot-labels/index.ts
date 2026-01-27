import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ChatwootLabel {
  id: number;
  title: string;
  description: string | null;
  color: string;
  show_on_sidebar: boolean;
}

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  labels: Array<{
    name: string;
    action: 'imported' | 'updated' | 'skipped';
    reason?: string;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { account_id, action = 'import' } = await req.json();

    if (!account_id) {
      return new Response(
        JSON.stringify({ error: "account_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Chatwoot Labels] Action: ${action}, Account: ${account_id}`);

    // Get account Chatwoot config
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("chatwoot_base_url, chatwoot_account_id, chatwoot_api_key")
      .eq("id", account_id)
      .single();

    if (accountError || !account) {
      return new Response(
        JSON.stringify({ error: "Account not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { chatwoot_base_url, chatwoot_account_id, chatwoot_api_key } = account;

    if (!chatwoot_base_url || !chatwoot_account_id || !chatwoot_api_key) {
      return new Response(
        JSON.stringify({ error: "Account does not have Chatwoot configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch labels from Chatwoot
    const labelsUrl = `${chatwoot_base_url}/api/v1/accounts/${chatwoot_account_id}/labels`;
    console.log(`[Chatwoot Labels] Fetching from: ${labelsUrl}`);

    const labelsResponse = await fetch(labelsUrl, {
      headers: {
        "api_access_token": chatwoot_api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    });

    if (!labelsResponse.ok) {
      const errorText = await labelsResponse.text();
      console.error(`[Chatwoot Labels] Error fetching labels: ${labelsResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Failed to fetch Chatwoot labels: ${labelsResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const labelsData = await labelsResponse.json();
    const labels: ChatwootLabel[] = labelsData.payload || labelsData || [];

    console.log(`[Chatwoot Labels] Found ${labels.length} labels`);

    if (action === 'list') {
      // Just return the labels without importing
      return new Response(
        JSON.stringify({
          success: true,
          labels: labels.map(l => ({
            id: l.id,
            title: l.title,
            color: l.color,
            description: l.description,
          })),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get default funnel for account
    const { data: funnel, error: funnelError } = await supabase
      .from("funnels")
      .select("id")
      .eq("account_id", account_id)
      .eq("is_default", true)
      .single();

    let funnelId = funnel?.id;

    // Create default funnel if doesn't exist
    if (!funnelId) {
      const { data: newFunnel, error: createFunnelError } = await supabase
        .from("funnels")
        .insert({
          account_id,
          name: "Atendimento",
          slug: "atendimento",
          is_default: true,
        })
        .select("id")
        .single();

      if (createFunnelError) {
        console.error("[Chatwoot Labels] Error creating funnel:", createFunnelError);
        return new Response(
          JSON.stringify({ error: "Failed to create default funnel" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      funnelId = newFunnel.id;
    }

    // Get existing tags for this account
    const { data: existingTags } = await supabase
      .from("tags")
      .select("*")
      .eq("account_id", account_id);

    const existingByLabelId = new Map((existingTags || []).map(t => [t.chatwoot_label_id, t]));
    const existingBySlug = new Map((existingTags || []).map(t => [t.slug, t]));

    const result: ImportResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      labels: [],
    };

    // Process each label
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const slug = label.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      // Check if already linked by chatwoot_label_id
      const existingByLabel = existingByLabelId.get(label.id);
      if (existingByLabel) {
        // Update if name or color changed
        if (existingByLabel.name !== label.title || existingByLabel.color !== label.color) {
          const { error: updateError } = await supabase
            .from("tags")
            .update({
              name: label.title,
              color: label.color,
              slug,
            })
            .eq("id", existingByLabel.id);

          if (!updateError) {
            result.updated++;
            result.labels.push({ name: label.title, action: 'updated' });
          }
        } else {
          result.skipped++;
          result.labels.push({ name: label.title, action: 'skipped', reason: 'Already synced' });
        }
        continue;
      }

      // Check if exists by slug (created manually with same name)
      const existingByName = existingBySlug.get(slug);
      if (existingByName) {
        // Link existing tag to Chatwoot label
        const { error: linkError } = await supabase
          .from("tags")
          .update({
            chatwoot_label_id: label.id,
            color: label.color,
          })
          .eq("id", existingByName.id);

        if (!linkError) {
          result.updated++;
          result.labels.push({ name: label.title, action: 'updated', reason: 'Linked to existing tag' });
        }
        continue;
      }

      // Create new tag
      const { error: insertError } = await supabase
        .from("tags")
        .insert({
          account_id,
          funnel_id: funnelId,
          name: label.title,
          slug,
          type: 'stage',
          color: label.color,
          ordem: i,
          chatwoot_label_id: label.id,
          ativo: true,
        });

      if (!insertError) {
        result.imported++;
        result.labels.push({ name: label.title, action: 'imported' });
      } else {
        console.error(`[Chatwoot Labels] Error creating tag ${label.title}:`, insertError);
        result.skipped++;
        result.labels.push({ name: label.title, action: 'skipped', reason: insertError.message });
      }
    }

    console.log(`[Chatwoot Labels] Result: ${result.imported} imported, ${result.updated} updated, ${result.skipped} skipped`);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[Chatwoot Labels] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
