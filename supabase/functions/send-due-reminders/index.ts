import { createClient } from "npm:@supabase/supabase-js@2";

// @ts-ignore
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? "";

const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const VAPID_PUBLIC_KEY =
  Deno.env.get("VAPID_PUBLIC_KEY") ?? "";

const VAPID_PRIVATE_KEY =
  Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

const VAPID_SUBJECT =
  Deno.env.get("VAPID_SUBJECT") ??
  "mailto:admin@example.com";

const CRON_SECRET =
  Deno.env.get("CRON_SECRET") ?? "";

if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL");
}

if (!SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

if (!VAPID_PUBLIC_KEY) {
  throw new Error("Missing VAPID_PUBLIC_KEY");
}

if (!VAPID_PRIVATE_KEY) {
  throw new Error("Missing VAPID_PRIVATE_KEY");
}

if (!CRON_SECRET) {
  throw new Error("Missing CRON_SECRET");
}

const admin = createClient(
  SUPABASE_URL,
  SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

webpush.setVapidDetails(
  VAPID_SUBJECT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
);

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    if (
      req.headers.get("x-cron-secret") !==
      CRON_SECRET
    ) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const now = Date.now();

    const oldest =
      new Date(
        now - 24 * 60 * 60 * 1000,
      ).toISOString();

    const horizon =
      new Date(
        now + 24 * 60 * 60 * 1000,
      ).toISOString();

    const {
      data: candidates,
      error,
    } = await admin
      .from("reminders")
      .select(`
        id,
        user_id,
        reminder_text,
        remind_at,
        alert_before_minutes,
        note,
        college_name
      `)
      .eq("done", false)
      .eq("notification_sent", false)
      .gte("remind_at", oldest)
      .lte("remind_at", horizon);

    if (error) {
      console.error(
        "Reminder query error:",
        error,
      );

      return Response.json(
        { error: error.message },
        { status: 500 },
      );
    }

    const due =
      (candidates ?? []).filter(
        (reminder) => {
          const reminderTime =
            new Date(
              reminder.remind_at,
            ).getTime();

          const beforeMinutes =
            Number(
              reminder.alert_before_minutes ??
                0,
            );

          const triggerAt =
            reminderTime -
            beforeMinutes * 60_000;

          return triggerAt <= now;
        },
      );

    let sent = 0;
    let failed = 0;

    for (const reminder of due) {
      const {
        data: subscriptions,
        error: subError,
      } = await admin
        .from("push_subscriptions")
        .select(`
          id,
          endpoint,
          p256dh,
          auth
        `)
        .eq(
          "user_id",
          reminder.user_id,
        );

      if (subError) {
        console.error(
          "Subscription query error:",
          subError,
        );

        failed++;
        continue;
      }

      if (
        !subscriptions ||
        subscriptions.length === 0
      ) {
        console.log(
          "No push subscription for user:",
          reminder.user_id,
        );

        continue;
      }

      let successForReminder = false;

      for (const sub of subscriptions) {
        const subscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        const formattedTime =
          new Date(
            reminder.remind_at,
          ).toLocaleString(
            "en-IN",
            {
              timeZone:
                "Asia/Kolkata",
              dateStyle: "medium",
              timeStyle: "short",
            },
          );

        const contextText =
          reminder.college_name?.trim()
            ? reminder.college_name
            : "General reminder";

        const payload =
          JSON.stringify({
            title:
              reminder.reminder_text,

            body:
              `${contextText} • ${formattedTime}`,

            tag:
              `reminder-${reminder.id}`,

            url:
              "./index.html",

            reminderId:
              reminder.id,
          });

        try {
          await webpush.sendNotification(
            subscription,
            payload,
          );

          successForReminder = true;
          sent++;
        } catch (err) {
          failed++;

          console.error(
            "Push failed:",
            err,
          );

          const statusCode =
            getStatusCode(err);

          if (
            statusCode === 404 ||
            statusCode === 410
          ) {
            await admin
              .from(
                "push_subscriptions",
              )
              .delete()
              .eq(
                "id",
                sub.id,
              );
          }
        }
      }

      if (successForReminder) {
        const {
          error: updateError,
        } = await admin
          .from("reminders")
          .update({
            notification_sent:
              true,

            notification_sent_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            reminder.id,
          );

        if (updateError) {
          console.error(
            "Could not mark reminder sent:",
            updateError,
          );
        }
      }
    }

    return Response.json({
      checked:
        candidates?.length ?? 0,
      due:
        due.length,
      sent,
      failed,
    });
  } catch (err) {
    console.error(
      "Unhandled function error:",
      err,
    );

    const message =
      err instanceof Error
        ? err.message
        : String(err);

    return Response.json(
      { error: message },
      { status: 500 },
    );
  }
});

function getStatusCode(
  err: unknown,
): number | null {
  if (
    typeof err === "object" &&
    err !== null &&
    "statusCode" in err
  ) {
    const value =
      (
        err as {
          statusCode?: unknown;
        }
      ).statusCode;

    return typeof value === "number"
      ? value
      : null;
  }

  return null;
}