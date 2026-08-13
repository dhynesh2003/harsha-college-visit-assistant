
-- Run this AFTER your original supabase-schema.sql.

alter table public.reminders
  add column if not exists alert_before_minutes integer not null default 0,
  add column if not exists notification_sent boolean not null default false,
  add column if not exists notification_sent_at timestamptz;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions"
on public.push_subscriptions
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists push_subscriptions_user_id_idx
on public.push_subscriptions(user_id);

create index if not exists reminders_due_notification_idx
on public.reminders(done, notification_sent, remind_at);
