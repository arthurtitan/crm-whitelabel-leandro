import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return null;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    console.error("Token refresh failed:", await response.text());
    return null;
  }

  const data = await response.json();
  return data.access_token;
}

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

    // Get tokens
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from("google_calendar_tokens")
      .select("*")
      .eq("account_id", profile.account_id)
      .maybeSingle();

    if (!tokenData) {
      throw new Error("Google Calendar não conectado");
    }

    // Check if token needs refresh
    let accessToken = tokenData.access_token;
    const isExpired = new Date(tokenData.expires_at) < new Date();

    if (isExpired) {
      const newToken = await refreshAccessToken(tokenData.refresh_token);
      if (!newToken) {
        throw new Error("Falha ao renovar token. Por favor, reconecte o Google Calendar.");
      }
      accessToken = newToken;

      // Update token in database
      await supabaseAdmin
        .from("google_calendar_tokens")
        .update({
          access_token: newToken,
          expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("account_id", profile.account_id);
    }

    // Fetch events from Google Calendar
    const now = new Date();
    const timeMin = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days ago
    const timeMax = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(); // 90 days ahead

    const calendarId = tokenData.calendar_id || "primary";
    const eventsUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
      new URLSearchParams({
        timeMin,
        timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "250",
      });

    const eventsResponse = await fetch(eventsUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!eventsResponse.ok) {
      const errorText = await eventsResponse.text();
      console.error("Google Calendar API error:", errorText);
      throw new Error("Erro ao buscar eventos do Google");
    }

    const googleEvents = await eventsResponse.json();
    const items = googleEvents.items || [];

    let synced = 0;
    let created = 0;
    let updated = 0;

    for (const event of items) {
      if (!event.start?.dateTime && !event.start?.date) continue;

      const startTime = event.start.dateTime || `${event.start.date}T00:00:00Z`;
      const endTime = event.end?.dateTime || event.end?.date 
        ? (event.end.dateTime || `${event.end.date}T23:59:59Z`)
        : startTime;

      // Check if event already exists
      const { data: existingEvent } = await supabaseAdmin
        .from("calendar_events")
        .select("id")
        .eq("account_id", profile.account_id)
        .eq("google_event_id", event.id)
        .maybeSingle();

      const eventData = {
        account_id: profile.account_id,
        title: event.summary || "Sem título",
        start_time: startTime,
        end_time: endTime,
        location: event.location || null,
        meeting_link: event.hangoutLink || null,
        notes: event.description || null,
        google_event_id: event.id,
        google_calendar_id: calendarId,
        source: "google",
        status: event.status === "cancelled" ? "cancelled" : "scheduled",
        type: event.hangoutLink ? "meeting" : "appointment",
      };

      if (existingEvent) {
        await supabaseAdmin
          .from("calendar_events")
          .update(eventData)
          .eq("id", existingEvent.id);
        updated++;
      } else {
        await supabaseAdmin
          .from("calendar_events")
          .insert(eventData);
        created++;
      }
      synced++;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        synced,
        created,
        updated,
        message: `${synced} eventos sincronizados (${created} novos, ${updated} atualizados)`,
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400 
      }
    );
  }
});
