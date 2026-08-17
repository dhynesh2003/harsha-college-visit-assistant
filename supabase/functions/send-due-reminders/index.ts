import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID") ?? "";
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "https://harsha-college-visit-assistant.vercel.app";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "Supabase function environment is incomplete." }, 500);
    }
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      return json({ error: "OneSignal Edge Function secrets are not configured." }, 500);
    }
    if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
      return json({ error: "Unauthorized" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const now = Date.now();
    const oldest = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const horizon = new Date(now + 2 * 24 * 60 * 60 * 1000).toISOString();

    const { data: candidates, error: queryError } = await admin
      .from("reminders")
      .select("id,user_id,reminder_text,remind_at,alert_before_minutes,note")
      .eq("done", false)
      .eq("notification_sent", false)
      .gte("remind_at", oldest)
      .lte("remind_at", horizon);

    if (queryError) {
      console.error("Reminder query failed:", queryError);
      return json({ error: queryError.message }, 500);
    }

    const due = (candidates ?? []).filter((reminder) => {
      const reminderTime = new Date(reminder.remind_at).getTime();
      const beforeMinutes = Number(reminder.alert_before_minutes ?? 0);
      return reminderTime - beforeMinutes * 60_000 <= now;
    });

    let sent = 0;
    let failed = 0;

    for (const reminder of due) {
      const formattedTime = new Date(reminder.remind_at).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      });

      const title = reminder.reminder_text || "College visit reminder";
      const message = reminder.note
        ? `${reminder.note} • ${formattedTime}`
        : `Reminder scheduled for ${formattedTime}`;

      const response = await fetch("https://api.onesignal.com/notifications?c=push", {
        method: "POST",
        headers: {
          "Authorization": `Key ${ONESIGNAL_REST_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          target_channel: "push",
          include_aliases: { external_id: [reminder.user_id] },
          headings: { en: title.slice(0, 120) },
          contents: { en: message.slice(0, 500) },
          url: APP_URL,
          data: { type: "reminder", reminder_id: reminder.id },
        }),
      });

      const result = await response.json().catch(() => ({}));
      const accepted = response.ok && Boolean(result?.id);

      const { error: logError } = await admin.from("notification_delivery_log").insert({
        user_id: reminder.user_id,
        reminder_id: reminder.id,
        provider: "OneSignal",
        status: accepted ? "accepted" : "failed",
        title,
        message,
        onesignal_message_id: result?.id ?? null,
        error_message: accepted ? null : JSON.stringify(result),
      });
      if (logError) console.warn("Delivery log insert failed:", logError);

      if (!accepted) {
        failed += 1;
        console.error("OneSignal reminder send failed:", response.status, result);
        continue;
      }

      const { error: updateError } = await admin
        .from("reminders")
        .update({
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
        })
        .eq("id", reminder.id);

      if (updateError) {
        failed += 1;
        console.error("Could not mark reminder sent:", updateError);
      } else {
        sent += 1;
      }
    }

    return json({ checked: candidates?.length ?? 0, due: due.length, sent, failed });
  } catch (error) {
    console.error("send-due-reminders error:", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
