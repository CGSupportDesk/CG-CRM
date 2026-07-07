import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

assert.deepEqual(buildFollowupSchedule("2026-07-06"), [
  "2026-07-07",
  "2026-07-09",
  "2026-07-13",
  "2026-07-16",
]);
assert.deepEqual(buildFollowupSchedule("2026-07-10"), [
  "2026-07-13",
  "2026-07-15",
  "2026-07-17",
  "2026-07-22",
]);

assert.equal(formatPhoneForWhatsApp("9633294791"), "919633294791");
assert.equal(formatPhoneForWhatsApp("+91 96332-94791"), "919633294791");
assert.equal(formatPhoneForWhatsApp("No Number"), "");

const existingLead = {
  id: "lead_existing",
  leadUrl: "https://www.instagram.com/example.business/?igsh=abc",
  phone: "9633294791",
  leadName: "Example Business",
};
assert.equal(findDuplicate({ leadUrl: "instagram.com/example.business", phone: "" }, [existingLead])?.reason, "Instagram URL");
assert.equal(findDuplicate({ leadUrl: "", phone: "96332 94791" }, [existingLead])?.reason, "Phone");

assertSourceContains("src/lib/followup-schedule.ts", [
  "FOLLOWUP_WORKING_DAY_GAPS = [1, 2, 2, 3]",
  "day >= 1 && day <= 5",
]);
assertSourceContains("src/lib/import-dedupe.ts", [
  "findImportDuplicate",
  "summarizeImportDuplicates",
]);
assertSourceContains("src/app/(app)/daily-sales/daily-sales-client.tsx", [
  "Today's Calls",
  "Overdue",
  "Hot Leads",
  "No Response",
]);
assertSourceContains("src/lib/whatsapp-templates.ts", [
  "getDefaultWhatsappTemplate",
  "WhatsApp template labels",
]);

console.log("QA checks passed: follow-up math, WhatsApp formatting, import dedupe, daily sales route.");

function buildFollowupSchedule(firstContactDate) {
  const second = addWorkingDays(firstContactDate, 1);
  const third = addWorkingDays(second, 2);
  const fourth = addWorkingDays(third, 2);
  const fifth = addWorkingDays(fourth, 3);
  return [second, third, fourth, fifth];
}

function addWorkingDays(startIso, workingDays) {
  const date = new Date(`${startIso}T12:00:00.000Z`);
  let added = 0;
  while (added < workingDays) {
    date.setUTCDate(date.getUTCDate() + 1);
    const day = date.getUTCDay();
    if (day >= 1 && day <= 5) added += 1;
  }
  return date.toISOString().slice(0, 10);
}

function formatPhoneForWhatsApp(value) {
  const digits = value.replace(/\D/g, "");
  if (!digits || /^no\s*number$/i.test(value.trim())) return "";
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return "";
}

function findDuplicate(candidate, existingLeads) {
  const candidateUrl = normalizeImportUrl(candidate.leadUrl);
  const candidatePhone = normalizeImportPhone(candidate.phone);

  if (candidateUrl) {
    const match = existingLeads.find((lead) => normalizeImportUrl(lead.leadUrl) === candidateUrl);
    if (match) return { reason: "Instagram URL" };
  }
  if (candidatePhone) {
    const match = existingLeads.find((lead) => normalizeImportPhone(lead.phone) === candidatePhone);
    if (match) return { reason: "Phone" };
  }
  return null;
}

function normalizeImportUrl(value) {
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

function normalizeImportPhone(value) {
  const raw = value.trim();
  if (!raw || /^no\s*number$/i.test(raw) || /^n\/?a$/i.test(raw)) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(-10);
  if (digits.length > 10 && digits.length <= 13) return digits.slice(-10);
  return "";
}

function assertSourceContains(file, snippets) {
  const source = readFileSync(join(root, file), "utf8");
  for (const snippet of snippets) {
    assert.ok(source.includes(snippet), `${file} should contain ${snippet}`);
  }
}
