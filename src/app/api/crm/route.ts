import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";
import {
  addClientRecord,
  addFollowupRecord,
  addLeadRecord,
  addPosterSlotRecord,
  addProjectRecord,
  addStudioSettingRecord,
  archiveLeadRecord,
  deleteClientRecord,
  deleteLeadRecord,
  deletePosterSlotRecord,
  deleteProjectRecord,
  deleteStudioSettingRecord,
  generatePosterSlotsRecord,
  getCrmState,
  hasDatabaseUrl,
  importLegacyRowsRecord,
  resetCrmFromPrivateSeed,
  updateClientRecord,
  updateFollowupRecord,
  updateLeadRecord,
  updatePosterSlotRecord,
  updateProjectRecord,
  updateStudioSettingRecord,
} from "@/lib/crm-db";
import type {
  FollowupDraft,
  ImportPreviewRow,
  LeadDraft,
  PosterSlotDraft,
  StudioClientDraft,
  StudioProjectDraft,
  StudioSettingDraft,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type CrmAction =
  | { action: "addLead"; lead: LeadDraft }
  | { action: "updateLead"; id: string; changes: Partial<LeadDraft> }
  | { action: "archiveLead"; id: string }
  | { action: "deleteLead"; id: string }
  | { action: "addFollowup"; followup: FollowupDraft }
  | { action: "updateFollowup"; id: string; changes: Partial<FollowupDraft> }
  | { action: "importLegacyRows"; rows: ImportPreviewRow[] }
  | { action: "addClient"; client: StudioClientDraft }
  | { action: "updateClient"; id: string; changes: Partial<StudioClientDraft> }
  | { action: "deleteClient"; id: string }
  | { action: "addProject"; project: StudioProjectDraft }
  | { action: "updateProject"; id: string; changes: Partial<StudioProjectDraft> }
  | { action: "deleteProject"; id: string }
  | { action: "addPosterSlot"; posterSlot: PosterSlotDraft }
  | { action: "updatePosterSlot"; id: string; changes: Partial<PosterSlotDraft> }
  | { action: "deletePosterSlot"; id: string }
  | { action: "generatePosterSlots"; projectId: string; month: string }
  | { action: "addStudioSetting"; setting: StudioSettingDraft }
  | { action: "updateStudioSetting"; id: string; changes: Partial<StudioSettingDraft> }
  | { action: "deleteStudioSetting"; id: string }
  | { action: "resetData" };

export async function GET() {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  try {
    return NextResponse.json(await getCrmState(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as CrmAction | null;
  if (!body?.action) {
    return NextResponse.json({ error: "Missing CRM action." }, { status: 400 });
  }

  try {
    if (body.action === "addLead") {
      return NextResponse.json(await addLeadRecord(body.lead));
    }
    if (body.action === "updateLead") {
      return NextResponse.json(await updateLeadRecord(body.id, body.changes));
    }
    if (body.action === "archiveLead") {
      return NextResponse.json(await archiveLeadRecord(body.id));
    }
    if (body.action === "deleteLead") {
      return NextResponse.json(await deleteLeadRecord(body.id));
    }
    if (body.action === "addFollowup") {
      return NextResponse.json(await addFollowupRecord(body.followup));
    }
    if (body.action === "updateFollowup") {
      return NextResponse.json(await updateFollowupRecord(body.id, body.changes));
    }
    if (body.action === "importLegacyRows") {
      const summary = await importLegacyRowsRecord(body.rows);
      return NextResponse.json({ summary, state: await getCrmState() });
    }
    if (body.action === "addClient") {
      return NextResponse.json(await addClientRecord(body.client));
    }
    if (body.action === "updateClient") {
      return NextResponse.json(await updateClientRecord(body.id, body.changes));
    }
    if (body.action === "deleteClient") {
      return NextResponse.json(await deleteClientRecord(body.id));
    }
    if (body.action === "addProject") {
      return NextResponse.json(await addProjectRecord(body.project));
    }
    if (body.action === "updateProject") {
      return NextResponse.json(await updateProjectRecord(body.id, body.changes));
    }
    if (body.action === "deleteProject") {
      return NextResponse.json(await deleteProjectRecord(body.id));
    }
    if (body.action === "addPosterSlot") {
      return NextResponse.json(await addPosterSlotRecord(body.posterSlot));
    }
    if (body.action === "updatePosterSlot") {
      return NextResponse.json(await updatePosterSlotRecord(body.id, body.changes));
    }
    if (body.action === "deletePosterSlot") {
      return NextResponse.json(await deletePosterSlotRecord(body.id));
    }
    if (body.action === "generatePosterSlots") {
      return NextResponse.json(await generatePosterSlotsRecord(body.projectId, body.month));
    }
    if (body.action === "addStudioSetting") {
      return NextResponse.json(await addStudioSettingRecord(body.setting));
    }
    if (body.action === "updateStudioSetting") {
      return NextResponse.json(await updateStudioSettingRecord(body.id, body.changes));
    }
    if (body.action === "deleteStudioSetting") {
      return NextResponse.json(await deleteStudioSettingRecord(body.id));
    }
    if (body.action === "resetData") {
      return NextResponse.json({ state: await resetCrmFromPrivateSeed() });
    }

    return NextResponse.json({ error: "Unknown CRM action." }, { status: 400 });
  } catch (error) {
    return databaseError(error);
  }
}

async function requireSession() {
  const cookieStore = await cookies();
  if (!isValidSession(cookieStore.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

function databaseError(error: unknown) {
  console.error("Growth Engine CRM API error", error);
  return NextResponse.json({ error: "CRM database request failed." }, { status: 500 });
}
