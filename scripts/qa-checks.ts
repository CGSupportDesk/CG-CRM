import assert from "node:assert/strict";
import {
  addWorkingDays,
  buildFollowupSchedule,
  buildLeadContactTimeline,
  formatFollowupDelay,
  getInitialLeadNextFollowupDate,
  getNextFollowupDateForLead,
  getNextFollowupDateForNewFollowup,
  getWorkingDayDelta,
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
import {
  dailyActivityLogReport,
  dailyCommunicationReport,
  followupAuditSummary,
  getDataQualityReport,
  getFollowupAuditRows,
  getLeadAgingReport,
  getLeadScores,
  leadScoreDistribution,
  sampleConversionStats,
  samplePosterWorkflow,
  whatsappTemplatePerformance,
} from "../src/lib/analytics";
import { rowsToCsv } from "../src/lib/export-utils";
import {
  buildPosterSlotDates,
  getPosterMonthDays,
  getPosterSlotSequenceNumber,
} from "../src/lib/poster-calendar";
import type { ActivityLog, Followup, ImportPreviewRow, Lead, LeadDraft } from "../src/lib/types";

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
const delayedTimeline = buildLeadContactTimeline("2026-07-06", [
  {
    followupDate: "2026-07-08",
    scheduledFollowupDate: "2026-07-07",
    outcome: "Call Back Later",
    createdAt: "2026-07-08T09:00:00.000Z",
  },
]);
assert.deepEqual(
  delayedTimeline.map((item) => `${item.label}:${item.date}:${item.kind === "followup" ? item.actualDate || "" : ""}`),
  [
    "Contacted:2026-07-06:",
    "F1:2026-07-07:2026-07-08",
    "F2:2026-07-10:",
    "F3:2026-07-14:",
    "F4:2026-07-17:",
    "F5:2026-07-22:",
  ],
);
assert.equal(getWorkingDayDelta("2026-07-10", "2026-07-13"), 1);
assert.equal(formatFollowupDelay(getWorkingDayDelta("2026-07-10", "2026-07-13")), "1 working day late");
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

const conversionLeads = [
  fullLead({ id: "lead_sample_won", leadStage: "Won", samplePosterSent: true }),
  fullLead({ id: "lead_sample_open", leadStage: "Follow-up Needed", samplePosterSent: true }),
  fullLead({ id: "lead_followed_won", leadStage: "Won", samplePosterSent: false }),
];
const conversionFollowups: Followup[] = [
  followup({ leadId: "lead_sample_won", outcome: "Converted" }),
  followup({ leadId: "lead_sample_open", outcome: "Call Back Later" }),
  followup({ leadId: "lead_followed_won", outcome: "Converted" }),
];
const sampleStats = sampleConversionStats(conversionLeads, conversionFollowups);
assert.equal(sampleStats.samplesSent, 2);
assert.equal(sampleStats.samplesWon, 1);
assert.equal(sampleStats.sampleConversionRate, 50);
assert.equal(sampleStats.followedUp, 3);
assert.equal(sampleStats.followupConversionRate, 67);

const scoredLeads = getLeadScores(
  [
    fullLead({
      id: "lead_priority",
      leadTemperature: "Hot",
      leadStage: "Follow-up Needed",
      nextFollowupDate: "2026-07-13",
      expectedValue: 5000,
      remarks: "Asked for sample and price.",
      createdAt: "2026-07-08T05:00:00.000Z",
    }),
    fullLead({
      id: "lead_nurture",
      leadTemperature: "Cold",
      leadStage: "New Lead",
      nextFollowupDate: "2026-07-20",
      createdAt: "2026-07-14T05:00:00.000Z",
    }),
  ],
  [],
  "2026-07-14",
);
assert.equal(scoredLeads[0].lead.id, "lead_priority");
assert.equal(scoredLeads[0].band, "Priority");
assert.equal(scoredLeads[0].reasons.includes("Overdue follow-up"), true);
assert.equal(leadScoreDistribution(scoredLeads).Priority, 1);

const agingReport = getLeadAgingReport(
  [
    fullLead({ id: "lead_old", createdAt: "2026-07-01T05:00:00.000Z" }),
    fullLead({ id: "lead_new", createdAt: "2026-07-13T05:00:00.000Z" }),
  ],
  "2026-07-14",
);
assert.equal(agingReport.buckets["8-14 days"], 1);
assert.equal(agingReport.buckets["0-2 days"], 1);
assert.equal(agingReport.staleLeads[0].lead.id, "lead_old");

const auditRows = getFollowupAuditRows(
  [fullLead({ id: "lead_audit", firstContactDate: "2026-07-06" })],
  [
    followup({
      id: "followup_audit_late",
      leadId: "lead_audit",
      scheduledFollowupDate: "2026-07-07",
      followupDate: "2026-07-08",
      markedAt: "2026-07-08T05:00:00.000Z",
    }),
  ],
  "2026-07-14",
);
assert.equal(auditRows[0].status, "Pending Late");
assert.equal(auditRows.find((row) => row.label === "F1")?.status, "Completed Late");
assert.equal(followupAuditSummary(auditRows)["Completed Late"], 1);

const templateRows = whatsappTemplatePerformance(
  [fullLead({ id: "lead_template", leadStage: "Won", samplePosterSent: true })],
  [
    activityLog({
      leadId: "lead_template",
      action: "WhatsApp opened",
      newValue: "Send me Details",
      createdAt: "2026-07-14T06:05:00.000Z",
    }),
  ],
);
assert.equal(templateRows[0].template, "Send me Details");
assert.equal(templateRows[0].opens, 1);
assert.equal(templateRows[0].conversionRate, 100);
assert.equal(templateRows[0].sampleSentLeads, 1);

const dataQuality = getDataQualityReport([
  fullLead({ id: "lead_duplicate_1", phone: "9633294791", leadUrl: "instagram.com/dupe", remarks: "" }),
  fullLead({ id: "lead_duplicate_2", phone: "+91 96332 94791", leadUrl: "instagram.com/dupe?igsh=abc", remarks: "" }),
  fullLead({ id: "lead_missing_followup", phone: "", nextFollowupDate: "", remarks: "Needs cleanup" }),
]);
assert.equal(dataQuality.duplicatePhones.length, 1);
assert.equal(dataQuality.duplicateUrls.length, 1);
assert.equal(dataQuality.missingNextFollowupDate.length, 1);
assert.equal(dataQuality.missingRemarks.length, 2);

const sampleWorkflow = samplePosterWorkflow(
  [
    fullLead({
      id: "lead_sample_candidate",
      leadTemperature: "Warm",
      objectionReason: "Price High",
      samplePosterSent: false,
      remarks: "Said expensive.",
    }),
    fullLead({
      id: "lead_sample_followup",
      samplePosterSent: true,
      samplePosterSentAt: "2026-07-12T05:00:00.000Z",
      nextFollowupDate: "2026-07-14",
    }),
  ],
  [],
);
assert.equal(sampleWorkflow.sampleCandidates.length, 1);
assert.equal(sampleWorkflow.sentNeedsFollowup.length, 1);

const dailyReport = dailyCommunicationReport(
  [
    followup({ followupType: "Call", outcome: "No Response", markedAt: "2026-07-14T04:15:00.000Z" }),
    followup({ followupType: "Call", outcome: "Interested", markedAt: "2026-07-14T04:25:00.000Z" }),
    followup({ followupType: "WhatsApp", outcome: "Details Sent", markedAt: "2026-07-14T04:25:00.000Z" }),
  ],
  [
    activityLog({ newValue: "Call - No Response - actual 2026-07-14", createdAt: "2026-07-14T05:10:00.000Z" }),
    activityLog({ newValue: "Call - Interested - actual 2026-07-14", createdAt: "2026-07-14T05:20:00.000Z" }),
    activityLog({ newValue: "WhatsApp - Details Sent - actual 2026-07-14", createdAt: "2026-07-14T04:25:00.000Z" }),
    activityLog({ action: "WhatsApp opened", newValue: "Send me Details", createdAt: "2026-07-14T06:05:00.000Z" }),
  ],
  "2026-07-14",
  [
    fullLead({ id: "lead_created_instagram", source: "Instagram", createdAt: "2026-07-14T02:45:00.000Z" }),
    fullLead({ id: "lead_created_referral", source: "Referral", createdAt: "2026-07-14T05:50:00.000Z" }),
    fullLead({ id: "lead_created_previous", source: "Facebook", createdAt: "2026-07-13T05:50:00.000Z" }),
  ],
);
assert.equal(dailyReport.leadsCreated, 2);
assert.equal(dailyReport.totalFollowups, 3);
assert.equal(dailyReport.totalCalls, 2);
assert.equal(dailyReport.totalMessages, 2);
assert.equal(dailyReport.totalActivities, 6);
assert.equal(dailyReport.outcomeCounts["No Response"], 1);
assert.equal(dailyReport.outcomeCounts.Interested, 1);
assert.equal(dailyReport.followupTypeCounts.Call, 2);
assert.equal(dailyReport.followupTypeCounts.WhatsApp, 1);
assert.equal(dailyReport.followupOutcomeCounts["Details Sent"], 1);
assert.equal(dailyReport.messageCounts["WhatsApp: Details Sent"], 1);
assert.equal(dailyReport.messageCounts["Template: Send me Details"], 1);
assert.equal(dailyReport.hourlyCalls["10:00"], 2);
assert.equal(dailyReport.hourlyFollowups["10:00"], 2);
assert.equal(dailyReport.hourlyFollowups["09:00"], 1);
assert.equal(dailyReport.hourlyMessages["09:00"], 1);
assert.equal(dailyReport.hourlyMessages["11:00"], 1);
assert.equal(dailyReport.hourlyActivity["10:00"], 2);
assert.equal(dailyReport.hourlyActivity["11:00"], 2);
assert.equal(dailyReport.hourlyLeadCreations["08:00"], 1);
assert.equal(dailyReport.hourlyLeadCreations["11:00"], 1);
assert.equal(dailyReport.leadSourceCounts.Instagram, 1);
assert.equal(dailyReport.leadSourceCounts.Referral, 1);
assert.equal(dailyReport.topHour, "10:00");
assert.equal(dailyReport.topFollowupHour, "10:00");
assert.equal(dailyReport.topMessageHour, "09:00");
assert.equal(dailyReport.topLeadCreationHour, "08:00");
assert.equal(dailyReport.source, "Activity logs");
assert.equal(dailyReport.messageSource, "Activity logs");

const activityReport = dailyActivityLogReport(
  [
    activityLog({ action: "Follow-up added", createdAt: "2026-07-14T05:10:00.000Z" }),
    activityLog({ action: "WhatsApp opened", createdAt: "2026-07-14T05:20:00.000Z" }),
    activityLog({ action: "Lead created", createdAt: "2026-07-13T05:20:00.000Z" }),
  ],
  "2026-07-14",
);
assert.equal(activityReport.totalLogs, 2);
assert.equal(activityReport.hourlyLogs["10:00"], 2);
assert.equal(activityReport.actionCounts["Follow-up added"], 1);
assert.equal(activityReport.actionCounts["WhatsApp opened"], 1);

assert.equal(
  rowsToCsv([{ Name: "A, B", Remarks: "Line 1\nLine 2", Count: 2 }]),
  'Name,Remarks,Count\n"A, B","Line 1\nLine 2",2',
);

assert.equal(getPosterMonthDays("2026-07").length, 31);
assert.equal(getPosterMonthDays("2026-04").length, 30);
assert.equal(getPosterMonthDays("2026-02").length, 28);
assert.deepEqual(
  buildPosterSlotDates("2026-07", 30, "2026-07-15T04:30:00.000Z").slice(0, 3),
  ["2026-07-15", "2026-07-16", "2026-07-17"],
);
assert.equal(buildPosterSlotDates("2026-07", 30, "2026-07-15T04:30:00.000Z").length, 17);
assert.equal(buildPosterSlotDates("2026-08", 30, "2026-07-15T04:30:00.000Z")[0], "2026-08-01");
assert.deepEqual(buildPosterSlotDates("2026-06", 30, "2026-07-15T04:30:00.000Z"), []);
const midMonthSchedule = buildPosterSlotDates("2026-07", 30, "2026-07-15T04:30:00.000Z");
assert.equal(getPosterSlotSequenceNumber("2026-07-15", midMonthSchedule), 1);
assert.equal(getPosterSlotSequenceNumber("2026-07-31", midMonthSchedule), 17);

console.log("QA checks passed: follow-up schedule, WhatsApp, import dedupe, poster calendar, scoring, aging, audit, data quality, exports, and report math.");

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
    samplePosterSent: false,
    samplePosterSentAt: "",
    ...lead,
  };
}

function fullLead(lead: Partial<Lead> = {}): Lead {
  return {
    ...leadDraft(lead),
    id: "lead_test",
    leadCode: "GE-260706-TEST",
    isArchived: false,
    createdAt: "2026-07-06T09:00:00.000Z",
    updatedAt: "2026-07-06T09:00:00.000Z",
    ...lead,
  };
}

function followup(followupDraft: Partial<Followup> = {}): Followup {
  return {
    id: "followup_test",
    leadId: "lead_test",
    scheduledFollowupDate: "2026-07-14",
    followupDate: "2026-07-14",
    followupType: "Call",
    outcome: "Call Back Later",
    nextFollowupDate: "2026-07-16",
    remarks: "Called and logged.",
    createdBy: "captain",
    markedAt: "2026-07-14T04:30:00.000Z",
    createdAt: "2026-07-14T04:30:00.000Z",
    ...followupDraft,
  };
}

function activityLog(log: Partial<ActivityLog> = {}): ActivityLog {
  return {
    id: "log_test",
    leadId: "lead_test",
    action: "Follow-up added",
    oldValue: "",
    newValue: "Call - Call Back Later - actual 2026-07-14",
    createdBy: "captain",
    createdAt: "2026-07-14T04:30:00.000Z",
    ...log,
  };
}
