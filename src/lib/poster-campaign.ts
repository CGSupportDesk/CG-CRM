import type {
  ActivityLog,
  CRMState,
  Lead,
  LeadStage,
  LeadTemperature,
  ObjectionReason,
  ServiceInterest,
} from "./types";
import { getInitialLeadNextFollowupDate } from "./followup-schedule";
import { DEFAULT_ASSIGNEE } from "./constants";
import { inferIndustryFromLeadText, normalizeLeadSource } from "./lead-normalization";
import { cleanPhone, createId } from "./utils";

const CAMPAIGN_YEAR = 2026;
const CAMPAIGN_EXPECTED_VALUE = 5000;
const CAMPAIGN_SERVICE_INTEREST: ServiceInterest = "30 Poster Package";

interface TrackerRow {
  rowNumber: number;
  leadUrl: string;
  leadName: string;
  phone: string;
  status: string;
  contactDate: string;
  remarks: string;
}

export function buildPosterCampaignSeed(trackerTsv: string): CRMState {
  const trackerRows = parsePosterCampaignTracker(trackerTsv);
  const leads: Lead[] = trackerRows.map((row) => buildLead(row));
  const activityLogs: ActivityLog[] = leads.flatMap((lead) => buildActivityLogs(lead));

  return { leads, followups: [], activityLogs, clients: [], projects: [], posterSlots: [], settings: [] };
}

function parsePosterCampaignTracker(trackerTsv: string): TrackerRow[] {
  return trackerTsv
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => !/^sales lead tracker/i.test(line.trim()))
    .filter((line) => !/^lead url\t/i.test(line.trim()))
    .map((line, index) => {
      const cells = line.split("\t").map((cell) => cell.trim());
      while (cells.length < 10) cells.push("");

      return {
        rowNumber: index + 2,
        leadUrl: cells[0],
        leadName: cells[1],
        phone: cells[2],
        status: cells[3],
        contactDate: cells[4],
        remarks: cells[9],
      };
    })
    .filter((row) =>
      Boolean(row.leadUrl || row.leadName || row.phone || row.status || row.remarks),
    );
}

function buildLead(row: TrackerRow): Lead {
  const { contactPerson, nameNote } = normalizeContactPerson(row.leadName);
  const businessName = inferBusinessName(row.leadUrl, contactPerson);
  const { leadTemperature, leadStage } = mapStatus(row.status, row.contactDate);
  const firstContactDate = parseCampaignDate(row.contactDate);
  const nextFollowupDate = getCampaignNextFollowupDate(firstContactDate, leadStage);
  const remarks = [row.remarks, nameNote ? `Lead note: ${nameNote}` : ""]
    .filter(Boolean)
    .join("\n");
  const id = createId("lead");
  const createdAt = dateTimeFromCampaignDate(firstContactDate || nextFollowupDate, 9);

  return {
    id,
    leadCode: buildCampaignLeadCode(row.rowNumber, firstContactDate || nextFollowupDate),
    leadUrl: row.leadUrl,
    leadName: contactPerson || businessName,
    businessName,
    contactPerson,
    phone: normalizePhone(row.phone),
    email: "",
    industry: inferIndustryFromLeadText([row.leadUrl, businessName, contactPerson, remarks]),
    location: "",
    source: normalizeLeadSource("", row.leadUrl, {
      preferUrlSource: true,
      sourceFallback: "Instagram",
    }),
    leadTemperature,
    leadStage,
    serviceInterest: CAMPAIGN_SERVICE_INTEREST,
    expectedValue: CAMPAIGN_EXPECTED_VALUE,
    objectionReason: inferObjectionReason(leadStage, remarks),
    firstContactDate,
    nextFollowupDate,
    remarks,
    assignedTo: DEFAULT_ASSIGNEE,
    samplePosterSent: false,
    samplePosterSentAt: "",
    isArchived: false,
    createdAt,
    updatedAt: dateTimeFromCampaignDate(firstContactDate || nextFollowupDate, 12),
  };
}

function buildCampaignLeadCode(rowNumber: number, date: string) {
  const datePart = (date || `${CAMPAIGN_YEAR}-07-04`).slice(2).replace(/-/g, "");
  return `GE-${datePart}-${String(rowNumber).padStart(4, "0")}`;
}

function buildActivityLogs(lead: Lead): ActivityLog[] {
  return [
    {
      id: createId("log"),
      leadId: lead.id,
      action: "Lead imported from poster campaign tracker",
      oldValue: "",
      newValue: lead.leadStage,
      createdBy: "captain",
      createdAt: lead.createdAt,
    },
    {
      id: createId("log"),
      leadId: lead.id,
      action: "Package assigned",
      oldValue: "",
      newValue: `${CAMPAIGN_SERVICE_INTEREST} - Rs ${CAMPAIGN_EXPECTED_VALUE}`,
      createdBy: "captain",
      createdAt: lead.updatedAt,
    },
  ];
}

function mapStatus(
  rawStatus: string,
  rawContactDate: string,
): { leadTemperature: LeadTemperature; leadStage: LeadStage } {
  const status = rawStatus.trim().toUpperCase();

  if (status.includes("HOT")) {
    return { leadTemperature: "Hot", leadStage: "Follow-up Needed" };
  }
  if (status.includes("WARM")) {
    return { leadTemperature: "Warm", leadStage: "Follow-up Needed" };
  }
  if (status.includes("SELECT") || status.includes("WON") || status.includes("CONVERT")) {
    return { leadTemperature: "Hot", leadStage: "Won" };
  }
  if (status.includes("REJECT")) {
    return { leadTemperature: "Cold", leadStage: "Rejected" };
  }
  if (status.includes("NO RESPONSE") || status.includes("NO-RESPONSE")) {
    return { leadTemperature: "Cold", leadStage: "No Response" };
  }

  return {
    leadTemperature: "Cold",
    leadStage: parseCampaignDate(rawContactDate) ? "Contacted" : "New Lead",
  };
}

function inferObjectionReason(
  leadStage: LeadStage,
  remarks: string,
): ObjectionReason | "" {
  const text = remarks.toLowerCase();

  if (leadStage === "No Response") return "No Response";
  if (text.includes("price") || text.includes("budget") || text.includes("lower rate")) {
    return "Price High";
  }
  if (text.includes("agency")) return "Already Has Agency";
  if (
    text.includes("team") ||
    text.includes("in house") ||
    text.includes("digital marketing")
  ) {
    return "Already Has Team";
  }
  if (text.includes("video")) return "Wants Videos";
  if (text.includes("need time") || text.includes("discuss")) return "Need Time";
  if (text.includes("will contact") || text.includes("call back")) return "Will Contact Later";
  if (leadStage === "Rejected") return "Other";

  return "";
}

function normalizeContactPerson(rawName: string) {
  const value = rawName.trim();
  const lower = value.toLowerCase();
  const isNote =
    lower.includes("no contact details") ||
    lower.includes("not yet started") ||
    lower.includes("reach out via insta");

  return {
    contactPerson: value && !isNote ? value : "",
    nameNote: value && isNote ? value : "",
  };
}

function normalizePhone(rawPhone: string) {
  const value = rawPhone.trim();
  if (!value || parseCampaignDate(value)) return "";
  return cleanPhone(value);
}

function parseCampaignDate(value: string) {
  const raw = value.trim();
  if (!raw) return "";

  const match = raw.match(
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,\s*(\d{4}))?/i,
  );
  if (!match) return "";

  const monthIndex = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ].indexOf(match[1].toLowerCase());
  const day = Number(match[2]);
  const year = match[3] ? Number(match[3]) : CAMPAIGN_YEAR;

  if (monthIndex < 0 || !Number.isFinite(day) || !Number.isFinite(year)) return "";

  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getCampaignNextFollowupDate(
  firstContactDate: string,
  leadStage: LeadStage,
) {
  return getInitialLeadNextFollowupDate(firstContactDate, leadStage);
}

function dateTimeFromCampaignDate(value: string, hour: number) {
  const date = value || `${CAMPAIGN_YEAR}-07-04`;
  return new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+05:30`).toISOString();
}

function inferBusinessName(url: string, fallback: string) {
  const handle = getUrlHandle(url);
  return titleCase(handle) || fallback || "Poster Campaign Lead";
}

function getUrlHandle(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("instagram.com")) {
      const [first, second] = parsed.pathname.split("/").filter(Boolean);
      return first === "p" ? second || "instagram lead" : first || "instagram lead";
    }

    return parsed.hostname.replace(/^www\./, "").split(".")[0];
  } catch {
    return "";
  }
}

function titleCase(value: string) {
  return value
    .replace(/[_./-]+/g, " ")
    .replace(/\?g=5$/i, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
