import Papa from "papaparse";
import type {
  FollowupOutcome,
  FollowupType,
  ImportPreview,
  ImportPreviewRow,
  LeadDraft,
  LeadStage,
  LeadTemperature,
} from "./types";
import { cleanPhone, parsePossibleDate } from "./utils";

type RawCsvRow = Record<string, string | undefined>;

const headerMap: Record<string, string[]> = {
  leadUrl: ["lead url", "lead_url", "url", "instagram url"],
  leadName: ["lead name", "name", "customer name"],
  contactNumber: ["contact number", "phone", "mobile", "contact"],
  status: ["status"],
  contactDate: ["contact date", "first contact date"],
  followup1: ["followup 1", "follow-up 1", "follow up 1"],
  followup2: ["followup 2", "follow-up 2", "follow up 2"],
  followup3: ["followup 3", "follow-up 3", "follow up 3"],
  followup4: ["followup 4", "follow-up 4", "follow up 4"],
  remarks: ["remarks", "notes"],
};

export function parseLegacyLeadCsv(text: string): ImportPreview {
  const result = Papa.parse<RawCsvRow>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  const errors = result.errors.map((error) => `Row ${error.row}: ${error.message}`);
  const rows = result.data
    .map((row, index) => mapLegacyRow(row, index + 2))
    .filter((row): row is ImportPreviewRow => row !== null);

  return {
    rows,
    errors,
    totalRows: result.data.length,
  };
}

function mapLegacyRow(row: RawCsvRow, rowNumber: number): ImportPreviewRow | null {
  const get = (key: keyof typeof headerMap) => getField(row, headerMap[key]);
  const leadName = get("leadName");
  const leadUrl = get("leadUrl");
  const rawPhone = get("contactNumber");
  const status = get("status");
  const contactDate = parsePossibleDate(get("contactDate"));
  const remarks = get("remarks");
  const warnings: string[] = [];

  if (!leadName && !leadUrl && !rawPhone && !remarks) return null;

  if (!leadName) warnings.push("Lead name is missing; using imported lead row label.");
  if (!rawPhone || /^no\s*number$/i.test(rawPhone)) {
    warnings.push("Phone number missing or marked as No Number.");
  }

  const { leadTemperature, leadStage } = mapStatus(status);
  const lead: LeadDraft = {
    leadUrl,
    leadName: leadName || `Imported lead ${rowNumber}`,
    businessName: leadName || "",
    contactPerson: leadName || "",
    phone: cleanPhone(rawPhone),
    email: "",
    industry: "",
    location: "",
    source: leadUrl ? "Instagram" : "CSV Import",
    leadTemperature,
    leadStage,
    serviceInterest: "Not Sure",
    expectedValue: 0,
    objectionReason: leadStage === "Rejected" ? "Other" : "",
    firstContactDate: contactDate,
    nextFollowupDate: "",
    assignedTo: "captain",
    remarks,
  };

  const followups = ["followup1", "followup2", "followup3", "followup4"]
    .map((key) => parsePossibleDate(get(key as keyof typeof headerMap)))
    .filter(Boolean)
    .map((date, index) => ({
      followupDate: date,
      followupType: "Call" as FollowupType,
      outcome: index === 0 && leadStage === "No Response"
        ? ("No Response" as FollowupOutcome)
        : ("Call Back Later" as FollowupOutcome),
      nextFollowupDate: "",
      remarks: `Imported from Followup ${index + 1}`,
      createdBy: "captain",
    }));

  if (followups.length > 0) {
    lead.nextFollowupDate = followups[followups.length - 1].followupDate;
  }

  return { rowNumber, lead, followups, warnings };
}

function getField(row: RawCsvRow, candidates: string[]) {
  const normalizedEntries = Object.entries(row).map(([key, value]) => [
    key.trim().toLowerCase(),
    String(value || "").trim(),
  ]);
  const found = normalizedEntries.find(([key]) =>
    candidates.some((candidate) => candidate === key),
  );

  return found?.[1] || "";
}

function mapStatus(status: string): {
  leadTemperature: LeadTemperature;
  leadStage: LeadStage;
} {
  const value = status.trim().toUpperCase();

  if (value.includes("HOT")) {
    return { leadTemperature: "Hot", leadStage: "Follow-up Needed" };
  }
  if (value.includes("WARM")) {
    return { leadTemperature: "Warm", leadStage: "Follow-up Needed" };
  }
  if (value.includes("REJECT")) {
    return { leadTemperature: "Cold", leadStage: "Rejected" };
  }
  if (value.includes("NO RESPONSE") || value.includes("NO-RESPONSE")) {
    return { leadTemperature: "Cold", leadStage: "No Response" };
  }
  if (value.includes("COLD")) {
    return { leadTemperature: "Cold", leadStage: "New Lead" };
  }

  return { leadTemperature: "Warm", leadStage: "New Lead" };
}
