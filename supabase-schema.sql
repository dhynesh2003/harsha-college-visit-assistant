
create extension if not exists pgcrypto;

create table if not exists public.colleges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  location text,
  relevant_students integer default 0,
  stage text default 'New',
  interest text default 'Unknown',
  main_contact_name text,
  main_contact_designation text,
  main_contact_phone text,
  main_contact_email text,
  next_action text,
  next_action_at timestamptz,
  blocker text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  college_id uuid not null references public.colleges(id) on delete cascade,
  name text not null,
  designation text,
  phone text,
  email text,
  department text,
  preferred_contact text,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.meeting_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  college_id uuid not null references public.colleges(id) on delete cascade,
  topic text not null,
  notes text not null,
  person_met text,
  feedback text default 'Neutral',
  meeting_at timestamptz not null default now(),
  next_action text,
  followup_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  college_id uuid not null references public.colleges(id) on delete cascade,
  reminder_text text not null,
  remind_at timestamptz not null,
  reminder_type text default 'Follow-up',
  done boolean default false,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.requirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  college_id uuid not null references public.colleges(id) on delete cascade,
  title text not null,
  description text not null,
  priority text default 'Medium',
  status text default 'New',
  requested_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.calendar_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_date date not null,
  note_text text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, note_date)
);

alter table public.colleges enable row level security;
alter table public.contacts enable row level security;
alter table public.meeting_notes enable row level security;
alter table public.reminders enable row level security;
alter table public.requirements enable row level security;
alter table public.calendar_notes enable row level security;

drop policy if exists "own colleges" on public.colleges;
create policy "own colleges" on public.colleges for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own contacts" on public.contacts;
create policy "own contacts" on public.contacts for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own meeting notes" on public.meeting_notes;
create policy "own meeting notes" on public.meeting_notes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own reminders" on public.reminders;
create policy "own reminders" on public.reminders for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own requirements" on public.requirements;
create policy "own requirements" on public.requirements for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own calendar notes" on public.calendar_notes;
create policy "own calendar notes" on public.calendar_notes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists colleges_user_id_idx on public.colleges(user_id);
create index if not exists contacts_user_id_idx on public.contacts(user_id);
create index if not exists contacts_college_id_idx on public.contacts(college_id);
create index if not exists meeting_notes_user_id_idx on public.meeting_notes(user_id);
create index if not exists reminders_user_id_idx on public.reminders(user_id);
create index if not exists requirements_user_id_idx on public.requirements(user_id);
create index if not exists calendar_notes_user_id_idx on public.calendar_notes(user_id);
