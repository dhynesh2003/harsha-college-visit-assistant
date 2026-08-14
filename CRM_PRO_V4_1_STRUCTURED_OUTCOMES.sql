-- HARSHA CRM V4.1 — STRUCTURED VISIT OUTCOMES + UNIVERSITY AFFILIATION
-- Safe incremental migration. Run ONCE after CRM_PRO_V4_MIGRATION.sql.
-- Existing data is preserved.

-- College affiliation / university structure
alter table public.colleges
  add column if not exists affiliation_type text,
  add column if not exists parent_university text;

-- Structured field-visit outcome
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

create index if not exists colleges_user_affiliation_idx
  on public.colleges(user_id, affiliation_type);

create index if not exists crm_visits_user_outcome_idx
  on public.crm_visits(user_id, outcome_status, visit_classification);

create index if not exists crm_visits_user_decision_stage_idx
  on public.crm_visits(user_id, decision_stage);

-- Give existing colleges a sensible default without overwriting any future values.
update public.colleges
set affiliation_type = coalesce(nullif(affiliation_type,''), 'Anna University Affiliated')
where affiliation_type is null or affiliation_type = '';

-- Existing visits remain valid; they simply start as "not yet classified".
update public.crm_visits
set
  meeting_happened = coalesce(meeting_happened,'Pending visit'),
  objective_achieved = coalesce(objective_achieved,'Pending visit'),
  outcome_status = coalesce(outcome_status,'Pending visit'),
  decision_stage = coalesce(decision_stage,'Not assessed'),
  blocker_category = coalesce(blocker_category,'None / Unknown'),
  opportunity_strength = coalesce(opportunity_strength,'Unknown'),
  visit_classification = coalesce(visit_classification,'Planned / Pending'),
  lost_stalled_reason = coalesce(lost_stalled_reason,'Not applicable'),
  next_action_type = coalesce(next_action_type,'None'),
  responsible_person = coalesce(responsible_person,'Harsha');
