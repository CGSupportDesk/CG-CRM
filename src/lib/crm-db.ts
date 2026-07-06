import "server-only";

import { neon } from "@neondatabase/serverless";
import { buildPosterCampaignSeed } from "@/lib/poster-campaign";
import type {
  ActivityLog,
  CRMState,
  Followup,
  FollowupDraft,
  ImportPreviewRow,
  ImportSummary,
  Lead,
  LeadDraft,
} from "@/lib/types";
import { createId } from "@/lib/utils";

type SqlClient = ReturnType<typeof neon>;

let sqlClient: SqlClient | null = null;
let schemaPromise: Promise<void> | null = null;

export function hasDatabaseUrl() {
  return Boolean(getDatabaseUrl());
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || "";
}

function getSql() {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or POSTGRES_URL is not configured.");
  }

  sqlClient ??= neon(databaseUrl);
  return sqlClient;
}

export async function getCrmState() {
  await ensureCrmSchema();
  await seedDatabaseIfEmpty();
  return readCrmState();
}

export async function addLeadRecord(leadDraft: LeadDraft) {
  await ensureCrmSchema();

  const now = new Date().toISOString();
  const lead: Lead = {
    ...leadDraft,
    id: createId("lead"),
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
  const log = buildLog(lead.id, "Lead created", "", lead.leadStage);

  const sql = getSql();
  await insertLead(lead);
  await insertLogs([log]);

  return { id: lead.id, state: await readCrmState(sql) };
}

export async function updateLeadRecord(id: string, changes: Partial<LeadDraft>) {
  await ensureCrmSchema();

  const existing = await getLeadById(id);
  if (!existing) return { state: await readCrmState() };

  const updated: Lead = {
    ...existing,
    ...changes,
    updatedAt: new Date().toISOString(),
  };
  const logs = buildChangeLogs(existing, updated);

  await updateLead(updated);
  await insertLogs(logs);

  return { state: await readCrmState() };
}

export async function archiveLeadRecord(id: string) {
  await ensureCrmSchema();

  const existing = await getLeadById(id);
  if (!existing) return { state: await readCrmState() };

  const updated = { ...existing, isArchived: true, updatedAt: new Date().toISOString() };
  await updateLead(updated);
  await insertLogs([buildLog(id, "Lead archived", "Active", "Archived")]);

  return { state: await readCrmState() };
}

export async function deleteLeadRecord(id: string) {
  await ensureCrmSchema();
  const sql = getSql();
  await sql`delete from leads where id = ${id}`;
  return { state: await readCrmState(sql) };
}

export async function addFollowupRecord(draft: FollowupDraft) {
  await ensureCrmSchema();

  const followup: Followup = {
    ...draft,
    id: createId("followup"),
    createdAt: new Date().toISOString(),
  };
  const lead = await getLeadById(draft.leadId);
  const inferredStage = inferLeadStageFromOutcome(draft.outcome, lead?.leadStage);

  const sql = getSql();
  await insertFollowups([followup]);

  if (lead) {
    const updatedLead: Lead = {
      ...lead,
      leadStage: inferredStage,
      nextFollowupDate: draft.nextFollowupDate,
      updatedAt: new Date().toISOString(),
    };
    await updateLead(updatedLead);
  }

  await insertLogs([
    buildLog(draft.leadId, "Follow-up added", "", draft.outcome),
    ...(lead && lead.leadStage !== inferredStage
      ? [buildLog(draft.leadId, "Stage updated", lead.leadStage, inferredStage)]
      : []),
  ]);

  return { id: followup.id, state: await readCrmState(sql) };
}

export async function updateFollowupRecord(id: string, changes: Partial<FollowupDraft>) {
  await ensureCrmSchema();

  const sql = getSql();
  const rows = (await sql`select * from followups where id = ${id} limit 1`) as Array<
    Record<string, unknown>
  >;
  const existing = rows[0] ? mapFollowup(rows[0]) : null;
  if (!existing) return { state: await readCrmState(sql) };

  const updated: Followup = { ...existing, ...changes };
  await sql`
    update followups
    set
      lead_id = ${updated.leadId},
      followup_date = ${dateOrNull(updated.followupDate)},
      followup_type = ${updated.followupType},
      outcome = ${updated.outcome},
      next_followup_date = ${dateOrNull(updated.nextFollowupDate)},
      remarks = ${updated.remarks},
      created_by = ${updated.createdBy}
    where id = ${id}
  `;

  if ("nextFollowupDate" in changes) {
    await sql`
      update leads
      set next_followup_date = ${dateOrNull(updated.nextFollowupDate)}, updated_at = ${new Date().toISOString()}
      where id = ${updated.leadId}
    `;
  }

  await insertLogs([
    buildLog(updated.leadId, "Follow-up updated", existing.outcome, updated.outcome),
  ]);

  return { state: await readCrmState(sql) };
}

export async function importLegacyRowsRecord(rows: ImportPreviewRow[]): Promise<ImportSummary> {
  await ensureCrmSchema();

  const now = new Date().toISOString();
  const importedLeads: Lead[] = rows.map((row) => ({
    ...row.lead,
    id: createId("lead"),
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  }));
  const leadByRow = new Map(rows.map((row, index) => [row.rowNumber, importedLeads[index]]));
  const importedFollowups: Followup[] = rows.flatMap((row) => {
    const lead = leadByRow.get(row.rowNumber);
    if (!lead) return [];

    return row.followups.map((followup) => ({
      ...followup,
      id: createId("followup"),
      leadId: lead.id,
      createdAt: now,
    }));
  });
  const logs = importedLeads.map((lead) =>
    buildLog(lead.id, "Lead imported from CSV", "", lead.leadStage),
  );

  await insertLeads(importedLeads);
  await insertFollowups(importedFollowups);
  await insertLogs(logs);

  return {
    leadsImported: importedLeads.length,
    followupsImported: importedFollowups.length,
    skippedRows: Math.max(rows.length - importedLeads.length, 0),
  };
}

export async function resetCrmFromPrivateSeed() {
  await ensureCrmSchema();
  const sql = getSql();
  await sql`delete from leads`;
  await seedDatabaseIfEmpty();
  return readCrmState(sql);
}

async function ensureCrmSchema() {
  schemaPromise ??= createSchema();
  return schemaPromise;
}

async function createSchema() {
  const sql = getSql();

  await sql`
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
      assigned_to text not null default 'captain',
      is_archived boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
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
    )
  `;

  await sql`
    create table if not exists activity_logs (
      id text primary key,
      lead_id text not null references leads(id) on delete cascade,
      action text not null,
      old_value text not null default '',
      new_value text not null default '',
      created_by text not null default 'captain',
      created_at timestamptz not null default now()
    )
  `;

  await sql`create index if not exists leads_stage_idx on leads (lead_stage)`;
  await sql`create index if not exists leads_temperature_idx on leads (lead_temperature)`;
  await sql`create index if not exists leads_next_followup_idx on leads (next_followup_date)`;
  await sql`create index if not exists followups_lead_date_idx on followups (lead_id, followup_date desc)`;
}

async function seedDatabaseIfEmpty() {
  const sql = getSql();
  const [{ count }] = (await sql`select count(*)::int as count from leads`) as Array<{
    count: number;
  }>;
  if (Number(count) > 0) return;

  const encodedTracker = process.env.GROWTH_ENGINE_SEED_TSV_BASE64;
  if (!encodedTracker) return;

  const trackerTsv = Buffer.from(encodedTracker, "base64").toString("utf8");
  const seed = buildPosterCampaignSeed(trackerTsv);

  await insertLeads(seed.leads);
  await insertFollowups(seed.followups);
  await insertLogs(seed.activityLogs);
}

async function readCrmState(sql = getSql()): Promise<CRMState> {
  const [leadRows, followupRows, activityRows] = (await Promise.all([
    sql`select * from leads order by created_at desc`,
    sql`select * from followups order by created_at desc`,
    sql`select * from activity_logs order by created_at desc`,
  ])) as [
    Array<Record<string, unknown>>,
    Array<Record<string, unknown>>,
    Array<Record<string, unknown>>,
  ];

  return {
    leads: leadRows.map(mapLead),
    followups: followupRows.map(mapFollowup),
    activityLogs: activityRows.map(mapActivityLog),
  };
}

async function getLeadById(id: string) {
  const sql = getSql();
  const rows = (await sql`select * from leads where id = ${id} limit 1`) as Array<
    Record<string, unknown>
  >;
  return rows[0] ? mapLead(rows[0]) : null;
}

async function insertLead(lead: Lead) {
  const sql = getSql();
  await sql`
    insert into leads (
      id, lead_url, lead_name, business_name, contact_person, phone, email, industry, location,
      source, lead_temperature, lead_stage, service_interest, expected_value, objection_reason,
      first_contact_date, next_followup_date, remarks, assigned_to, is_archived, created_at, updated_at
    )
    values (
      ${lead.id}, ${lead.leadUrl}, ${lead.leadName}, ${lead.businessName}, ${lead.contactPerson},
      ${lead.phone}, ${lead.email}, ${lead.industry}, ${lead.location}, ${lead.source},
      ${lead.leadTemperature}, ${lead.leadStage}, ${lead.serviceInterest}, ${lead.expectedValue},
      ${lead.objectionReason}, ${dateOrNull(lead.firstContactDate)}, ${dateOrNull(lead.nextFollowupDate)},
      ${lead.remarks}, ${lead.assignedTo}, ${lead.isArchived}, ${lead.createdAt}, ${lead.updatedAt}
    )
  `;
}

async function insertLeads(leads: Lead[]) {
  if (!leads.length) return;
  const sql = getSql();

  await sql`
    insert into leads (
      id, lead_url, lead_name, business_name, contact_person, phone, email, industry, location,
      source, lead_temperature, lead_stage, service_interest, expected_value, objection_reason,
      first_contact_date, next_followup_date, remarks, assigned_to, is_archived, created_at, updated_at
    )
    select
      x."id",
      coalesce(x."leadUrl", ''),
      coalesce(x."leadName", ''),
      coalesce(x."businessName", ''),
      coalesce(x."contactPerson", ''),
      coalesce(x."phone", ''),
      coalesce(x."email", ''),
      coalesce(x."industry", ''),
      coalesce(x."location", ''),
      coalesce(x."source", ''),
      coalesce(x."leadTemperature", 'Cold'),
      coalesce(x."leadStage", 'New Lead'),
      coalesce(x."serviceInterest", '30 Poster Package'),
      coalesce(x."expectedValue", 0),
      coalesce(x."objectionReason", ''),
      nullif(x."firstContactDate", '')::date,
      nullif(x."nextFollowupDate", '')::date,
      coalesce(x."remarks", ''),
      coalesce(x."assignedTo", 'captain'),
      coalesce(x."isArchived", false),
      coalesce(nullif(x."createdAt", '')::timestamptz, now()),
      coalesce(nullif(x."updatedAt", '')::timestamptz, now())
    from jsonb_to_recordset(${JSON.stringify(leads)}::jsonb) as x(
      "id" text,
      "leadUrl" text,
      "leadName" text,
      "businessName" text,
      "contactPerson" text,
      "phone" text,
      "email" text,
      "industry" text,
      "location" text,
      "source" text,
      "leadTemperature" text,
      "leadStage" text,
      "serviceInterest" text,
      "expectedValue" numeric,
      "objectionReason" text,
      "firstContactDate" text,
      "nextFollowupDate" text,
      "remarks" text,
      "assignedTo" text,
      "isArchived" boolean,
      "createdAt" text,
      "updatedAt" text
    )
    on conflict (id) do nothing
  `;
}

async function updateLead(lead: Lead) {
  const sql = getSql();

  await sql`
    update leads
    set
      lead_url = ${lead.leadUrl},
      lead_name = ${lead.leadName},
      business_name = ${lead.businessName},
      contact_person = ${lead.contactPerson},
      phone = ${lead.phone},
      email = ${lead.email},
      industry = ${lead.industry},
      location = ${lead.location},
      source = ${lead.source},
      lead_temperature = ${lead.leadTemperature},
      lead_stage = ${lead.leadStage},
      service_interest = ${lead.serviceInterest},
      expected_value = ${lead.expectedValue},
      objection_reason = ${lead.objectionReason},
      first_contact_date = ${dateOrNull(lead.firstContactDate)},
      next_followup_date = ${dateOrNull(lead.nextFollowupDate)},
      remarks = ${lead.remarks},
      assigned_to = ${lead.assignedTo},
      is_archived = ${lead.isArchived},
      updated_at = ${lead.updatedAt}
    where id = ${lead.id}
  `;
}

async function insertFollowups(followups: Followup[]) {
  if (!followups.length) return;
  const sql = getSql();

  await sql`
    insert into followups (
      id, lead_id, followup_date, followup_type, outcome, next_followup_date, remarks, created_by, created_at
    )
    select
      x."id",
      x."leadId",
      nullif(x."followupDate", '')::date,
      coalesce(x."followupType", 'Call'),
      coalesce(x."outcome", 'Call Back Later'),
      nullif(x."nextFollowupDate", '')::date,
      coalesce(x."remarks", ''),
      coalesce(x."createdBy", 'captain'),
      coalesce(nullif(x."createdAt", '')::timestamptz, now())
    from jsonb_to_recordset(${JSON.stringify(followups)}::jsonb) as x(
      "id" text,
      "leadId" text,
      "followupDate" text,
      "followupType" text,
      "outcome" text,
      "nextFollowupDate" text,
      "remarks" text,
      "createdBy" text,
      "createdAt" text
    )
    on conflict (id) do nothing
  `;
}

async function insertLogs(logs: ActivityLog[]) {
  if (!logs.length) return;
  const sql = getSql();

  await sql`
    insert into activity_logs (
      id, lead_id, action, old_value, new_value, created_by, created_at
    )
    select
      x."id",
      x."leadId",
      coalesce(x."action", ''),
      coalesce(x."oldValue", ''),
      coalesce(x."newValue", ''),
      coalesce(x."createdBy", 'captain'),
      coalesce(nullif(x."createdAt", '')::timestamptz, now())
    from jsonb_to_recordset(${JSON.stringify(logs)}::jsonb) as x(
      "id" text,
      "leadId" text,
      "action" text,
      "oldValue" text,
      "newValue" text,
      "createdBy" text,
      "createdAt" text
    )
    on conflict (id) do nothing
  `;
}

function buildLog(leadId: string, action: string, oldValue: string, newValue: string): ActivityLog {
  return {
    id: createId("log"),
    leadId,
    action,
    oldValue,
    newValue,
    createdBy: "captain",
    createdAt: new Date().toISOString(),
  };
}

function buildChangeLogs(existing: Lead, updated: Lead) {
  const watched: Array<[keyof Lead, string]> = [
    ["leadStage", "Stage updated"],
    ["leadTemperature", "Temperature updated"],
    ["nextFollowupDate", "Next follow-up updated"],
    ["remarks", "Remarks updated"],
  ];

  return watched
    .filter(([key]) => String(existing[key] || "") !== String(updated[key] || ""))
    .map(([key, action]) =>
      buildLog(existing.id, action, String(existing[key] || ""), String(updated[key] || "")),
    );
}

function inferLeadStageFromOutcome(
  outcome: Followup["outcome"],
  currentStage: Lead["leadStage"] = "Follow-up Needed",
): Lead["leadStage"] {
  if (outcome === "Converted") return "Won";
  if (outcome === "Rejected") return "Rejected";
  if (outcome === "No Response") return "No Response";
  if (outcome === "Details Sent") return "Details Sent";
  if (outcome === "Proposal Requested") return "Proposal Sent";
  if (outcome === "Interested" || outcome === "Call Back Later") return "Follow-up Needed";
  return currentStage;
}

function mapLead(row: Record<string, unknown>): Lead {
  return {
    id: text(row.id),
    leadUrl: text(row.lead_url),
    leadName: text(row.lead_name),
    businessName: text(row.business_name),
    contactPerson: text(row.contact_person),
    phone: text(row.phone),
    email: text(row.email),
    industry: text(row.industry),
    location: text(row.location),
    source: text(row.source),
    leadTemperature: text(row.lead_temperature) as Lead["leadTemperature"],
    leadStage: text(row.lead_stage) as Lead["leadStage"],
    serviceInterest: text(row.service_interest) as Lead["serviceInterest"],
    expectedValue: Number(row.expected_value || 0),
    objectionReason: text(row.objection_reason) as Lead["objectionReason"],
    firstContactDate: dateText(row.first_contact_date),
    nextFollowupDate: dateText(row.next_followup_date),
    remarks: text(row.remarks),
    assignedTo: text(row.assigned_to),
    isArchived: Boolean(row.is_archived),
    createdAt: isoText(row.created_at),
    updatedAt: isoText(row.updated_at),
  };
}

function mapFollowup(row: Record<string, unknown>): Followup {
  return {
    id: text(row.id),
    leadId: text(row.lead_id),
    followupDate: dateText(row.followup_date),
    followupType: text(row.followup_type) as Followup["followupType"],
    outcome: text(row.outcome) as Followup["outcome"],
    nextFollowupDate: dateText(row.next_followup_date),
    remarks: text(row.remarks),
    createdBy: text(row.created_by),
    createdAt: isoText(row.created_at),
  };
}

function mapActivityLog(row: Record<string, unknown>): ActivityLog {
  return {
    id: text(row.id),
    leadId: text(row.lead_id),
    action: text(row.action),
    oldValue: text(row.old_value),
    newValue: text(row.new_value),
    createdBy: text(row.created_by),
    createdAt: isoText(row.created_at),
  };
}

function dateOrNull(value: string) {
  return value || null;
}

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function dateText(value: unknown) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function isoText(value: unknown) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
