import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Não autorizado");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Usuário não autenticado");
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get token to revoke
    const { data: tokenData } = await supabaseAdmin
      .from("google_calendar_tokens")
      .select("access_token")
      .eq("user_id", user.id)
      .maybeSingle();

    // Revoke token at Google (optional, best effort)
    if (tokenData?.access_token) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${tokenData.access_token}`, {
          method: "POST",
        });
      } catch (e) {
        console.warn("Token revocation failed:", e);
      }
    }

    // Delete all Google events for this user
    const { error: deleteEventsError } = await supabaseAdmin
      .from("calendar_events")
      .delete()
      .eq("created_by", user.id)
      .eq("source", "google");

    if (deleteEventsError) {
      console.error("Error deleting events:", deleteEventsError);
      // Continue anyway
    }

    // Delete token from database
    const { error: deleteError } = await supabaseAdmin
      .from("google_calendar_tokens")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      throw new Error("Erro ao desconectar");
    }

    console.log(`Disconnected Google Calendar for user ${user.id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400 
      }
    );
  }
});
