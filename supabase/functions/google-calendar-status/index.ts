import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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

    // Get user's account_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.account_id) {
      throw new Error("Conta não encontrada");
    }

    // Check for existing token using service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("google_calendar_tokens")
      .select("connected_email, expires_at, calendar_id")
      .eq("account_id", profile.account_id)
      .maybeSingle();

    if (tokenError) {
      console.error("Token query error:", tokenError);
    }

    const isConnected = !!tokenData;
    const isExpired = tokenData?.expires_at 
      ? new Date(tokenData.expires_at) < new Date() 
      : false;

    return new Response(
      JSON.stringify({
        connected: isConnected && !isExpired,
        email: tokenData?.connected_email || null,
        calendarId: tokenData?.calendar_id || null,
        expiresAt: tokenData?.expires_at || null,
        needsReauth: isExpired,
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ 
        connected: false, 
        email: null,
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 // Return 200 even on error to prevent UI breaks
      }
    );
  }
});
