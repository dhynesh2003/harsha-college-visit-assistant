-- HARSHA COLLEGE VISIT ASSISTANT V4.2 — SCHEMA + RELIABILITY FIX
-- Run once in Supabase SQL Editor after the original schema / V4 migration.
-- Safe to re-run: all added columns and indexes use IF NOT EXISTS.

begin;

-- College fields used by the current Add/Edit College form.
alter table public.colleges
  add column if not exists affiliation_type text,
  add column if not exists parent_university text;

-- Flexible college-name linking used by notes, contacts, reminders and requirements.
alter table public.contacts alter column college_id drop not null;
alter table public.contacts add column if not exists college_name text;
alter table public.meeting_notes alter column college_id drop not null;
alter table public.meeting_notes add column if not exists college_name text;
alter table public.reminders alter column college_id drop not null;
alter table public.reminders add column if not exists college_name text;
alter table public.requirements alter column college_id drop not null;
alter table public.requirements add column if not exists college_name text;

-- Reminder fields used by current notification code.
alter table public.reminders
  add column if not exists alert_before_minutes integer not null default 0,
  add column if not exists notification_sent boolean not null default false,
  add column if not exists notification_sent_at timestamptz;

-- Structured visit fields used by crm-pro.js.
alter table public.crm_visits
  add column if not exists meeting_happened text default 'Pending visit',
  add column if not exists person_role text default 'Not decided / Not met',
  add column if not exists objective_achieved text default 'Pending visit',
  add column if not exists outcome_status text default 'Pending visit',
  add column if not exists decision_stage text default 'Not assessed',
  add column if not exists blocker_category text default 'None / Unknown',
  add column if not exists opportunity_strength text default 'Unknown',
  add column if not exists expected_students integer default 0,
  add column if not exists expected_value numeric(14,2) default 0,
  add column if not exists visit_classification text default 'Planned / Pending',
  add column if not exists lost_stalled_reason text default 'Not applicable',
  add column if not exists next_action_type text default 'None',
  add column if not exists responsible_person text default 'Harsha';

-- Index the exact fields used for the main app screens.
create index if not exists colleges_user_created_idx on public.colleges(user_id,created_at desc);
create index if not exists colleges_user_stage_idx on public.colleges(user_id,stage);
create index if not exists meeting_notes_user_date_idx on public.meeting_notes(user_id,meeting_at desc);
create index if not exists reminders_user_due_idx on public.reminders(user_id,remind_at);
create index if not exists requirements_user_updated_idx on public.requirements(user_id,updated_at desc);
create index if not exists calendar_notes_user_date_idx on public.calendar_notes(user_id,note_date);
create index if not exists crm_opportunities_user_stage_status_idx on public.crm_opportunities(user_id,stage,status);
create index if not exists crm_visits_user_date_idx on public.crm_visits(user_id,visit_at desc);
create index if not exists crm_activities_user_date_idx on public.crm_activities(user_id,occurred_at desc);

update public.colleges
set affiliation_type=coalesce(nullif(affiliation_type,''),'Anna University Affiliated')
where affiliation_type is null or affiliation_type='';

commit;

-- Refresh the Supabase/PostgREST schema cache immediately.
notify pgrst, 'reload schema';
select pg_notification_queue_usage();
