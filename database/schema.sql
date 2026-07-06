-- Growth Engine Phase 1 schema
-- Use this as the source schema when moving from local demo persistence to Postgres.

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  lead_url text,
  lead_name text not null,
  business_name text,
  contact_person text,
  phone text,
  email text,
  industry text,
  location text,
  source text,
  lead_temperature text not null check (lead_temperature in ('Hot', 'Warm', 'Cold')),
  lead_stage text not null check (
    lead_stage in (
      'New Lead',
      'Contacted',
      'Details Sent',
      'Follow-up Needed',
      'Proposal Sent',
      'Won',
      'Lost',
      'Rejected',
      'No Response'
    )
  ),
  service_interest text check (
    service_interest in (
      '30 Poster Package',
      '15 Posters Monthly Package',
      'Website',
      'Posters + Website',
      'Branding',
      'One-time Creative',
      'Maintenance',
      'Not Sure'
    )
  ),
  expected_value numeric(12, 2) default 0,
  objection_reason text check (
    objection_reason in (
      'Price High',
      'Already Has Team',
      'Already Has Agency',
      'Need Time',
      'No Budget',
      'No Response',
      'Wants Videos',
      'Not Decision Maker',
      'Not Interested Now',
      'Will Contact Later',
      'Other'
    )
  ),
  first_contact_date date,
  next_followup_date date,
  remarks text,
  assigned_to text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  followup_date date not null,
  followup_type text not null check (followup_type in ('Call', 'WhatsApp', 'Instagram DM', 'Meeting')),
  outcome text not null check (
    outcome in (
      'No Response',
      'Call Back Later',
      'Details Sent',
      'Interested',
      'Not Interested',
      'Asked for Price',
      'Proposal Requested',
      'Converted',
      'Rejected'
    )
  ),
  next_followup_date date,
  remarks text,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  action text not null,
  old_value text,
  new_value text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists leads_stage_idx on leads (lead_stage);
create index if not exists leads_temperature_idx on leads (lead_temperature);
create index if not exists leads_next_followup_idx on leads (next_followup_date);
create index if not exists followups_lead_date_idx on followups (lead_id, followup_date desc);
