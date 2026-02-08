import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

interface PushResult {
  pushed: number;
  linked: number;
  errors: string[];
  details: Array<{ name: string; action: "pushed" | "linked" | "error"; reason?: string }>;
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

    const { account_id, reset_ids = false } = await req.json();

    if (!account_id) {
      return new Response(
        JSON.stringify({ error: "account_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Push Labels] Account: ${account_id}, reset_ids: ${reset_ids}`);

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

    // If reset_ids, clear all chatwoot_label_id for this account's tags
    if (reset_ids) {
      console.log("[Push Labels] Resetting all chatwoot_label_id to null");
      await supabase
        .from("tags")
        .update({ chatwoot_label_id: null })
        .eq("account_id", account_id)
        .eq("type", "stage");
    }

    // Fetch all active stage tags for this account
    const { data: tags, error: tagsError } = await supabase
      .from("tags")
      .select("*")
      .eq("account_id", account_id)
      .eq("type", "stage")
      .eq("ativo", true)
      .order("ordem", { ascending: true });

    if (tagsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch tags" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tags || tags.length === 0) {
      return new Response(
        JSON.stringify({ success: true, pushed: 0, linked: 0, errors: [], details: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch existing labels from Chatwoot
    const labelsUrl = `${chatwoot_base_url}/api/v1/accounts/${chatwoot_account_id}/labels`;
    const labelsResponse = await fetch(labelsUrl, {
      headers: {
        api_access_token: chatwoot_api_key,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    let existingLabels: Array<{ id: number; title: string; color: string }> = [];
    if (labelsResponse.ok) {
      const labelsData = await labelsResponse.json();
      existingLabels = labelsData.payload || labelsData || [];
    }

    // Build a map of existing labels by title (slug)
    const existingByTitle = new Map(existingLabels.map((l) => [l.title.toLowerCase(), l]));

    console.log(`[Push Labels] ${tags.length} tags to push, ${existingLabels.length} existing labels in Chatwoot`);

    const result: PushResult = { pushed: 0, linked: 0, errors: [], details: [] };

    for (const tag of tags) {
      // Skip tags that already have a valid chatwoot_label_id
      if (tag.chatwoot_label_id) {
        const stillExists = existingLabels.some((l) => l.id === tag.chatwoot_label_id);
        if (stillExists) {
          result.linked++;
          result.details.push({ name: tag.name, action: "linked", reason: "Already linked" });
          continue;
        }
        // ID is stale, clear it
        await supabase.from("tags").update({ chatwoot_label_id: null }).eq("id", tag.id);
      }

      // Check if label already exists in Chatwoot by slug
      const existing = existingByTitle.get(tag.slug.toLowerCase());

      if (existing) {
        // Link existing label
        await supabase.from("tags").update({ chatwoot_label_id: existing.id }).eq("id", tag.id);
        result.linked++;
        result.details.push({ name: tag.name, action: "linked", reason: "Found by slug" });
        continue;
      }

      // Create label in Chatwoot
      try {
        const createResponse = await fetch(labelsUrl, {
          method: "POST",
          headers: {
            api_access_token: chatwoot_api_key,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            title: tag.slug,
            description: tag.name,
            color: tag.color || "#1976D2",
            show_on_sidebar: true,
          }),
        });

        if (createResponse.ok) {
          const created = await createResponse.json();
          const newId = created.id || created.payload?.id;

          if (newId) {
            await supabase.from("tags").update({ chatwoot_label_id: newId }).eq("id", tag.id);
            // Add to map to avoid duplicates in same batch
            existingByTitle.set(tag.slug.toLowerCase(), { id: newId, title: tag.slug, color: tag.color || "#1976D2" });
          }

          result.pushed++;
          result.details.push({ name: tag.name, action: "pushed" });
        } else {
          const errText = await createResponse.text();
          console.error(`[Push Labels] Error creating label "${tag.slug}": ${createResponse.status} - ${errText}`);
          result.errors.push(`${tag.name}: ${createResponse.status}`);
          result.details.push({ name: tag.name, action: "error", reason: errText });
        }
      } catch (err) {
        console.error(`[Push Labels] Error creating label "${tag.slug}":`, err);
        result.errors.push(`${tag.name}: ${err.message}`);
        result.details.push({ name: tag.name, action: "error", reason: err.message });
      }
    }

    console.log(`[Push Labels] Result: ${result.pushed} pushed, ${result.linked} linked, ${result.errors.length} errors`);

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Push Labels] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
