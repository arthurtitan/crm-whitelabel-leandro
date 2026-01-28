import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const GOOGLE_REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI") || 
  `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-callback`;
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://testedocrm.lovable.app";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    if (error) {
      console.error("OAuth error:", error);
      return Response.redirect(`${FRONTEND_URL}/admin/agenda?error=oauth_denied`);
    }

    if (!code || !state) {
      return Response.redirect(`${FRONTEND_URL}/admin/agenda?error=invalid_params`);
    }

    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      console.error("Google credentials not configured");
      return Response.redirect(`${FRONTEND_URL}/admin/agenda?error=config_error`);
    }

    // Decode state
    let stateData;
    try {
      stateData = JSON.parse(atob(state));
    } catch {
      return Response.redirect(`${FRONTEND_URL}/admin/agenda?error=invalid_state`);
    }

    const { accountId, userId } = stateData;

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return Response.redirect(`${FRONTEND_URL}/admin/agenda?error=token_exchange`);
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    if (!access_token || !refresh_token) {
      console.error("Missing tokens in response");
      return Response.redirect(`${FRONTEND_URL}/admin/agenda?error=missing_tokens`);
    }

    // Get user email from Google
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    let connectedEmail = "";
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      connectedEmail = userInfo.email;
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Save tokens using service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Upsert tokens (insert or update)
    const { error: dbError } = await supabase
      .from("google_calendar_tokens")
      .upsert({
        account_id: accountId,
        access_token,
        refresh_token,
        expires_at: expiresAt,
        connected_email: connectedEmail,
        calendar_id: "primary",
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "account_id",
      });

    if (dbError) {
      console.error("Database error:", dbError);
      return Response.redirect(`${FRONTEND_URL}/admin/agenda?error=db_error`);
    }

    // Redirect to frontend with success
    return Response.redirect(`${FRONTEND_URL}/admin/agenda?google_connected=true`);
  } catch (error) {
    console.error("Callback error:", error);
    return Response.redirect(`${FRONTEND_URL}/admin/agenda?error=unknown`);
  }
});
