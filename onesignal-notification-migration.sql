-- Harsha College Visit Assistant: OneSignal delivery log
-- Run once in Supabase SQL Editor.

alter table public.reminders
  add column if not exists alert_before_minutes integer not null default 0,
  add column if not exists notification_sent boolean not null default false,
  add column if not exists notification_sent_at timestamptz;

create table if not exists public.notification_delivery_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_id uuid references public.reminders(id) on delete set null,
  provider text not null default 'OneSignal',
  status text not null,
  title text,
  message text,
  onesignal_message_id text,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.notification_delivery_log enable row level security;

drop policy if exists "own notification delivery log select" on public.notification_delivery_log;
create policy "own notification delivery log select"
on public.notification_delivery_log
for select
to authenticated
using (auth.uid() = user_id);

create index if not exists notification_delivery_log_user_created_idx
on public.notification_delivery_log(user_id, created_at desc);

create index if not exists reminders_due_notification_idx
on public.reminders(done, notification_sent, remind_at);
