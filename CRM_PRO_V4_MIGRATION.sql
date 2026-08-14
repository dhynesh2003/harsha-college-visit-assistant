-- HARSHA CRM PROFESSIONAL V4 MIGRATION
-- Run ONCE in the existing Supabase project. It does not delete existing CRM data.

create table if not exists public.crm_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  college_id uuid null references public.colleges(id) on delete set null,
  college_name text,
  purpose text not null default 'Follow-up',
  agenda text,
  visit_at timestamptz not null,
  status text not null default 'Planned',
  location text,
  people_met text,
  outcome text,
  interest_level text default 'Unknown',
  blocker text,
  next_action text,
  follow_up_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  college_id uuid null references public.colleges(id) on delete set null,
  college_name text,
  activity_type text not null,
  title text not null,
  details text,
  occurred_at timestamptz not null default now(),
  contact_name text,
  outcome text default 'Pending',
  next_action text,
  follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  college_id uuid null references public.colleges(id) on delete set null,
  college_name text,
  name text not null,
  stage text not null default 'Prospect',
  probability integer not null default 20 check (probability between 0 and 100),
  estimated_value numeric(14,2) not null default 0,
  expected_close_date date,
  status text not null default 'Open',
  lost_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  college_id uuid null references public.colleges(id) on delete set null,
  college_name text,
  category text not null default 'Other',
  file_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  note text,
  created_at timestamptz not null default now()
);

alter table public.crm_visits enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_opportunities enable row level security;
alter table public.crm_files enable row level security;

do $$ begin
  create policy "crm_visits own rows" on public.crm_visits for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "crm_activities own rows" on public.crm_activities for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "crm_opportunities own rows" on public.crm_opportunities for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "crm_files own rows" on public.crm_files for all to authenticated using (auth.uid()=user_id) with check (auth.uid()=user_id);
exception when duplicate_object then null; end $$;

create index if not exists crm_visits_user_date_idx on public.crm_visits(user_id,visit_at desc);
create index if not exists crm_activities_user_date_idx on public.crm_activities(user_id,occurred_at desc);
create index if not exists crm_opportunities_user_stage_idx on public.crm_opportunities(user_id,stage,status);
create index if not exists crm_files_user_created_idx on public.crm_files(user_id,created_at desc);

insert into storage.buckets (id,name,public,file_size_limit)
values ('crm-files','crm-files',false,20971520)
on conflict (id) do update set public=false,file_size_limit=20971520;

do $$ begin
  create policy "crm files upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id='crm-files' and (storage.foldername(name))[1]=auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "crm files read own folder" on storage.objects for select to authenticated
  using (bucket_id='crm-files' and (storage.foldername(name))[1]=auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "crm files delete own folder" on storage.objects for delete to authenticated
  using (bucket_id='crm-files' and (storage.foldername(name))[1]=auth.uid()::text);
exception when duplicate_object then null; end $$;
