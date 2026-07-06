-- Growth Engine Phase 1 schema
-- Neon/Postgres source schema for the CG Studio Lead Tracker.

create table if not exists leads (
  id text primary key,
  lead_url text not null default '',
  lead_name text not null default '',
  business_name text not null default '',
  contact_person text not null default '',
  phone text not null default '',
  email text not null default '',
  industry text not null default '',
  location text not null default '',
  source text not null default '',
  lead_temperature text not null default 'Cold',
  lead_stage text not null default 'New Lead',
  service_interest text not null default '30 Poster Package',
  expected_value numeric(12, 2) not null default 0,
  objection_reason text not null default '',
  first_contact_date date,
  next_followup_date date,
  remarks text not null default '',
  assigned_to text not null default 'Naveen',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists followups (
  id text primary key,
  lead_id text not null references leads(id) on delete cascade,
  followup_date date not null,
  followup_type text not null,
  outcome text not null,
  next_followup_date date,
  remarks text not null default '',
  created_by text not null default 'captain',
  created_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id text primary key,
  lead_id text not null references leads(id) on delete cascade,
  action text not null,
  old_value text not null default '',
  new_value text not null default '',
  created_by text not null default 'captain',
  created_at timestamptz not null default now()
);

create index if not exists leads_stage_idx on leads (lead_stage);
create index if not exists leads_temperature_idx on leads (lead_temperature);
create index if not exists leads_next_followup_idx on leads (next_followup_date);
create index if not exists followups_lead_date_idx on followups (lead_id, followup_date desc);
