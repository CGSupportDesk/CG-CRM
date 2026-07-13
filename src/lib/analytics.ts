import type {
  ActivityLog,
  Followup,
  Lead,
  LeadStage,
  LeadTemperature,
  PosterSlot,
  StudioClient,
  StudioProject,
} from "./types";
import { followupOutcomeOptions, followupTypeOptions } from "./constants";
import { isOverdue, isToday, offsetDate, startOfWeekIso, todayIso, toLocalIsoDate } from "./utils";

const terminalLeadStages: LeadStage[] = ["Won", "Lost", "Rejected"];

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
