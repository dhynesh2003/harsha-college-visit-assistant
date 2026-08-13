-- Flexible college linking migration
-- Run this once in Supabase SQL Editor on the existing project.

alter table public.contacts
  alter column college_id drop not null,
  add column if not exists college_name text;

alter table public.meeting_notes
  alter column college_id drop not null,
  add column if not exists college_name text;

alter table public.reminders
  alter column college_id drop not null,
  add column if not exists college_name text;

alter table public.requirements
  alter column college_id drop not null,
  add column if not exists college_name text;

-- Backfill readable names for existing linked rows.
update public.contacts x
set college_name = c.name
from public.colleges c
where x.college_id = c.id
  and (x.college_name is null or x.college_name = '');

update public.meeting_notes x
set college_name = c.name
from public.colleges c
where x.college_id = c.id
  and (x.college_name is null or x.college_name = '');

update public.reminders x
set college_name = c.name
from public.colleges c
where x.college_id = c.id
  and (x.college_name is null or x.college_name = '');

update public.requirements x
set college_name = c.name
from public.colleges c
where x.college_id = c.id
  and (x.college_name is null or x.college_name = '');
