import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FollowupPayload {
  account_id: string;
  chatwoot_conversation_id: number;
  action: "increment" | "reset" | "set";
  value?: number;
  move_to_stage_slug?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body: FollowupPayload = await req.json();
    const { account_id, chatwoot_conversation_id, action, value, move_to_stage_slug } = body;

    if (!account_id || !chatwoot_conversation_id || !action) {
      return new Response(
        JSON.stringify({ error: "account_id, chatwoot_conversation_id and action are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["increment", "reset", "set"].includes(action)) {
      return new Response(
        JSON.stringify({ error: "action must be increment, reset or set" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find the contact
    const { data: contact, error: findError } = await supabase
      .from("contacts")
      .select("id, followup_count")
      .eq("account_id", account_id)
      .eq("chatwoot_conversation_id", chatwoot_conversation_id)
      .maybeSingle();

    if (findError) {
      return new Response(
        JSON.stringify({ error: "Database error", details: findError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!contact) {
      return new Response(
        JSON.stringify({ error: "Contact not found for this conversation" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate new followup values
    let newCount: number;
    let newLastAt: string | null;

    switch (action) {
      case "increment":
        newCount = (contact.followup_count || 0) + 1;
        newLastAt = new Date().toISOString();
        break;
      case "reset":
        newCount = 0;
        newLastAt = null;
        break;
      case "set":
        newCount = value ?? 0;
        newLastAt = newCount > 0 ? new Date().toISOString() : null;
        break;
    }

    // Update the contact
    const { error: updateError } = await supabase
      .from("contacts")
      .update({
        followup_count: newCount,
        last_followup_at: newLastAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contact.id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update contact", details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optionally move to a stage by slug
    let movedToStage: string | null = null;
    if (move_to_stage_slug) {
      // Find the target stage tag
      const { data: stageTag } = await supabase
        .from("tags")
        .select("id, name")
        .eq("account_id", account_id)
        .eq("slug", move_to_stage_slug)
        .eq("type", "stage")
        .maybeSingle();

      if (stageTag) {
        // Remove existing stage tags for this contact
        const { data: currentStageTags } = await supabase
          .from("lead_tags")
          .select("id, tag_id, tags!inner(type)")
          .eq("contact_id", contact.id);

        if (currentStageTags && currentStageTags.length > 0) {
          const stageTagIds = currentStageTags
            .filter((lt: any) => lt.tags?.type === "stage")
            .map((lt: any) => lt.id);

          if (stageTagIds.length > 0) {
            await supabase
              .from("lead_tags")
              .delete()
              .in("id", stageTagIds);
          }
        }

        // Apply the new stage tag
        await supabase.from("lead_tags").insert({
          contact_id: contact.id,
          tag_id: stageTag.id,
          source: "n8n-followup",
        });

        movedToStage = stageTag.name;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        contact_id: contact.id,
        followup_count: newCount,
        last_followup_at: newLastAt,
        moved_to_stage: movedToStage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
