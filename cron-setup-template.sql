
-- Before running this file:
-- 1) Replace YOUR_PROJECT_URL.
-- 2) Replace YOUR_CRON_SECRET with the SAME random string saved as the Edge Function CRON_SECRET.
-- 3) Run once in Supabase SQL Editor.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select vault.create_secret('YOUR_PROJECT_URL', 'reminder_project_url');
select vault.create_secret('YOUR_CRON_SECRET', 'reminder_cron_secret');

select cron.schedule(
  'send-due-college-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='reminder_project_url')
           || '/functions/v1/send-due-reminders',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='reminder_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
