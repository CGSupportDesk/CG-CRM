import type {
  ActivityLog,
  Followup,
  Lead,
  LeadStage,
  LeadTemperature,
  PosterSlot,
  StudioClient,
  StudioProject,
  WhatsappTemplateKey,
} from "./types";
import { followupOutcomeOptions, followupTypeOptions } from "./constants";
import {
  buildLeadContactTimeline,
  formatFollowupDelay,
  type LeadContactTimelineItem,
} from "./followup-schedule";
import { normalizeImportPhone, normalizeImportUrl } from "./import-dedupe";
import { isOverdue, isToday, offsetDate, startOfWeekIso, todayIso, toLocalIsoDate } from "./utils";

const terminalLeadStages: LeadStage[] = ["Won", "Lost", "Rejected"];
const agingBucketLabels = ["0-2 days", "3-7 days", "8-14 days", "15-30 days", "31+ days"] as const;

export type LeadScoreBand = "Priority" | "Healthy" | "Nurture" | "Closed";

export interface LeadScore {
  lead: Lead;
  score: number;
  band: LeadScoreBand;
  ageDays: number;
  daysSinceLastTouch: number | null;
  lastTouchDate: string;
  reasons: string[];
}

export interface FollowupAuditRow {
  lead: Lead;
  label: string;
  scheduledDate: string;
  actualDate: string;
  markedAt: string;
  status: "Pending Late" | "Due Today" | "Scheduled" | "Completed Late" | "Completed Early" | "Completed On Time" | "No Schedule";
  delayWorkingDays: number;
  delayText: string;
  remarks: string;
  outcome: string;
  followupType: string;
  followupId: string;
}

export interface TemplatePerformanceRow {
  template: WhatsappTemplateKey;
  opens: number;
  uniqueLeads: number;
  wonLeads: number;
  sampleSentLeads: number;
  conversionRate: number;
  latestOpenAt: string;
}

export interface DataQualityGroup {
  key: string;
  leads: Lead[];
}

export function activeLeads(leads: Lead[]) {
  return leads.filter((lead) => !lead.isArchived);
}

export function openLeads(leads: Lead[]) {
  return activeLeads(leads).filter((lead) => !isTerminalLead(lead));
}

export function getKpis(leads: Lead[]) {
  const active = activeLeads(leads);
  const contactedStart = startOfWeekIso();

  return {
    totalLeads: active.length,
    hotLeads: active.filter((lead) => lead.leadTemperature === "Hot").length,
    warmLeads: active.filter((lead) => lead.leadTemperature === "Warm").length,
    coldLeads: active.filter((lead) => lead.leadTemperature === "Cold").length,
    noResponseLeads: active.filter((lead) => lead.leadStage === "No Response").length,
    rejectedLeads: active.filter((lead) => lead.leadStage === "Rejected").length,
    followupsDueToday: active.filter((lead) => isToday(lead.nextFollowupDate)).length,
    overdueFollowups: active.filter((lead) => isOverdue(lead.nextFollowupDate)).length,
    leadsContactedThisWeek: active.filter(
      (lead) => lead.firstContactDate >= contactedStart,
    ).length,
    wonLeads: active.filter((lead) => lead.leadStage === "Won").length,
    lostLeads: active.filter((lead) => lead.leadStage === "Lost").length,
    expectedRevenue: active
      .filter((lead) => !["Lost", "Rejected"].includes(lead.leadStage))
      .reduce((sum, lead) => sum + lead.expectedValue, 0),
  };
}

export function countBy<T extends string>(
  items: Lead[],
  getter: (lead: Lead) => T | "",
) {
  return items.reduce<Record<string, number>>((acc, lead) => {
    const key = getter(lead) || "Not Set";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

export function leadTemperatureChart(leads: Lead[]) {
  return countBy<LeadTemperature>(activeLeads(leads), (lead) => lead.leadTemperature);
}

export function leadStageChart(leads: Lead[]) {
  return countBy<LeadStage>(activeLeads(leads), (lead) => lead.leadStage);
}

export function industryChart(leads: Lead[]) {
  return countBy<string>(activeLeads(leads), (lead) => lead.industry);
}

export function objectionChart(leads: Lead[]) {
  return countBy<string>(
    activeLeads(leads).filter((lead) => Boolean(lead.objectionReason)),
    (lead) => lead.objectionReason,
  );
}

export function followupDueChart(leads: Lead[]) {
  const open = openLeads(leads);
  const closed = activeLeads(leads).filter(isTerminalLead);
  return {
    Overdue: open.filter((lead) => isOverdue(lead.nextFollowupDate)).length,
    Today: open.filter((lead) => isToday(lead.nextFollowupDate)).length,
    Upcoming: open.filter((lead) => lead.nextFollowupDate && lead.nextFollowupDate > todayIso()).length,
    "No Date": open.filter((lead) => !lead.nextFollowupDate).length,
    Closed: closed.length,
  };
}

export function getFollowupTasks(leads: Lead[], followups: Followup[]) {
  const latestByLead = new Map<string, Followup>();

  [...followups]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .forEach((followup) => {
      if (!latestByLead.has(followup.leadId)) latestByLead.set(followup.leadId, followup);
    });

  return activeLeads(leads)
    .filter((lead) => !isTerminalLead(lead))
    .map((lead) => ({
      lead,
      latestFollowup: latestByLead.get(lead.id) || null,
    }))
    .filter(({ lead }) => Boolean(lead.nextFollowupDate))
    .sort((a, b) => a.lead.nextFollowupDate.localeCompare(b.lead.nextFollowupDate));
}

export function monthlyConversionRows(leads: Lead[]) {
  const buckets = activeLeads(leads).reduce<
    Record<string, { month: string; leads: number; won: number; expected: number }>
  >((acc, lead) => {
    const month = (lead.createdAt || new Date().toISOString()).slice(0, 7);
    acc[month] ||= { month, leads: 0, won: 0, expected: 0 };
    acc[month].leads += 1;
    if (lead.leadStage === "Won") acc[month].won += 1;
    if (!isTerminalLead(lead) || lead.leadStage === "Won") acc[month].expected += lead.expectedValue;
    return acc;
  }, {});

  return Object.values(buckets).sort((a, b) => a.month.localeCompare(b.month));
}

export function sampleConversionStats(leads: Lead[], followups: Followup[]) {
  const active = activeLeads(leads);
  const followupLeadIds = new Set(followups.map((followup) => followup.leadId));
  const sampled = active.filter((lead) => lead.samplePosterSent);
  const sampledWithFollowups = sampled.filter((lead) => followupLeadIds.has(lead.id));
  const followedUp = active.filter((lead) => followupLeadIds.has(lead.id));

  return {
    samplesSent: sampled.length,
    samplesWon: sampled.filter((lead) => lead.leadStage === "Won").length,
    sampleConversionRate: percentage(sampled.filter((lead) => lead.leadStage === "Won").length, sampled.length),
    samplesWithFollowups: sampledWithFollowups.length,
    samplesWithFollowupsWon: sampledWithFollowups.filter((lead) => lead.leadStage === "Won").length,
    sampleFollowupConversionRate: percentage(
      sampledWithFollowups.filter((lead) => lead.leadStage === "Won").length,
      sampledWithFollowups.length,
    ),
    followedUp: followedUp.length,
    followedUpWon: followedUp.filter((lead) => lead.leadStage === "Won").length,
    followupConversionRate: percentage(
      followedUp.filter((lead) => lead.leadStage === "Won").length,
      followedUp.length,
    ),
  };
}

export function getLeadScores(
  leads: Lead[],
  followups: Followup[],
  date = todayIso(),
) {
  const followupsByLead = groupFollowupsByLead(followups);

  return activeLeads(leads)
    .map((lead) => getLeadScore(lead, followupsByLead.get(lead.id) || [], date))
    .sort((a, b) => b.score - a.score || b.lead.createdAt.localeCompare(a.lead.createdAt));
}

export function getLeadScore(
  lead: Lead,
  leadFollowups: Followup[] = [],
  date = todayIso(),
): LeadScore {
  const reasons: string[] = [];
  const ageDays = daysBetweenIso(getLocalDateFromValue(lead.createdAt), date);
  const sortedFollowups = [...leadFollowups].sort((a, b) => b.followupDate.localeCompare(a.followupDate));
  const lastFollowup = sortedFollowups[0];
  const lastTouchDate = lastFollowup?.followupDate || lead.firstContactDate || getLocalDateFromValue(lead.createdAt);
  const daysSinceLastTouch = lastTouchDate ? daysBetweenIso(lastTouchDate, date) : null;

  if (isTerminalLead(lead)) {
    return {
      lead,
      score: lead.leadStage === "Won" ? 100 : 0,
      band: "Closed",
      ageDays,
      daysSinceLastTouch,
      lastTouchDate,
      reasons: [lead.leadStage],
    };
  }

  let score = 20;

  if (lead.leadTemperature === "Hot") {
    score += 34;
    reasons.push("Hot lead");
  } else if (lead.leadTemperature === "Warm") {
    score += 22;
    reasons.push("Warm lead");
  } else {
    score += 8;
    reasons.push("Cold nurture");
  }

  const stageScore: Partial<Record<LeadStage, number>> = {
    "New Lead": 10,
    Contacted: 16,
    "Details Sent": 24,
    "Follow-up Needed": 26,
    "Proposal Sent": 34,
    "No Response": 12,
  };
  score += stageScore[lead.leadStage] || 0;
  reasons.push(lead.leadStage);

  if (lead.nextFollowupDate) {
    if (isOverdue(lead.nextFollowupDate)) {
      score += 18;
      reasons.push("Overdue follow-up");
    } else if (isToday(lead.nextFollowupDate)) {
      score += 14;
      reasons.push("Due today");
    }
  } else {
    score += 10;
    reasons.push("No next date");
  }

  if (lead.samplePosterSent) {
    score += 8;
    reasons.push("Sample sent");
  }

  if (lead.expectedValue >= 10000) {
    score += 10;
    reasons.push("High value");
  } else if (lead.expectedValue >= 5000) {
    score += 6;
    reasons.push("Package value");
  }

  if (daysSinceLastTouch != null && daysSinceLastTouch >= 5) {
    score += 12;
    reasons.push(`${daysSinceLastTouch} days untouched`);
  }

  if (leadFollowups.length >= 2) {
    score += 4;
    reasons.push("Multiple touches");
  }

  const finalScore = Math.max(0, Math.min(100, score));

  return {
    lead,
    score: finalScore,
    band: finalScore >= 75 ? "Priority" : finalScore >= 50 ? "Healthy" : "Nurture",
    ageDays,
    daysSinceLastTouch,
    lastTouchDate,
    reasons: reasons.slice(0, 4),
  };
}

export function leadScoreDistribution(scores: LeadScore[]) {
  return scores.reduce<Record<string, number>>(
    (acc, score) => {
      acc[score.band] = (acc[score.band] || 0) + 1;
      return acc;
    },
    { Priority: 0, Healthy: 0, Nurture: 0, Closed: 0 },
  );
}

export function getLeadAgingReport(leads: Lead[], date = todayIso()) {
  const open = openLeads(leads);
  const rows = open.map((lead) => ({
    lead,
    ageDays: daysBetweenIso(getLocalDateFromValue(lead.createdAt), date),
    bucket: agingBucketForDays(daysBetweenIso(getLocalDateFromValue(lead.createdAt), date)),
  }));
  const buckets = agingBucketLabels.reduce<Record<string, number>>((acc, label) => {
    acc[label] = rows.filter((row) => row.bucket === label).length;
    return acc;
  }, {});

  return {
    buckets,
    staleLeads: rows
      .filter((row) => row.ageDays >= 8)
      .sort((a, b) => b.ageDays - a.ageDays)
      .slice(0, 20),
    rows,
  };
}

export function getFollowupAuditRows(
  leads: Lead[],
  followups: Followup[],
  date = todayIso(),
) {
  const followupsByLead = groupFollowupsByLead(followups);

  return openLeads(leads)
    .flatMap((lead) => {
      const timeline = buildLeadContactTimeline(lead.firstContactDate, followupsByLead.get(lead.id) || []);
      return timeline
        .filter((item): item is Extract<LeadContactTimelineItem, { kind: "followup" }> => item.kind === "followup")
        .map<FollowupAuditRow>((item) => buildFollowupAuditRow(lead, item, date));
    })
    .sort(compareFollowupAuditRows);
}

export function followupAuditSummary(rows: FollowupAuditRow[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] || 0) + 1;
    return acc;
  }, {});
}

export function whatsappTemplatePerformance(
  leads: Lead[],
  activityLogs: ActivityLog[],
) {
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const rows = new Map<
    WhatsappTemplateKey,
    {
      template: WhatsappTemplateKey;
      opens: number;
      leadIds: Set<string>;
      wonLeadIds: Set<string>;
      sampleLeadIds: Set<string>;
      latestOpenAt: string;
    }
  >();

  activityLogs
    .filter((log) => log.action === "WhatsApp opened")
    .forEach((log) => {
      const template = normalizeTemplateKey(log.newValue);
      const current =
        rows.get(template) ||
        {
          template,
          opens: 0,
          leadIds: new Set<string>(),
          wonLeadIds: new Set<string>(),
          sampleLeadIds: new Set<string>(),
          latestOpenAt: "",
        };
      const lead = leadById.get(log.leadId);
      current.opens += 1;
      current.leadIds.add(log.leadId);
      if (lead?.leadStage === "Won") current.wonLeadIds.add(log.leadId);
      if (lead?.samplePosterSent) current.sampleLeadIds.add(log.leadId);
      if (!current.latestOpenAt || log.createdAt > current.latestOpenAt) {
        current.latestOpenAt = log.createdAt;
      }
      rows.set(template, current);
    });

  return Array.from(rows.values())
    .map<TemplatePerformanceRow>((row) => ({
      template: row.template,
      opens: row.opens,
      uniqueLeads: row.leadIds.size,
      wonLeads: row.wonLeadIds.size,
      sampleSentLeads: row.sampleLeadIds.size,
      conversionRate: percentage(row.wonLeadIds.size, row.leadIds.size),
      latestOpenAt: row.latestOpenAt,
    }))
    .sort((a, b) => b.opens - a.opens || b.conversionRate - a.conversionRate);
}

export function getDataQualityReport(leads: Lead[]) {
  const active = activeLeads(leads);
  const open = openLeads(leads);
  const duplicatePhones = duplicateGroups(active, (lead) => normalizeImportPhone(lead.phone));
  const duplicateUrls = duplicateGroups(active, (lead) => normalizeImportUrl(lead.leadUrl));
  const missingPhone = active.filter((lead) => !normalizeImportPhone(lead.phone));
  const missingUrl = active.filter((lead) => !normalizeImportUrl(lead.leadUrl));
  const missingFirstContactDate = active.filter((lead) => !lead.firstContactDate);
  const missingNextFollowupDate = open.filter((lead) => !lead.nextFollowupDate);
  const missingRemarks = active.filter((lead) => !lead.remarks.trim());
  const missingIndustry = active.filter((lead) => !lead.industry.trim());
  const missingSource = active.filter((lead) => !lead.source.trim());
  const staleOpenLeads = getLeadAgingReport(leads).staleLeads.map((row) => row.lead);
  const issueCounts = {
    "Duplicate phones": duplicatePhones.length,
    "Duplicate URLs": duplicateUrls.length,
    "Missing phone": missingPhone.length,
    "Missing URL": missingUrl.length,
    "Missing first contact": missingFirstContactDate.length,
    "Missing next follow-up": missingNextFollowupDate.length,
    "Missing remarks": missingRemarks.length,
    "Missing industry": missingIndustry.length,
    "Missing source": missingSource.length,
    "Open 8+ days": staleOpenLeads.length,
  };
  const totalIssueWeight = Object.values(issueCounts).reduce((sum, count) => sum + count, 0);
  const possible = Math.max(active.length * 5, 1);
  const qualityScore = Math.max(0, Math.min(100, 100 - Math.round((totalIssueWeight / possible) * 100)));

  return {
    qualityScore,
    issueCounts,
    duplicatePhones,
    duplicateUrls,
    missingPhone,
    missingUrl,
    missingFirstContactDate,
    missingNextFollowupDate,
    missingRemarks,
    missingIndustry,
    missingSource,
    staleOpenLeads,
  };
}

export function samplePosterWorkflow(leads: Lead[], followups: Followup[]) {
  const followupsByLead = groupFollowupsByLead(followups);
  const open = openLeads(leads);
  const sampleCandidates = open
    .filter((lead) => !lead.samplePosterSent)
    .filter(isSampleCandidate)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const sentNeedsFollowup = open
    .filter((lead) => lead.samplePosterSent)
    .filter((lead) => {
      const sampleDate = getLocalDateFromValue(lead.samplePosterSentAt);
      const followupAfterSample = (followupsByLead.get(lead.id) || []).some(
        (followup) => !sampleDate || followup.followupDate >= sampleDate,
      );
      return !followupAfterSample || isToday(lead.nextFollowupDate) || isOverdue(lead.nextFollowupDate);
    })
    .sort((a, b) => (a.nextFollowupDate || "9999-12-31").localeCompare(b.nextFollowupDate || "9999-12-31"));
  const sampleWins = activeLeads(leads).filter((lead) => lead.samplePosterSent && lead.leadStage === "Won");

  return {
    sampleCandidates,
    sentNeedsFollowup,
    sampleWins,
    sampleSentOpen: open.filter((lead) => lead.samplePosterSent).length,
  };
}

export function dailyCallReport(
  followups: Followup[],
  activityLogs: ActivityLog[] = [],
  date = todayIso(),
  leads: Lead[] = [],
) {
  return dailyCommunicationReport(followups, activityLogs, date, leads);
}

export function dailyCommunicationReport(
  followups: Followup[],
  activityLogs: ActivityLog[] = [],
  date = todayIso(),
  leads: Lead[] = [],
) {
  const hourlyCalls = emptyHourlyBuckets();
  const hourlyFollowups = emptyHourlyBuckets();
  const hourlyMessages = emptyHourlyBuckets();
  const hourlyLeadCreations = emptyHourlyBuckets();
  const hourlyActivity = emptyHourlyBuckets();
  const outcomeCounts: Record<string, number> = {};
  const followupTypeCounts: Record<string, number> = {};
  const followupOutcomeCounts: Record<string, number> = {};
  const messageCounts: Record<string, number> = {};
  const leadSourceCounts: Record<string, number> = {};
  const parsedFollowupLogs = activityLogs
    .filter((log) => log.action === "Follow-up added")
    .map(parseFollowupLog);
  const followupLogs = parsedFollowupLogs.filter(
    (log) => getLocalDateFromValue(log.createdAt) === date,
  );
  const whatsappOpenLogs = activityLogs
    .filter(
      (log) =>
        log.action === "WhatsApp opened" &&
        getLocalDateFromValue(log.createdAt) === date,
    )
    .map((log) => ({
      id: log.id,
      type: "WhatsApp",
      outcome: log.newValue || "Custom Message",
      createdAt: log.createdAt,
      source: "WhatsApp opened",
    }));
  const fallbackFollowups = followups.filter(
    (followup) =>
      getLocalDateFromValue(followup.markedAt || followup.createdAt || followup.followupDate) === date,
  );
  const followupRecords = followupLogs.length
    ? followupLogs.map((log) => ({
        ...log,
        source: "Activity logs",
      }))
    : fallbackFollowups.map((followup) => ({
        id: followup.id,
        type: followup.followupType,
        outcome: followup.outcome,
        createdAt: followup.markedAt || followup.createdAt || followup.followupDate,
        source: "Follow-up records",
      }));
  const calls = followupRecords.filter((followup) => followup.type === "Call");
  const loggedMessages = followupRecords.filter((followup) => isMessageFollowupType(followup.type));
  const messages = [...whatsappOpenLogs, ...loggedMessages];
  const leadsCreated = leads.filter((lead) => getLocalDateFromValue(lead.createdAt) === date);

  followupRecords.forEach((followup) => {
    const hour = getLocalHourLabel(followup.createdAt);
    hourlyFollowups[hour] = (hourlyFollowups[hour] || 0) + 1;
    hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
    followupTypeCounts[followup.type] = (followupTypeCounts[followup.type] || 0) + 1;
    followupOutcomeCounts[followup.outcome] = (followupOutcomeCounts[followup.outcome] || 0) + 1;
  });

  calls.forEach((call) => {
    const hour = getLocalHourLabel(call.createdAt);
    hourlyCalls[hour] = (hourlyCalls[hour] || 0) + 1;
    outcomeCounts[call.outcome] = (outcomeCounts[call.outcome] || 0) + 1;
  });

  messages.forEach((message) => {
    const hour = getLocalHourLabel(message.createdAt);
    hourlyMessages[hour] = (hourlyMessages[hour] || 0) + 1;
    if (message.source === "WhatsApp opened") {
      hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
    }
    const label = message.source === "WhatsApp opened"
      ? `Template: ${message.outcome}`
      : `${message.type}: ${message.outcome}`;
    messageCounts[label] = (messageCounts[label] || 0) + 1;
  });

  leadsCreated.forEach((lead) => {
    const hour = getLocalHourLabel(lead.createdAt);
    hourlyLeadCreations[hour] = (hourlyLeadCreations[hour] || 0) + 1;
    hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
    const source = lead.source || "Not Set";
    leadSourceCounts[source] = (leadSourceCounts[source] || 0) + 1;
  });

  const topHourEntry = Object.entries(hourlyCalls).sort((a, b) => b[1] - a[1])[0];
  const topFollowupHourEntry = Object.entries(hourlyFollowups).sort((a, b) => b[1] - a[1])[0];
  const topMessageHourEntry = Object.entries(hourlyMessages).sort((a, b) => b[1] - a[1])[0];
  const topLeadCreationHourEntry = Object.entries(hourlyLeadCreations).sort((a, b) => b[1] - a[1])[0];
  const topActivityHourEntry = Object.entries(hourlyActivity).sort((a, b) => b[1] - a[1])[0];

  return {
    date,
    leadsCreated: leadsCreated.length,
    totalFollowups: followupRecords.length,
    totalCalls: calls.length,
    totalMessages: messages.length,
    totalActivities: followupRecords.length + whatsappOpenLogs.length + leadsCreated.length,
    outcomeCounts,
    followupTypeCounts,
    followupOutcomeCounts,
    messageCounts,
    leadSourceCounts,
    hourlyCalls,
    hourlyFollowups,
    hourlyMessages,
    hourlyLeadCreations,
    hourlyActivity,
    topHour: topHourEntry && topHourEntry[1] > 0 ? topHourEntry[0] : "No calls",
    topFollowupHour: topFollowupHourEntry && topFollowupHourEntry[1] > 0 ? topFollowupHourEntry[0] : "No follow-ups",
    topMessageHour: topMessageHourEntry && topMessageHourEntry[1] > 0 ? topMessageHourEntry[0] : "No messages",
    topLeadCreationHour: topLeadCreationHourEntry && topLeadCreationHourEntry[1] > 0 ? topLeadCreationHourEntry[0] : "No leads",
    topActivityHour: topActivityHourEntry && topActivityHourEntry[1] > 0 ? topActivityHourEntry[0] : "No activity",
    source: followupLogs.length ? "Activity logs" : "Follow-up records",
    messageSource: followupLogs.length || whatsappOpenLogs.length ? "Activity logs" : "Follow-up records",
    followups: followupRecords,
    calls,
    messages,
    createdLeads: leadsCreated,
  };
}

export function dailyActivityLogReport(activityLogs: ActivityLog[], date = todayIso()) {
  const hourlyLogs = emptyHourlyBuckets();
  const actionCounts: Record<string, number> = {};
  const logs = activityLogs.filter((log) => getLocalDateFromValue(log.createdAt) === date);

  logs.forEach((log) => {
    const hour = getLocalHourLabel(log.createdAt);
    hourlyLogs[hour] = (hourlyLogs[hour] || 0) + 1;
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
  });

  const topHourEntry = Object.entries(hourlyLogs).sort((a, b) => b[1] - a[1])[0];

  return {
    date,
    totalLogs: logs.length,
    actionCounts,
    hourlyLogs,
    topHour: topHourEntry && topHourEntry[1] > 0 ? topHourEntry[0] : "No activity",
    logs,
  };
}

export function getOperationsKpis(
  clients: StudioClient[],
  projects: StudioProject[],
  posterSlots: PosterSlot[],
) {
  const today = todayIso();
  const renewalWindow = offsetDate(30);
  const thisMonth = today.slice(0, 7);
  const activeClients = clients.filter((client) => client.status !== "Closed");
  const activeProjects = projects.filter((project) => !["Delivered", "On Hold"].includes(project.status));
  const monthSlots = posterSlots.filter((slot) => slot.slotDate.startsWith(thisMonth));
  const postedMonthSlots = monthSlots.filter((slot) => slot.status === "Posted");
  const pendingApprovals = posterSlots.filter((slot) => ["Review", "Approved"].includes(slot.status)).length;
  const renewalsNext30 = activeClients.filter(
    (client) => client.renewalDate && client.renewalDate >= today && client.renewalDate <= renewalWindow,
  ).length;
  const monthlyRecurringRevenue = activeClients.reduce(
    (sum, client) => sum + client.monthlyValue,
    0,
  );

  return {
    activeClients: activeClients.length,
    activeProjects: activeProjects.length,
    posterSlotsThisMonth: monthSlots.length,
    postersPostedThisMonth: postedMonthSlots.length,
    pendingApprovals,
    renewalsNext30,
    monthlyRecurringRevenue,
  };
}

export function clientStatusChart(clients: StudioClient[]) {
  return clients.reduce<Record<string, number>>((acc, client) => {
    acc[client.status] = (acc[client.status] || 0) + 1;
    return acc;
  }, {});
}

export function projectStatusChart(projects: StudioProject[]) {
  return projects.reduce<Record<string, number>>((acc, project) => {
    acc[project.status] = (acc[project.status] || 0) + 1;
    return acc;
  }, {});
}

export function posterStatusChart(posterSlots: PosterSlot[]) {
  return posterSlots.reduce<Record<string, number>>((acc, slot) => {
    acc[slot.status] = (acc[slot.status] || 0) + 1;
    return acc;
  }, {});
}

export function designerWorkloadChart(
  projects: StudioProject[],
  posterSlots: PosterSlot[],
) {
  return [...projects, ...posterSlots].reduce<Record<string, number>>((acc, item) => {
    const designer = item.designer || "Unassigned";
    acc[designer] = (acc[designer] || 0) + 1;
    return acc;
  }, {});
}

export function renewalRows(clients: StudioClient[]) {
  return [...clients]
    .filter((client) => client.status !== "Closed" && Boolean(client.renewalDate))
    .sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));
}

function isTerminalLead(lead: Pick<Lead, "leadStage">) {
  return terminalLeadStages.includes(lead.leadStage);
}

function percentage(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function groupFollowupsByLead(followups: Followup[]) {
  return followups.reduce<Map<string, Followup[]>>((acc, followup) => {
    const rows = acc.get(followup.leadId) || [];
    rows.push(followup);
    acc.set(followup.leadId, rows);
    return acc;
  }, new Map());
}

function buildFollowupAuditRow(
  lead: Lead,
  item: Extract<LeadContactTimelineItem, { kind: "followup" }>,
  date: string,
): FollowupAuditRow {
  const completed = item.completedFollowup;
  const delayWorkingDays = item.delayWorkingDays || 0;
  const status = getFollowupAuditStatus(item, date);

  return {
    lead,
    label: item.label,
    scheduledDate: item.date,
    actualDate: item.actualDate || "",
    markedAt: item.markedAt || completed?.createdAt || "",
    status,
    delayWorkingDays,
    delayText: completed ? formatFollowupDelay(delayWorkingDays) : "",
    remarks: completed?.remarks || "",
    outcome: completed?.outcome || "",
    followupType: completed?.followupType || "",
    followupId: completed?.id || "",
  };
}

function getFollowupAuditStatus(
  item: Extract<LeadContactTimelineItem, { kind: "followup" }>,
  date: string,
): FollowupAuditRow["status"] {
  if (!item.date) return "No Schedule";
  if (item.completedFollowup) {
    if ((item.delayWorkingDays || 0) > 0) return "Completed Late";
    if ((item.delayWorkingDays || 0) < 0) return "Completed Early";
    return "Completed On Time";
  }
  if (item.date < date) return "Pending Late";
  if (item.date === date) return "Due Today";
  return "Scheduled";
}

function compareFollowupAuditRows(a: FollowupAuditRow, b: FollowupAuditRow) {
  const priority: Record<FollowupAuditRow["status"], number> = {
    "Pending Late": 0,
    "Due Today": 1,
    "Completed Late": 2,
    "Completed Early": 3,
    "Completed On Time": 4,
    Scheduled: 5,
    "No Schedule": 6,
  };

  return (
    priority[a.status] - priority[b.status] ||
    (a.scheduledDate || "9999-12-31").localeCompare(b.scheduledDate || "9999-12-31") ||
    a.lead.createdAt.localeCompare(b.lead.createdAt)
  );
}

function duplicateGroups(leads: Lead[], getKey: (lead: Lead) => string) {
  const groups = leads.reduce<Map<string, Lead[]>>((acc, lead) => {
    const key = getKey(lead);
    if (!key) return acc;
    const rows = acc.get(key) || [];
    rows.push(lead);
    acc.set(key, rows);
    return acc;
  }, new Map());

  return Array.from(groups.entries())
    .filter(([, rows]) => rows.length > 1)
    .map<DataQualityGroup>(([key, rows]) => ({ key, leads: rows }));
}

function normalizeTemplateKey(value: string): WhatsappTemplateKey {
  const template = value.trim() as WhatsappTemplateKey;
  return template || "Custom Message";
}

function isSampleCandidate(lead: Lead) {
  const text = `${lead.remarks} ${lead.objectionReason} ${lead.leadStage}`.toLowerCase();
  return (
    lead.leadTemperature !== "Cold" ||
    lead.objectionReason === "Price High" ||
    lead.objectionReason === "Already Has Team" ||
    lead.objectionReason === "Already Has Agency" ||
    lead.objectionReason === "Need Time" ||
    lead.objectionReason === "No Budget" ||
    lead.objectionReason === "Not Interested Now" ||
    lead.objectionReason === "Will Contact Later" ||
    /\b(sample|expensive|price|designer|agency|team|think|not now|next month|question|doubt)\b/.test(text)
  );
}

function agingBucketForDays(days: number) {
  if (days <= 2) return "0-2 days";
  if (days <= 7) return "3-7 days";
  if (days <= 14) return "8-14 days";
  if (days <= 30) return "15-30 days";
  return "31+ days";
}

function daysBetweenIso(startIso: string, endIso: string) {
  if (!startIso || !endIso) return 0;
  const start = new Date(`${startIso}T12:00:00.000Z`);
  const end = new Date(`${endIso}T12:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function emptyHourlyBuckets() {
  return Array.from({ length: 24 }, (_, index) => `${String(index).padStart(2, "0")}:00`).reduce<
    Record<string, number>
  >((acc, hour) => {
    acc[hour] = 0;
    return acc;
  }, {});
}

function getLocalDateFromValue(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return toLocalIsoDate(date);
}

function getLocalHourLabel(value: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00+05:30`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  return `${hour}:00`;
}

function parseFollowupLog(log: ActivityLog) {
  const value = log.newValue.trim();
  const type = followupTypeOptions.find((option) => value.startsWith(`${option} - `)) || "Call";
  const outcomeText = type === "Call" && !value.startsWith("Call - ")
    ? value
    : value.replace(new RegExp(`^${escapeRegExp(type)}\\s+-\\s+`), "");
  const outcome =
    followupOutcomeOptions.find((option) => outcomeText.startsWith(option)) || "Call Back Later";

  return {
    id: log.id,
    type,
    outcome,
    createdAt: log.createdAt,
  };
}

function isMessageFollowupType(type: string) {
  return type === "WhatsApp" || type === "Instagram DM";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
