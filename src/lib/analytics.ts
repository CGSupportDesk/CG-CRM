import type { Followup, Lead, LeadStage, LeadTemperature } from "./types";
import { isOverdue, isToday, startOfWeekIso, todayIso } from "./utils";

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

function isTerminalLead(lead: Pick<Lead, "leadStage">) {
  return terminalLeadStages.includes(lead.leadStage);
}
