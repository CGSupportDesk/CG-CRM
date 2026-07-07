import type { ImportPreviewRow, Lead, LeadDraft } from "./types";

type ImportLeadCandidate = Pick<LeadDraft, "leadUrl" | "phone"> &
  Partial<Pick<Lead, "id" | "leadName" | "businessName" | "contactPerson">>;

export interface ImportDuplicateMatch {
  leadId: string;
  leadName: string;
  reason: "Instagram URL" | "Phone";
  existingValue: string;
}

export interface ImportDuplicatePreview {
  rowNumber: number;
  match: ImportDuplicateMatch | null;
}

export function normalizeImportUrl(value: string) {
  const raw = value.trim().toLowerCase();
  if (!raw) return "";

  const withProtocol = /^[a-z]+:\/\//.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "");

    if (host.includes("instagram.com")) {
      const handle = path.split("/").filter(Boolean)[0] || "";
      return handle ? `instagram.com/${handle}` : "";
    }

    return `${host}${path}`.replace(/\/+$/, "");
  } catch {
    return raw
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .replace(/[?#].*$/, "")
      .replace(/\/+$/, "");
  }
}

export function normalizeImportPhone(value: string) {
  const raw = value.trim();
  if (!raw || /^no\s*number$/i.test(raw) || /^n\/?a$/i.test(raw)) return "";

  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(-10);
  if (digits.length > 10 && digits.length <= 13) return digits.slice(-10);

  return "";
}

export function findImportDuplicate(
  candidate: ImportLeadCandidate,
  existingLeads: ImportLeadCandidate[],
): ImportDuplicateMatch | null {
  const candidateUrl = normalizeImportUrl(candidate.leadUrl);
  const candidatePhone = normalizeImportPhone(candidate.phone);

  if (candidateUrl) {
    const urlMatch = existingLeads.find((lead) => {
      if (candidate.id && lead.id === candidate.id) return false;
      return normalizeImportUrl(lead.leadUrl) === candidateUrl;
    });

    if (urlMatch?.id) {
      return buildMatch(urlMatch, "Instagram URL", urlMatch.leadUrl);
    }
  }

  if (candidatePhone) {
    const phoneMatch = existingLeads.find((lead) => {
      if (candidate.id && lead.id === candidate.id) return false;
      return normalizeImportPhone(lead.phone) === candidatePhone;
    });

    if (phoneMatch?.id) {
      return buildMatch(phoneMatch, "Phone", phoneMatch.phone);
    }
  }

  return null;
}

export function summarizeImportDuplicates(rows: ImportPreviewRow[], existingLeads: Lead[]) {
  const matchingPool: ImportLeadCandidate[] = [...existingLeads];
  const matches = rows.map<ImportDuplicatePreview>((row) => {
    const match = findImportDuplicate(row.lead, matchingPool);
    if (!match) {
      matchingPool.push({
        ...row.lead,
        id: `import-row-${row.rowNumber}`,
        leadName: row.lead.leadName || `Import row ${row.rowNumber}`,
      });
    }

    return {
      rowNumber: row.rowNumber,
      match,
    };
  });
  const duplicateCount = matches.filter((item) => item.match).length;

  return {
    matches,
    matchByRow: new Map(matches.map((item) => [item.rowNumber, item.match])),
    duplicateCount,
    createCount: Math.max(rows.length - duplicateCount, 0),
  };
}

function buildMatch(
  lead: ImportLeadCandidate,
  reason: ImportDuplicateMatch["reason"],
  existingValue: string,
): ImportDuplicateMatch {
  return {
    leadId: lead.id || "",
    leadName: lead.businessName || lead.leadName || lead.contactPerson || "Existing lead",
    reason,
    existingValue,
  };
}
