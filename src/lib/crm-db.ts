import "server-only";

import { neon } from "@neondatabase/serverless";
import {
  formatFollowupDelay,
  getNextFollowupDateForLead,
  getNextFollowupDateForNewFollowup,
  getScheduledNextDateForFollowup,
  getWorkingDayDelta,
  sortFollowups,
} from "@/lib/followup-schedule";
import { findImportDuplicate } from "@/lib/import-dedupe";
import { DEFAULT_ASSIGNEE } from "@/lib/constants";
import { normalizeLeadForStorage } from "@/lib/lead-normalization";
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
  PosterSlot,
  PosterSlotDraft,
  StudioClient,
  StudioClientDraft,
  StudioProject,
  StudioProjectDraft,
  StudioSetting,
  StudioSettingDraft,
} from "@/lib/types";
import { createId, dateOnlyText, offsetDate, todayIso } from "@/lib/utils";

type SqlClient = ReturnType<typeof neon>;

let sqlClient: SqlClient | null = null;
let schemaPromise: Promise<void> | null = null;
let scheduleRefreshPromise: Promise<void> | null = null;
let leadDataNormalizationPromise: Promise<void> | null = null;
let wonLeadClientSyncPromise: Promise<void> | null = null;
let settingsSeedPromise: Promise<void> | null = null;

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
  await seedSettingsIfEmptyOnce();
  await normalizeAllLeadDataOnce();
  await refreshAllFollowupSchedulesOnce();
  await syncWonLeadsToClientsOnce();
  return readCrmState();
}

export async function addLeadRecord(leadDraft: LeadDraft) {
  await ensureCrmSchema();

  const now = new Date().toISOString();
  const lead: Lead = applyLeadSchedule(
    normalizeLeadForStorage({
      ...leadDraft,
      id: createId("lead"),
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    }),
    [],
  );
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

  const updated: Lead = normalizeLeadForStorage({
    ...existing,
    ...changes,
    updatedAt: new Date().toISOString(),
  });
  const followups = await getFollowupsByLeadId(id);
  const scheduledUpdated = applyLeadSchedule(updated, followups);
  const logs = buildChangeLogs(existing, scheduledUpdated);

  await updateLead(scheduledUpdated);
  if (scheduledUpdated.leadStage === "Won") {
    await ensureClientForWonLead(scheduledUpdated);
  }
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

export async function logLeadActivityRecord(
  leadId: string,
  action: string,
  newValue = "",
) {
  await ensureCrmSchema();

  const lead = await getLeadById(leadId);
  if (!lead) return { state: await readCrmState() };

  await insertLogs([buildLog(leadId, action, "", newValue)]);
  return { state: await readCrmState() };
}

export async function addClientRecord(draft: StudioClientDraft) {
  await ensureCrmSchema();

  const client = buildClientFromDraft(draft);
  await insertClient(client);

  return { id: client.id, state: await readCrmState() };
}

export async function updateClientRecord(id: string, changes: Partial<StudioClientDraft>) {
  await ensureCrmSchema();

  const existing = await getClientById(id);
  if (!existing) return { state: await readCrmState() };

  await updateClient({
    ...existing,
    ...changes,
    updatedAt: new Date().toISOString(),
  });

  return { state: await readCrmState() };
}

export async function deleteClientRecord(id: string) {
  await ensureCrmSchema();
  const sql = getSql();
  await sql`delete from clients where id = ${id}`;
  return { state: await readCrmState(sql) };
}

export async function addProjectRecord(draft: StudioProjectDraft) {
  await ensureCrmSchema();

  const project = buildProjectFromDraft(draft);
  await insertProject(project);

  return { id: project.id, state: await readCrmState() };
}

export async function updateProjectRecord(id: string, changes: Partial<StudioProjectDraft>) {
  await ensureCrmSchema();

  const existing = await getProjectById(id);
  if (!existing) return { state: await readCrmState() };

  await updateProject({
    ...existing,
    ...changes,
    updatedAt: new Date().toISOString(),
  });

  return { state: await readCrmState() };
}

export async function deleteProjectRecord(id: string) {
  await ensureCrmSchema();
  const sql = getSql();
  await sql`delete from projects where id = ${id}`;
  return { state: await readCrmState(sql) };
}

export async function addPosterSlotRecord(draft: PosterSlotDraft) {
  await ensureCrmSchema();

  const slot = buildPosterSlotFromDraft(draft);
  await insertPosterSlots([slot]);

  return { id: slot.id, state: await readCrmState() };
}

export async function updatePosterSlotRecord(id: string, changes: Partial<PosterSlotDraft>) {
  await ensureCrmSchema();

  const existing = await getPosterSlotById(id);
  if (!existing) return { state: await readCrmState() };

  await updatePosterSlot({
    ...existing,
    ...changes,
    updatedAt: new Date().toISOString(),
  });

  return { state: await readCrmState() };
}

export async function deletePosterSlotRecord(id: string) {
  await ensureCrmSchema();
  const sql = getSql();
  await sql`delete from poster_slots where id = ${id}`;
  return { state: await readCrmState(sql) };
}

export async function generatePosterSlotsRecord(projectId: string, month: string) {
  await ensureCrmSchema();

  const project = await getProjectById(projectId);
  if (!project) return { state: await readCrmState() };

  const slots = await buildGeneratedPosterSlots(project, month);
  await insertPosterSlots(slots);

  return { generated: slots.length, state: await readCrmState() };
}

export async function addStudioSettingRecord(draft: StudioSettingDraft) {
  await ensureCrmSchema();

  const setting = buildSettingFromDraft(draft);
  await insertSettings([setting]);

  return { id: setting.id, state: await readCrmState() };
}

export async function updateStudioSettingRecord(id: string, changes: Partial<StudioSettingDraft>) {
  await ensureCrmSchema();

  const existing = await getSettingById(id);
  if (!existing) return { state: await readCrmState() };

  await updateSetting({
    ...existing,
    ...changes,
    updatedAt: new Date().toISOString(),
  });

  return { state: await readCrmState() };
}

export async function deleteStudioSettingRecord(id: string) {
  await ensureCrmSchema();
  const sql = getSql();
  await sql`delete from studio_settings where id = ${id}`;
  return { state: await readCrmState(sql) };
}

export async function addFollowupRecord(draft: FollowupDraft) {
  await ensureCrmSchema();

  const now = new Date().toISOString();
  const lead = await getLeadById(draft.leadId);
  const existingFollowups = await getFollowupsByLeadId(draft.leadId);
  const scheduledFollowupDate = draft.scheduledFollowupDate || lead?.nextFollowupDate || draft.followupDate;
  const markedAt = draft.markedAt || now;
  const nextFollowupDate = lead
    ? getNextFollowupDateForNewFollowup(
        lead,
        existingFollowups,
        draft.followupDate,
        draft.outcome,
      )
    : draft.nextFollowupDate;
  const followup: Followup = {
    ...draft,
    scheduledFollowupDate,
    markedAt,
    nextFollowupDate,
    id: createId("followup"),
    createdAt: now,
  };
  const inferredStage = inferLeadStageFromOutcome(draft.outcome, lead?.leadStage);

  const sql = getSql();
  await insertFollowups([followup]);

  if (lead) {
    const updatedLead: Lead = {
      ...lead,
      leadStage: inferredStage,
      nextFollowupDate,
      updatedAt: new Date().toISOString(),
    };
    await updateLead(updatedLead);
    if (updatedLead.leadStage === "Won") {
      await ensureClientForWonLead(updatedLead);
    }
  }

  await insertLogs([
    buildLog(
      draft.leadId,
      "Follow-up added",
      scheduledFollowupDate,
      `${draft.outcome} - actual ${draft.followupDate} - marked ${markedAt.slice(0, 10)} - ${formatFollowupDelay(getWorkingDayDelta(scheduledFollowupDate, draft.followupDate))}`,
    ),
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

  const updated: Followup = {
    ...existing,
    ...changes,
    scheduledFollowupDate: changes.scheduledFollowupDate || existing.scheduledFollowupDate || existing.followupDate,
    markedAt: changes.markedAt || existing.markedAt || existing.createdAt,
    nextFollowupDate: existing.nextFollowupDate,
  };
  await sql`
    update followups
    set
      lead_id = ${updated.leadId},
      scheduled_followup_date = ${dateOrNull(updated.scheduledFollowupDate)},
      followup_date = ${dateOrNull(updated.followupDate)},
      followup_type = ${updated.followupType},
      outcome = ${updated.outcome},
      next_followup_date = ${dateOrNull(updated.nextFollowupDate)},
      remarks = ${updated.remarks},
      created_by = ${updated.createdBy},
      marked_at = ${dateOrNull(updated.markedAt)}
    where id = ${id}
  `;

  await rescheduleLeadFollowups(updated.leadId);
  if (existing.leadId !== updated.leadId) await rescheduleLeadFollowups(existing.leadId);

  await insertLogs([
    buildLog(updated.leadId, "Follow-up updated", existing.outcome, updated.outcome),
  ]);

  return { state: await readCrmState(sql) };
}

export async function importLegacyRowsRecord(rows: ImportPreviewRow[]): Promise<ImportSummary> {
  await ensureCrmSchema();

  const now = new Date().toISOString();
  const existingState = await readCrmState();
  const matchingPool = [...existingState.leads];
  const logs: ActivityLog[] = [];
  let leadsCreated = 0;
  let leadsUpdated = 0;
  let followupsImported = 0;

  for (const row of rows) {
    const duplicate = findImportDuplicate(row.lead, matchingPool);
    const existingLead = duplicate
      ? matchingPool.find((lead) => lead.id === duplicate.leadId) || null
      : null;
    const baseLead = normalizeLeadForStorage(
      {
        ...row.lead,
        id: existingLead?.id || createId("lead"),
        isArchived: existingLead?.isArchived || false,
        createdAt: existingLead?.createdAt || now,
        updatedAt: now,
      },
      { preferUrlSource: true, sourceFallback: "CSV Import" },
    );
    const mergedLead = existingLead ? mergeImportedLead(existingLead, baseLead, now) : baseLead;
    const existingFollowups = existingLead ? await getFollowupsByLeadId(existingLead.id) : [];
    const importedRowFollowups: Followup[] = row.followups.map((followup) => ({
      ...followup,
      id: createId("followup"),
      leadId: mergedLead.id,
      scheduledFollowupDate: followup.scheduledFollowupDate || followup.followupDate,
      markedAt: followup.markedAt || now,
      createdAt: now,
    }));
    const importedFollowupIds = new Set(importedRowFollowups.map((followup) => followup.id));
    const scheduled = applyScheduleToLeadAndFollowups(mergedLead, [
      ...existingFollowups,
      ...importedRowFollowups,
    ]);
    const scheduledImportedFollowups = scheduled.followups.filter((followup) =>
      importedFollowupIds.has(followup.id),
    );

    if (existingLead) {
      await updateLead(scheduled.lead);
      await writeScheduleChanges(scheduled, existingLead, existingFollowups);
      logs.push(buildLog(scheduled.lead.id, "Lead updated from CSV import", duplicate?.reason || "", scheduled.lead.leadStage));
      leadsUpdated += 1;
    } else {
      await insertLead(scheduled.lead);
      logs.push(buildLog(scheduled.lead.id, "Lead imported from CSV", "", scheduled.lead.leadStage));
      leadsCreated += 1;
    }

    await insertFollowups(scheduledImportedFollowups);
    followupsImported += scheduledImportedFollowups.length;

    const poolIndex = matchingPool.findIndex((lead) => lead.id === scheduled.lead.id);
    if (poolIndex >= 0) matchingPool[poolIndex] = scheduled.lead;
    else matchingPool.push(scheduled.lead);
  }

  await insertLogs(logs);

  return {
    leadsImported: leadsCreated + leadsUpdated,
    leadsCreated,
    leadsUpdated,
    duplicateMatches: leadsUpdated,
    followupsImported,
    skippedRows: Math.max(rows.length - leadsCreated - leadsUpdated, 0),
  };
}

function mergeImportedLead(existing: Lead, imported: Lead, now: string): Lead {
  return normalizeLeadForStorage(
    {
      ...existing,
      leadUrl: preferImported(imported.leadUrl, existing.leadUrl),
      leadName: preferImported(imported.leadName, existing.leadName),
      businessName: preferImported(imported.businessName, existing.businessName),
      contactPerson: preferImported(imported.contactPerson, existing.contactPerson),
      phone: preferImported(imported.phone, existing.phone),
      email: preferImported(imported.email, existing.email),
      industry: preferImported(imported.industry, existing.industry),
      location: preferImported(imported.location, existing.location),
      source: preferImported(imported.source, existing.source),
      leadTemperature: imported.leadTemperature || existing.leadTemperature,
      leadStage: imported.leadStage || existing.leadStage,
      serviceInterest: imported.serviceInterest || existing.serviceInterest,
      expectedValue: Number(imported.expectedValue || existing.expectedValue || 0),
      objectionReason: imported.objectionReason || existing.objectionReason,
      firstContactDate: preferImported(imported.firstContactDate, existing.firstContactDate),
      nextFollowupDate: imported.nextFollowupDate || existing.nextFollowupDate,
      remarks: preferImported(imported.remarks, existing.remarks),
      assignedTo: preferImported(imported.assignedTo, existing.assignedTo),
      id: existing.id,
      isArchived: existing.isArchived,
      createdAt: existing.createdAt,
      updatedAt: now,
    },
    { preferUrlSource: true, sourceFallback: "CSV Import" },
  );
}

function preferImported(imported: string, existing: string) {
  return imported.trim() ? imported : existing;
}

export async function resetCrmFromPrivateSeed() {
  await ensureCrmSchema();
  const sql = getSql();
  await sql`delete from poster_slots`;
  await sql`delete from projects`;
  await sql`delete from clients`;
  await sql`delete from leads`;
  await seedDatabaseIfEmpty();
  await seedSettingsIfEmptyOnce();
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
      assigned_to text not null default 'Naveen',
      is_archived boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`alter table leads alter column assigned_to set default 'Naveen'`;

  await sql`
    create table if not exists followups (
      id text primary key,
      lead_id text not null references leads(id) on delete cascade,
      scheduled_followup_date date,
      followup_date date not null,
      followup_type text not null,
      outcome text not null,
      next_followup_date date,
      remarks text not null default '',
      created_by text not null default 'captain',
      marked_at timestamptz,
      created_at timestamptz not null default now()
    )
  `;

  await sql`alter table followups add column if not exists scheduled_followup_date date`;
  await sql`alter table followups add column if not exists marked_at timestamptz`;
  await sql`
    update followups
    set scheduled_followup_date = followup_date
    where scheduled_followup_date is null
  `;
  await sql`
    update followups
    set marked_at = created_at
    where marked_at is null
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

  await sql`
    create table if not exists clients (
      id text primary key,
      lead_id text unique references leads(id) on delete set null,
      client_name text not null default '',
      contact_person text not null default '',
      phone text not null default '',
      email text not null default '',
      industry text not null default '',
      location text not null default '',
      package_name text not null default '30 Poster Package',
      monthly_value numeric(12, 2) not null default 0,
      owner text not null default 'Naveen',
      status text not null default 'Active',
      payment_status text not null default 'Not Started',
      start_date date,
      renewal_date date,
      notes text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`alter table clients add column if not exists payment_status text not null default 'Not Started'`;

  await sql`
    create table if not exists projects (
      id text primary key,
      client_id text not null references clients(id) on delete cascade,
      project_name text not null default '',
      project_type text not null default 'Poster Package',
      status text not null default 'Planning',
      designer text not null default 'Naveen',
      monthly_poster_target integer not null default 0,
      posters_completed integer not null default 0,
      due_date date,
      notes text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists poster_slots (
      id text primary key,
      project_id text not null references projects(id) on delete cascade,
      client_id text not null references clients(id) on delete cascade,
      title text not null default '',
      slot_date date not null,
      designer text not null default 'Naveen',
      status text not null default 'Planned',
      caption_required boolean not null default true,
      notes text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists studio_settings (
      id text primary key,
      category text not null,
      label text not null,
      value text not null default '',
      is_active boolean not null default true,
      notes text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`create index if not exists leads_stage_idx on leads (lead_stage)`;
  await sql`create index if not exists leads_temperature_idx on leads (lead_temperature)`;
  await sql`create index if not exists leads_next_followup_idx on leads (next_followup_date)`;
  await sql`create index if not exists followups_lead_date_idx on followups (lead_id, followup_date desc)`;
  await sql`create index if not exists followups_scheduled_date_idx on followups (lead_id, scheduled_followup_date desc)`;
  await sql`create index if not exists clients_lead_idx on clients (lead_id)`;
  await sql`create index if not exists clients_status_idx on clients (status)`;
  await sql`create index if not exists clients_renewal_idx on clients (renewal_date)`;
  await sql`create index if not exists projects_client_idx on projects (client_id)`;
  await sql`create index if not exists projects_status_idx on projects (status)`;
  await sql`create index if not exists projects_due_idx on projects (due_date)`;
  await sql`create index if not exists poster_slots_project_idx on poster_slots (project_id)`;
  await sql`create index if not exists poster_slots_client_idx on poster_slots (client_id)`;
  await sql`create index if not exists poster_slots_date_idx on poster_slots (slot_date)`;
  await sql`create index if not exists poster_slots_status_idx on poster_slots (status)`;
  await sql`create index if not exists studio_settings_category_idx on studio_settings (category)`;
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
  const [leadRows, followupRows, activityRows, clientRows, projectRows, posterRows, settingRows] = (await Promise.all([
    sql`select * from leads order by created_at desc`,
    sql`select * from followups order by created_at desc`,
    sql`select * from activity_logs order by created_at desc`,
    sql`select * from clients order by created_at desc`,
    sql`select * from projects order by created_at desc`,
    sql`select * from poster_slots order by slot_date asc, created_at asc`,
    sql`select * from studio_settings order by category asc, label asc`,
  ])) as [
    Array<Record<string, unknown>>,
    Array<Record<string, unknown>>,
    Array<Record<string, unknown>>,
    Array<Record<string, unknown>>,
    Array<Record<string, unknown>>,
    Array<Record<string, unknown>>,
    Array<Record<string, unknown>>,
  ];

  return {
    leads: leadRows.map(mapLead),
    followups: followupRows.map(mapFollowup),
    activityLogs: activityRows.map(mapActivityLog),
    clients: clientRows.map(mapClient),
    projects: projectRows.map(mapProject),
    posterSlots: posterRows.map(mapPosterSlot),
    settings: settingRows.map(mapSetting),
  };
}

async function getLeadById(id: string) {
  const sql = getSql();
  const rows = (await sql`select * from leads where id = ${id} limit 1`) as Array<
    Record<string, unknown>
  >;
  return rows[0] ? mapLead(rows[0]) : null;
}

async function getFollowupsByLeadId(leadId: string) {
  const sql = getSql();
  const rows = (await sql`
    select * from followups
    where lead_id = ${leadId}
    order by followup_date asc, created_at asc
  `) as Array<Record<string, unknown>>;

  return rows.map(mapFollowup);
}

async function getClientById(id: string) {
  const sql = getSql();
  const rows = (await sql`select * from clients where id = ${id} limit 1`) as Array<
    Record<string, unknown>
  >;
  return rows[0] ? mapClient(rows[0]) : null;
}

async function getProjectById(id: string) {
  const sql = getSql();
  const rows = (await sql`select * from projects where id = ${id} limit 1`) as Array<
    Record<string, unknown>
  >;
  return rows[0] ? mapProject(rows[0]) : null;
}

async function getPosterSlotById(id: string) {
  const sql = getSql();
  const rows = (await sql`select * from poster_slots where id = ${id} limit 1`) as Array<
    Record<string, unknown>
  >;
  return rows[0] ? mapPosterSlot(rows[0]) : null;
}

async function getSettingById(id: string) {
  const sql = getSql();
  const rows = (await sql`select * from studio_settings where id = ${id} limit 1`) as Array<
    Record<string, unknown>
  >;
  return rows[0] ? mapSetting(rows[0]) : null;
}

async function refreshAllFollowupSchedules() {
  const sql = getSql();
  const [leadRows, followupRows] = (await Promise.all([
    sql`select * from leads`,
    sql`select * from followups order by followup_date asc, created_at asc`,
  ])) as [Array<Record<string, unknown>>, Array<Record<string, unknown>>];
  const leads = leadRows.map(mapLead);
  const followups = followupRows.map(mapFollowup);
  const followupsByLead = new Map<string, Followup[]>();

  followups.forEach((followup) => {
    const current = followupsByLead.get(followup.leadId) || [];
    followupsByLead.set(followup.leadId, [...current, followup]);
  });

  for (const lead of leads) {
    const leadFollowups = followupsByLead.get(lead.id) || [];
    await writeScheduleChanges(
      applyScheduleToLeadAndFollowups(lead, leadFollowups),
      lead,
      leadFollowups,
    );
  }
}

async function refreshAllFollowupSchedulesOnce() {
  scheduleRefreshPromise ??= refreshAllFollowupSchedules().catch((error) => {
    scheduleRefreshPromise = null;
    throw error;
  });

  return scheduleRefreshPromise;
}

async function normalizeAllLeadData() {
  const sql = getSql();
  const rows = (await sql`select * from leads`) as Array<Record<string, unknown>>;
  const leads = rows.map(mapLead);

  for (const lead of leads) {
    const normalized = normalizeLeadForStorage(lead, {
      preferUrlSource: true,
      sourceFallback: "Other",
    });
    const needsUpdate =
      normalized.assignedTo !== lead.assignedTo ||
      normalized.industry !== lead.industry ||
      normalized.source !== lead.source;

    if (needsUpdate) {
      await updateLead({ ...normalized, updatedAt: new Date().toISOString() });
    }
  }
}

async function normalizeAllLeadDataOnce() {
  leadDataNormalizationPromise ??= normalizeAllLeadData().catch((error) => {
    leadDataNormalizationPromise = null;
    throw error;
  });

  return leadDataNormalizationPromise;
}

async function seedSettingsIfEmpty() {
  const sql = getSql();
  const [{ count }] = (await sql`select count(*)::int as count from studio_settings`) as Array<{
    count: number;
  }>;
  if (Number(count) > 0) return;

  await insertSettings(defaultStudioSettings());
}

async function seedSettingsIfEmptyOnce() {
  settingsSeedPromise ??= seedSettingsIfEmpty().catch((error) => {
    settingsSeedPromise = null;
    throw error;
  });

  return settingsSeedPromise;
}

async function syncWonLeadsToClients() {
  const sql = getSql();
  const rows = (await sql`select * from leads where lead_stage = 'Won'`) as Array<
    Record<string, unknown>
  >;
  const wonLeads = rows.map(mapLead);

  for (const lead of wonLeads) {
    await ensureClientForWonLead(lead);
  }
}

async function syncWonLeadsToClientsOnce() {
  wonLeadClientSyncPromise ??= syncWonLeadsToClients().catch((error) => {
    wonLeadClientSyncPromise = null;
    throw error;
  });

  return wonLeadClientSyncPromise;
}

async function ensureClientForWonLead(lead: Lead) {
  const sql = getSql();
  const rows = (await sql`select * from clients where lead_id = ${lead.id} limit 1`) as Array<
    Record<string, unknown>
  >;
  const existing = rows[0] ? mapClient(rows[0]) : null;
  const clientDraft = clientDraftFromLead(lead);

  if (existing) {
    const updatedClient: StudioClient = {
      ...existing,
      ...clientDraft,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await updateClient(updatedClient);
    await ensureStarterProjectForClient(updatedClient);
    return updatedClient;
  }

  const client = buildClientFromDraft(clientDraft);
  await insertClient(client);
  await insertLogs([buildLog(lead.id, "Client created from won lead", "", client.clientName)]);
  await ensureStarterProjectForClient(client);
  return client;
}

async function ensureStarterProjectForClient(client: StudioClient) {
  const sql = getSql();
  const rows = (await sql`select count(*)::int as count from projects where client_id = ${client.id}`) as Array<{
    count: number;
  }>;
  if (Number(rows[0]?.count || 0) > 0) return;

  await insertProject(projectFromClient(client));
}

async function buildGeneratedPosterSlots(project: StudioProject, month: string) {
  const normalizedMonth = /^\d{4}-\d{2}$/.test(month) ? month : todayIso().slice(0, 7);
  const sql = getSql();
  const rows = (await sql`
    select slot_date from poster_slots
    where project_id = ${project.id}
      and to_char(slot_date, 'YYYY-MM') = ${normalizedMonth}
  `) as Array<{ slot_date: unknown }>;
  const existingDates = new Set(rows.map((row) => dateText(row.slot_date)));
  const dates = getPosterSlotDates(normalizedMonth, project.monthlyPosterTarget || 30)
    .filter((date) => !existingDates.has(date));
  const clientId = project.clientId;

  return dates.map((slotDate, index) =>
    buildPosterSlotFromDraft({
      projectId: project.id,
      clientId,
      title: `${project.projectName || "Poster Package"} - Poster ${String(existingDates.size + index + 1).padStart(2, "0")}`,
      slotDate,
      designer: project.designer || DEFAULT_ASSIGNEE,
      status: "Planned",
      captionRequired: true,
      notes: "Generated monthly poster slot.",
    }),
  );
}

function getPosterSlotDates(month: string, target: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return [];

  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0, 12)).getUTCDate();
  const clampedTarget = Math.min(Math.max(target || 30, 1), daysInMonth);
  const step = daysInMonth / clampedTarget;
  const used = new Set<number>();

  return Array.from({ length: clampedTarget }, (_, index) => {
    let day = Math.min(daysInMonth, Math.max(1, Math.floor(index * step) + 1));
    while (used.has(day) && day < daysInMonth) day += 1;
    used.add(day);
    return `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  });
}

async function rescheduleLeadFollowups(leadId: string) {
  const lead = await getLeadById(leadId);
  if (!lead) return;

  const followups = await getFollowupsByLeadId(leadId);
  await writeScheduleChanges(applyScheduleToLeadAndFollowups(lead, followups), lead, followups);
}

async function writeScheduleChanges({
  lead,
  followups,
}: {
  lead: Lead;
  followups: Followup[];
}, currentLead?: Lead | null, currentFollowups: Followup[] = []) {
  const sql = getSql();
  const currentLeadRecord = currentLead === undefined ? await getLeadById(lead.id) : currentLead;

  if (currentLeadRecord && currentLeadRecord.nextFollowupDate !== lead.nextFollowupDate) {
    await sql`
      update leads
      set next_followup_date = ${dateOrNull(lead.nextFollowupDate)}, updated_at = ${new Date().toISOString()}
      where id = ${lead.id}
    `;
  }

  const currentFollowupById = new Map(currentFollowups.map((followup) => [followup.id, followup]));
  for (const followup of followups) {
    const currentFollowup = currentFollowupById.get(followup.id);
    if (currentFollowup?.nextFollowupDate === followup.nextFollowupDate) continue;

    await sql`
      update followups
      set next_followup_date = ${dateOrNull(followup.nextFollowupDate)}
      where id = ${followup.id}
        and coalesce(next_followup_date::text, '') <> ${followup.nextFollowupDate}
    `;
  }
}

function applyLeadSchedule(lead: Lead, followups: Followup[]) {
  return {
    ...lead,
    nextFollowupDate: getNextFollowupDateForLead(lead, followups),
  };
}

function applyScheduleToLeadAndFollowups(lead: Lead, followups: Followup[]) {
  const sortedFollowups = sortFollowups(followups);
  const scheduledFollowups = sortedFollowups.map((followup, index) => ({
    ...followup,
    nextFollowupDate: getScheduledNextDateForFollowup(followup, index),
  }));

  return {
    lead: applyLeadSchedule(lead, scheduledFollowups),
    followups: scheduledFollowups,
  };
}

async function insertLead(lead: Lead) {
  const sql = getSql();
  const normalizedLead = normalizeLeadForStorage(lead);
  await sql`
    insert into leads (
      id, lead_url, lead_name, business_name, contact_person, phone, email, industry, location,
      source, lead_temperature, lead_stage, service_interest, expected_value, objection_reason,
      first_contact_date, next_followup_date, remarks, assigned_to, is_archived, created_at, updated_at
    )
    values (
      ${normalizedLead.id}, ${normalizedLead.leadUrl}, ${normalizedLead.leadName}, ${normalizedLead.businessName}, ${normalizedLead.contactPerson},
      ${normalizedLead.phone}, ${normalizedLead.email}, ${normalizedLead.industry}, ${normalizedLead.location}, ${normalizedLead.source},
      ${normalizedLead.leadTemperature}, ${normalizedLead.leadStage}, ${normalizedLead.serviceInterest}, ${normalizedLead.expectedValue},
      ${normalizedLead.objectionReason}, ${dateOrNull(normalizedLead.firstContactDate)}, ${dateOrNull(normalizedLead.nextFollowupDate)},
      ${normalizedLead.remarks}, ${normalizedLead.assignedTo}, ${normalizedLead.isArchived}, ${normalizedLead.createdAt}, ${normalizedLead.updatedAt}
    )
  `;
}

async function insertLeads(leads: Lead[]) {
  if (!leads.length) return;
  const sql = getSql();
  const normalizedLeads = leads.map((lead) =>
    normalizeLeadForStorage(lead, { preferUrlSource: true }),
  );

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
      coalesce(x."assignedTo", ${DEFAULT_ASSIGNEE}),
      coalesce(x."isArchived", false),
      coalesce(nullif(x."createdAt", '')::timestamptz, now()),
      coalesce(nullif(x."updatedAt", '')::timestamptz, now())
    from jsonb_to_recordset(${JSON.stringify(normalizedLeads)}::jsonb) as x(
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
  const normalizedLead = normalizeLeadForStorage(lead);

  await sql`
    update leads
    set
      lead_url = ${normalizedLead.leadUrl},
      lead_name = ${normalizedLead.leadName},
      business_name = ${normalizedLead.businessName},
      contact_person = ${normalizedLead.contactPerson},
      phone = ${normalizedLead.phone},
      email = ${normalizedLead.email},
      industry = ${normalizedLead.industry},
      location = ${normalizedLead.location},
      source = ${normalizedLead.source},
      lead_temperature = ${normalizedLead.leadTemperature},
      lead_stage = ${normalizedLead.leadStage},
      service_interest = ${normalizedLead.serviceInterest},
      expected_value = ${normalizedLead.expectedValue},
      objection_reason = ${normalizedLead.objectionReason},
      first_contact_date = ${dateOrNull(normalizedLead.firstContactDate)},
      next_followup_date = ${dateOrNull(normalizedLead.nextFollowupDate)},
      remarks = ${normalizedLead.remarks},
      assigned_to = ${normalizedLead.assignedTo},
      is_archived = ${normalizedLead.isArchived},
      updated_at = ${normalizedLead.updatedAt}
    where id = ${normalizedLead.id}
  `;
}

async function insertClient(client: StudioClient) {
  const sql = getSql();

  await sql`
    insert into clients (
      id, lead_id, client_name, contact_person, phone, email, industry, location,
      package_name, monthly_value, owner, status, payment_status, start_date, renewal_date,
      notes, created_at, updated_at
    )
    values (
      ${client.id}, ${client.leadId || null}, ${client.clientName}, ${client.contactPerson},
      ${client.phone}, ${client.email}, ${client.industry}, ${client.location}, ${client.packageName},
      ${client.monthlyValue}, ${client.owner}, ${client.status}, ${client.paymentStatus},
      ${dateOrNull(client.startDate)}, ${dateOrNull(client.renewalDate)}, ${client.notes},
      ${client.createdAt}, ${client.updatedAt}
    )
    on conflict (id) do update
    set
      lead_id = excluded.lead_id,
      client_name = excluded.client_name,
      contact_person = excluded.contact_person,
      phone = excluded.phone,
      email = excluded.email,
      industry = excluded.industry,
      location = excluded.location,
      package_name = excluded.package_name,
      monthly_value = excluded.monthly_value,
      owner = excluded.owner,
      status = excluded.status,
      payment_status = excluded.payment_status,
      start_date = excluded.start_date,
      renewal_date = excluded.renewal_date,
      notes = excluded.notes,
      updated_at = excluded.updated_at
  `;
}

async function updateClient(client: StudioClient) {
  const sql = getSql();

  await sql`
    update clients
    set
      lead_id = ${client.leadId || null},
      client_name = ${client.clientName},
      contact_person = ${client.contactPerson},
      phone = ${client.phone},
      email = ${client.email},
      industry = ${client.industry},
      location = ${client.location},
      package_name = ${client.packageName},
      monthly_value = ${client.monthlyValue},
      owner = ${client.owner},
      status = ${client.status},
      payment_status = ${client.paymentStatus},
      start_date = ${dateOrNull(client.startDate)},
      renewal_date = ${dateOrNull(client.renewalDate)},
      notes = ${client.notes},
      updated_at = ${client.updatedAt}
    where id = ${client.id}
  `;
}

async function insertProject(project: StudioProject) {
  const sql = getSql();

  await sql`
    insert into projects (
      id, client_id, project_name, project_type, status, designer,
      monthly_poster_target, posters_completed, due_date, notes, created_at, updated_at
    )
    values (
      ${project.id}, ${project.clientId}, ${project.projectName}, ${project.projectType},
      ${project.status}, ${project.designer}, ${project.monthlyPosterTarget},
      ${project.postersCompleted}, ${dateOrNull(project.dueDate)}, ${project.notes},
      ${project.createdAt}, ${project.updatedAt}
    )
  `;
}

async function updateProject(project: StudioProject) {
  const sql = getSql();

  await sql`
    update projects
    set
      client_id = ${project.clientId},
      project_name = ${project.projectName},
      project_type = ${project.projectType},
      status = ${project.status},
      designer = ${project.designer},
      monthly_poster_target = ${project.monthlyPosterTarget},
      posters_completed = ${project.postersCompleted},
      due_date = ${dateOrNull(project.dueDate)},
      notes = ${project.notes},
      updated_at = ${project.updatedAt}
    where id = ${project.id}
  `;
}

async function insertPosterSlots(slots: PosterSlot[]) {
  if (!slots.length) return;
  const sql = getSql();

  await sql`
    insert into poster_slots (
      id, project_id, client_id, title, slot_date, designer, status, caption_required,
      notes, created_at, updated_at
    )
    select
      x."id",
      x."projectId",
      x."clientId",
      coalesce(x."title", ''),
      nullif(x."slotDate", '')::date,
      coalesce(x."designer", ${DEFAULT_ASSIGNEE}),
      coalesce(x."status", 'Planned'),
      coalesce(x."captionRequired", true),
      coalesce(x."notes", ''),
      coalesce(nullif(x."createdAt", '')::timestamptz, now()),
      coalesce(nullif(x."updatedAt", '')::timestamptz, now())
    from jsonb_to_recordset(${JSON.stringify(slots)}::jsonb) as x(
      "id" text,
      "projectId" text,
      "clientId" text,
      "title" text,
      "slotDate" text,
      "designer" text,
      "status" text,
      "captionRequired" boolean,
      "notes" text,
      "createdAt" text,
      "updatedAt" text
    )
    on conflict (id) do nothing
  `;
}

async function updatePosterSlot(slot: PosterSlot) {
  const sql = getSql();

  await sql`
    update poster_slots
    set
      project_id = ${slot.projectId},
      client_id = ${slot.clientId},
      title = ${slot.title},
      slot_date = ${dateOrNull(slot.slotDate)},
      designer = ${slot.designer},
      status = ${slot.status},
      caption_required = ${slot.captionRequired},
      notes = ${slot.notes},
      updated_at = ${slot.updatedAt}
    where id = ${slot.id}
  `;
}

async function insertSettings(settings: StudioSetting[]) {
  if (!settings.length) return;
  const sql = getSql();

  await sql`
    insert into studio_settings (
      id, category, label, value, is_active, notes, created_at, updated_at
    )
    select
      x."id",
      x."category",
      x."label",
      coalesce(x."value", ''),
      coalesce(x."isActive", true),
      coalesce(x."notes", ''),
      coalesce(nullif(x."createdAt", '')::timestamptz, now()),
      coalesce(nullif(x."updatedAt", '')::timestamptz, now())
    from jsonb_to_recordset(${JSON.stringify(settings)}::jsonb) as x(
      "id" text,
      "category" text,
      "label" text,
      "value" text,
      "isActive" boolean,
      "notes" text,
      "createdAt" text,
      "updatedAt" text
    )
    on conflict (id) do nothing
  `;
}

async function updateSetting(setting: StudioSetting) {
  const sql = getSql();

  await sql`
    update studio_settings
    set
      category = ${setting.category},
      label = ${setting.label},
      value = ${setting.value},
      is_active = ${setting.isActive},
      notes = ${setting.notes},
      updated_at = ${setting.updatedAt}
    where id = ${setting.id}
  `;
}

async function insertFollowups(followups: Followup[]) {
  if (!followups.length) return;
  const sql = getSql();

  await sql`
    insert into followups (
      id, lead_id, scheduled_followup_date, followup_date, followup_type, outcome, next_followup_date, remarks, created_by, marked_at, created_at
    )
    select
      x."id",
      x."leadId",
      coalesce(nullif(x."scheduledFollowupDate", '')::date, nullif(x."followupDate", '')::date),
      nullif(x."followupDate", '')::date,
      coalesce(x."followupType", 'Call'),
      coalesce(x."outcome", 'Call Back Later'),
      nullif(x."nextFollowupDate", '')::date,
      coalesce(x."remarks", ''),
      coalesce(x."createdBy", 'captain'),
      coalesce(nullif(x."markedAt", '')::timestamptz, nullif(x."createdAt", '')::timestamptz, now()),
      coalesce(nullif(x."createdAt", '')::timestamptz, now())
    from jsonb_to_recordset(${JSON.stringify(followups)}::jsonb) as x(
      "id" text,
      "leadId" text,
      "scheduledFollowupDate" text,
      "followupDate" text,
      "followupType" text,
      "outcome" text,
      "nextFollowupDate" text,
      "remarks" text,
      "createdBy" text,
      "markedAt" text,
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

function buildClientFromDraft(draft: StudioClientDraft): StudioClient {
  const now = new Date().toISOString();
  return {
    ...draft,
    id: createId("client"),
    clientName: draft.clientName || draft.contactPerson || "Untitled client",
    owner: draft.owner || DEFAULT_ASSIGNEE,
    status: draft.status || "Active",
    paymentStatus: draft.paymentStatus || "Not Started",
    monthlyValue: Number(draft.monthlyValue || 0),
    startDate: draft.startDate || todayIso(),
    renewalDate: draft.renewalDate || offsetDate(30),
    createdAt: now,
    updatedAt: now,
  };
}

function buildProjectFromDraft(draft: StudioProjectDraft): StudioProject {
  const now = new Date().toISOString();
  return {
    ...draft,
    id: createId("project"),
    projectName: draft.projectName || "CG Studio Project",
    projectType: draft.projectType || "Poster Package",
    status: draft.status || "Planning",
    designer: draft.designer || DEFAULT_ASSIGNEE,
    monthlyPosterTarget: Number(draft.monthlyPosterTarget || 0),
    postersCompleted: Number(draft.postersCompleted || 0),
    createdAt: now,
    updatedAt: now,
  };
}

function buildPosterSlotFromDraft(draft: PosterSlotDraft): PosterSlot {
  const now = new Date().toISOString();
  return {
    ...draft,
    id: createId("poster"),
    title: draft.title || "Poster slot",
    slotDate: draft.slotDate || todayIso(),
    designer: draft.designer || DEFAULT_ASSIGNEE,
    status: draft.status || "Planned",
    captionRequired: draft.captionRequired ?? true,
    createdAt: now,
    updatedAt: now,
  };
}

function buildSettingFromDraft(draft: StudioSettingDraft): StudioSetting {
  const now = new Date().toISOString();
  return {
    ...draft,
    id: createId("setting"),
    label: draft.label || draft.value || "Untitled setting",
    value: draft.value || draft.label || "",
    isActive: draft.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  };
}

function clientDraftFromLead(lead: Lead): StudioClientDraft {
  return {
    leadId: lead.id,
    clientName: lead.businessName || lead.leadName || lead.contactPerson || "Won lead client",
    contactPerson: lead.contactPerson || lead.leadName,
    phone: lead.phone,
    email: lead.email,
    industry: lead.industry,
    location: lead.location,
    packageName: lead.serviceInterest,
    monthlyValue: lead.expectedValue,
    owner: lead.assignedTo || DEFAULT_ASSIGNEE,
    status: "Active",
    paymentStatus: "Not Started",
    startDate: todayIso(),
    renewalDate: offsetDate(30),
    notes: lead.remarks,
  };
}

function projectFromClient(client: StudioClient): StudioProject {
  return buildProjectFromDraft({
    clientId: client.id,
    projectName: `${client.clientName} - ${client.packageName}`,
    projectType: getProjectTypeFromPackage(client.packageName),
    status: "Planning",
    designer: client.owner || DEFAULT_ASSIGNEE,
    monthlyPosterTarget: getPosterTarget(client.packageName),
    postersCompleted: 0,
    dueDate: client.renewalDate,
    notes: `Created automatically from ${client.packageName}.`,
  });
}

function getProjectTypeFromPackage(packageName: string): StudioProject["projectType"] {
  if (packageName.includes("Branding")) return "Branding";
  if (packageName.includes("Maintenance")) return "Maintenance";
  if (packageName.includes("Creative")) return "One-time Creative";
  return "Poster Package";
}

function getPosterTarget(packageName: string) {
  if (packageName.includes("15")) return 15;
  if (packageName.includes("Poster")) return 30;
  return 0;
}

function defaultStudioSettings() {
  const now = new Date().toISOString();
  const rows: Array<[StudioSetting["category"], string, string]> = [
    ["Package", "30 Poster Package", "5000"],
    ["Package", "15 Posters Monthly Package", "3000"],
    ["Package", "Branding", "Custom"],
    ["Package", "One-time Creative", "Custom"],
    ["Industry", "Restaurant & Food", ""],
    ["Industry", "Healthcare", ""],
    ["Industry", "Real Estate & Interiors", ""],
    ["Industry", "Retail & Boutique", ""],
    ["Team Member", "Naveen", "Sales / Owner"],
    ["Team Member", "Sachin", "Designer"],
    ["Team Member", "Kristom", "Operations"],
    ["Lead Source", "Instagram", ""],
    ["Lead Source", "Facebook", ""],
    ["Lead Source", "Referral", ""],
    ["Lead Status", "Won", ""],
    ["Lead Status", "No Response", ""],
    ["Project Status", "Planning", ""],
    ["Project Status", "In Progress", ""],
    ["Project Status", "Delivered", ""],
  ];

  return rows.map(([category, label, value]) => ({
    id: createId("setting"),
    category,
    label,
    value,
    isActive: true,
    notes: "",
    createdAt: now,
    updatedAt: now,
  }));
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
    scheduledFollowupDate: dateText(row.scheduled_followup_date) || dateText(row.followup_date),
    followupDate: dateText(row.followup_date),
    followupType: text(row.followup_type) as Followup["followupType"],
    outcome: text(row.outcome) as Followup["outcome"],
    nextFollowupDate: dateText(row.next_followup_date),
    remarks: text(row.remarks),
    createdBy: text(row.created_by),
    markedAt: isoText(row.marked_at || row.created_at),
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

function mapClient(row: Record<string, unknown>): StudioClient {
  return {
    id: text(row.id),
    leadId: text(row.lead_id),
    clientName: text(row.client_name),
    contactPerson: text(row.contact_person),
    phone: text(row.phone),
    email: text(row.email),
    industry: text(row.industry),
    location: text(row.location),
    packageName: text(row.package_name) as StudioClient["packageName"],
    monthlyValue: Number(row.monthly_value || 0),
    owner: text(row.owner),
    status: text(row.status) as StudioClient["status"],
    paymentStatus: (text(row.payment_status) || "Not Started") as StudioClient["paymentStatus"],
    startDate: dateText(row.start_date),
    renewalDate: dateText(row.renewal_date),
    notes: text(row.notes),
    createdAt: isoText(row.created_at),
    updatedAt: isoText(row.updated_at),
  };
}

function mapProject(row: Record<string, unknown>): StudioProject {
  return {
    id: text(row.id),
    clientId: text(row.client_id),
    projectName: text(row.project_name),
    projectType: text(row.project_type) as StudioProject["projectType"],
    status: text(row.status) as StudioProject["status"],
    designer: text(row.designer),
    monthlyPosterTarget: Number(row.monthly_poster_target || 0),
    postersCompleted: Number(row.posters_completed || 0),
    dueDate: dateText(row.due_date),
    notes: text(row.notes),
    createdAt: isoText(row.created_at),
    updatedAt: isoText(row.updated_at),
  };
}

function mapPosterSlot(row: Record<string, unknown>): PosterSlot {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    clientId: text(row.client_id),
    title: text(row.title),
    slotDate: dateText(row.slot_date),
    designer: text(row.designer),
    status: text(row.status) as PosterSlot["status"],
    captionRequired: Boolean(row.caption_required),
    notes: text(row.notes),
    createdAt: isoText(row.created_at),
    updatedAt: isoText(row.updated_at),
  };
}

function mapSetting(row: Record<string, unknown>): StudioSetting {
  return {
    id: text(row.id),
    category: text(row.category) as StudioSetting["category"],
    label: text(row.label),
    value: text(row.value),
    isActive: Boolean(row.is_active),
    notes: text(row.notes),
    createdAt: isoText(row.created_at),
    updatedAt: isoText(row.updated_at),
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
  if (value instanceof Date) return dateOnlyText(value);
  return String(value).slice(0, 10);
}

function isoText(value: unknown) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
