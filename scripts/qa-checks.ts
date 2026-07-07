import assert from "node:assert/strict";
import {
  addWorkingDays,
  buildFollowupSchedule,
  buildLeadContactTimeline,
  getInitialLeadNextFollowupDate,
  getNextFollowupDateForLead,
  getNextFollowupDateForNewFollowup,
} from "../src/lib/followup-schedule";
import {
  findImportDuplicate,
  normalizeImportPhone,
  normalizeImportUrl,
  summarizeImportDuplicates,
} from "../src/lib/import-dedupe";
import {
  buildWhatsAppUrl,
  encodeWhatsAppMessage,
  formatPhoneForWhatsApp,
} from "../src/lib/whatsapp";
import type { ImportPreviewRow, Lead, LeadDraft } from "../src/lib/types";

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
assert.deepEqual(
  buildLeadContactTimeline("2026-07-06").map((item) => `${item.label}:${item.date}`),
  [
    "Contacted:2026-07-06",
    "F1:2026-07-07",
    "F2:2026-07-09",
    "F3:2026-07-13",
    "F4:2026-07-16",
    "F5:2026-07-21",
  ],
);
assert.deepEqual(
  buildLeadContactTimeline("2026-07-10").map((item) => `${item.label}:${item.date}`),
  [
    "Contacted:2026-07-10",
    "F1:2026-07-13",
    "F2:2026-07-15",
    "F3:2026-07-17",
    "F4:2026-07-22",
    "F5:2026-07-27",
  ],
);
assert.equal(addWorkingDays("2026-07-11", 1), "2026-07-13");
assert.equal(getInitialLeadNextFollowupDate("2026-07-10", "Follow-up Needed"), "2026-07-13");
assert.equal(getInitialLeadNextFollowupDate("2026-07-10", "Won"), "");
assert.equal(
  getNextFollowupDateForNewFollowup(
    { firstContactDate: "2026-07-06", leadStage: "Follow-up Needed" },
    [],
    "2026-07-07",
    "Call Back Later",
  ),
  "2026-07-09",
);
assert.equal(
  getNextFollowupDateForLead(
    { firstContactDate: "2026-07-06", leadStage: "Follow-up Needed" },
    [{ followupDate: "2026-07-07", outcome: "Call Back Later", createdAt: "2026-07-07T09:00:00.000Z" }],
  ),
  "2026-07-09",
);

assert.equal(formatPhoneForWhatsApp("9633294791"), "919633294791");
assert.equal(formatPhoneForWhatsApp("+91 96332-94791"), "919633294791");
assert.equal(formatPhoneForWhatsApp("No Number"), "");
assert.equal(encodeWhatsAppMessage("Hi Naveen :)"), "Hi%20Naveen%20%3A)");
assert.equal(
  buildWhatsAppUrl("9633294791", "Hi Naveen"),
  "https://wa.me/919633294791?text=Hi%20Naveen",
);

const existingLead = fullLead({
  id: "lead_existing",
  leadUrl: "https://www.instagram.com/example.business/?igsh=abc",
  phone: "9633294791",
  leadName: "Example Business",
});

assert.equal(normalizeImportUrl("https://www.instagram.com/example.business/?igsh=abc"), "instagram.com/example.business");
assert.equal(normalizeImportPhone("+91 96332 94791"), "9633294791");
assert.equal(
  findImportDuplicate(
    { leadUrl: "instagram.com/example.business", phone: "", leadName: "New Row" },
    [existingLead],
  )?.reason,
  "Instagram URL",
);
assert.equal(
  findImportDuplicate({ leadUrl: "", phone: "96332 94791", leadName: "New Row" }, [existingLead])?.reason,
  "Phone",
);

const importRows: ImportPreviewRow[] = [
  previewRow(1, { leadUrl: "instagram.com/new.business", phone: "9999999999", leadName: "New Business" }),
  previewRow(2, { leadUrl: "", phone: "+91 99999 99999", leadName: "New Business Copy" }),
  previewRow(3, { leadUrl: "instagram.com/example.business", phone: "", leadName: "Existing Business Copy" }),
];
const duplicateSummary = summarizeImportDuplicates(importRows, [existingLead]);
assert.equal(duplicateSummary.createCount, 1);
assert.equal(duplicateSummary.duplicateCount, 2);
assert.equal(duplicateSummary.matchByRow.get(2)?.reason, "Phone");
assert.equal(duplicateSummary.matchByRow.get(3)?.reason, "Instagram URL");

console.log("QA checks passed: real follow-up, WhatsApp, and import dedupe utilities.");

function previewRow(rowNumber: number, lead: Partial<LeadDraft>): ImportPreviewRow {
  return {
    rowNumber,
    lead: leadDraft(lead),
    followups: [],
    warnings: [],
  };
}

function leadDraft(lead: Partial<LeadDraft> = {}): LeadDraft {
  return {
    leadUrl: "",
    leadName: "",
    businessName: "",
    contactPerson: "",
    phone: "",
    email: "",
    industry: "Other Services",
    location: "",
    source: "Instagram",
    leadTemperature: "Cold",
    leadStage: "New Lead",
    serviceInterest: "30 Poster Package",
    expectedValue: 5000,
    objectionReason: "",
    firstContactDate: "2026-07-06",
    nextFollowupDate: "2026-07-07",
    remarks: "",
    assignedTo: "Naveen",
    ...lead,
  };
}

function fullLead(lead: Partial<Lead> = {}): Lead {
  return {
    ...leadDraft(lead),
    id: "lead_test",
    isArchived: false,
    createdAt: "2026-07-06T09:00:00.000Z",
    updatedAt: "2026-07-06T09:00:00.000Z",
    ...lead,
  };
}
