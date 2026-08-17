import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID") ?? "";
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://harsha-college-visit-assistant.vercel.app";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function logAttempt(admin: ReturnType<typeof createClient>, row: Record<string, unknown>) {
  try {
    await admin.from("notification_delivery_log").insert(row);
  } catch (error) {
    console.warn("notification_delivery_log insert failed:", error);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ ok: false, error: "Supabase function environment is incomplete." }, 500);
    }
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      return json({ ok: false, error: "OneSignal Edge Function secrets are not configured." }, 500);
    }

    const authorization = req.headers.get("Authorization");
    if (!authorization) {
      return json({ ok: false, error: "Missing Authorization header." }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    const user = authData.user;
    if (authError || !user) {
      return json({ ok: false, error: "Invalid or expired signed-in session." }, 401);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || "Harsha College Visit Assistant").slice(0, 120);
    const message = String(body?.message || "Test notification successful — external push delivery is working.").slice(0, 500);

    const payload = {
      app_id: ONESIGNAL_APP_ID,
      target_channel: "push",
      include_aliases: { external_id: [user.id] },
      headings: { en: title },
      contents: { en: message },
      url: APP_URL,
      data: { type: "test", user_id: user.id },
    };

    const response = await fetch("https://api.onesignal.com/notifications?c=push", {
      method: "POST",
      headers: {
        "Authorization": `Key ${ONESIGNAL_REST_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));
    const accepted = response.ok && Boolean(result?.id);

    await logAttempt(admin, {
      user_id: user.id,
      provider: "OneSignal",
      status: accepted ? "accepted" : "failed",
      title,
      message,
      onesignal_message_id: result?.id ?? null,
      error_message: accepted ? null : JSON.stringify(result),
    });

    if (!response.ok) {
      console.error("OneSignal test send failed:", response.status, result);
      return json({ ok: false, error: "OneSignal rejected the push request.", details: result }, 502);
    }

    if (!result?.id) {
      return json({
        ok: false,
        error: "OneSignal found no active push subscription for this signed-in user.",
        details: result,
      }, 409);
    }

    return json({
      ok: true,
      provider: "OneSignal",
      oneSignalMessageId: result.id,
      recipients: result.recipients ?? null,
    });
  } catch (error) {
    console.error("send-test-notification error:", error);
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
