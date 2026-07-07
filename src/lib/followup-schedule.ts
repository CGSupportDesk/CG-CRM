import type { Followup, FollowupOutcome, Lead, LeadStage } from "./types";

const FOLLOWUP_WORKING_DAY_GAPS = [1, 2, 2, 3] as const;
const ONGOING_FOLLOWUP_WORKING_DAY_GAP = 3;
const TERMINAL_LEAD_STAGES: LeadStage[] = ["Won", "Lost", "Rejected"];
const TERMINAL_FOLLOWUP_OUTCOMES: FollowupOutcome[] = ["Converted", "Rejected"];

type ScheduleFollowup = Pick<Followup, "followupDate" | "outcome" | "createdAt"> & {
  id?: string;
};

export type LeadContactTimelineItem =
  | {
      kind: "contact";
      label: "Contacted";
      date: string;
      contactNumber: 1;
    }
  | {
      kind: "followup";
      label: string;
      date: string;
      followupNumber: number;
      contactNumber: number;
    };

export function addWorkingDays(startIso: string, workingDays: number) {
  const date = parseIsoDate(startIso);
  if (!date || workingDays <= 0) return "";

  let added = 0;
  while (added < workingDays) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (isWorkingDay(date)) added += 1;
  }

  return toIsoDate(date);
}

export function buildFollowupSchedule(firstContactDate: string) {
  const secondContact = getNextFollowupDateAfterContact(firstContactDate, 1);
  const thirdContact = getNextFollowupDateAfterContact(secondContact, 2);
  const fourthContact = getNextFollowupDateAfterContact(thirdContact, 3);
  const fifthContact = getNextFollowupDateAfterContact(fourthContact, 4);

  return [secondContact, thirdContact, fourthContact, fifthContact];
}

export function buildLeadContactTimeline(
  firstContactDate: string,
  followupCount = 5,
): LeadContactTimelineItem[] {
  const timeline: LeadContactTimelineItem[] = [
    {
      kind: "contact",
      label: "Contacted",
      date: firstContactDate,
      contactNumber: 1,
    },
  ];

  let previousDate = firstContactDate;
  for (let index = 1; index <= followupCount; index += 1) {
    const nextDate = previousDate
      ? getNextFollowupDateAfterContact(previousDate, index)
      : "";
    timeline.push({
      kind: "followup",
      label: `F${index}`,
      date: nextDate,
      followupNumber: index,
      contactNumber: index + 1,
    });
    previousDate = nextDate;
  }

  return timeline;
}

export function getNextFollowupDateAfterContact(
  contactDate: string,
  contactNumber: number,
  outcome?: FollowupOutcome,
) {
  if (!contactDate || isTerminalOutcome(outcome)) return "";

  const gap =
    FOLLOWUP_WORKING_DAY_GAPS[contactNumber - 1] || ONGOING_FOLLOWUP_WORKING_DAY_GAP;
  return addWorkingDays(contactDate, gap);
}

export function getInitialLeadNextFollowupDate(
  firstContactDate: string,
  leadStage?: LeadStage,
) {
  if (!firstContactDate || isTerminalStage(leadStage)) return "";
  return getNextFollowupDateAfterContact(firstContactDate, 1);
}

export function getNextFollowupDateForNewFollowup(
  lead: Pick<Lead, "firstContactDate" | "leadStage">,
  existingFollowups: ScheduleFollowup[],
  followupDate: string,
  outcome?: FollowupOutcome,
) {
  if (isTerminalStage(lead.leadStage) || isTerminalOutcome(outcome)) return "";

  const completedFollowups = sortFollowups(existingFollowups).length;
  const currentContactNumber = completedFollowups + 2;

  return getNextFollowupDateAfterContact(followupDate, currentContactNumber, outcome);
}

export function getNextFollowupDateForLead(
  lead: Pick<Lead, "firstContactDate" | "leadStage">,
  followups: ScheduleFollowup[],
) {
  if (isTerminalStage(lead.leadStage)) return "";

  const sortedFollowups = sortFollowups(followups);
  const latestFollowup = sortedFollowups[sortedFollowups.length - 1];
  if (!latestFollowup) return getInitialLeadNextFollowupDate(lead.firstContactDate, lead.leadStage);

  return getNextFollowupDateAfterContact(
    latestFollowup.followupDate,
    sortedFollowups.length + 1,
    latestFollowup.outcome,
  );
}

export function getScheduledNextDateForFollowup(
  followup: ScheduleFollowup,
  completedFollowupsBeforeIt: number,
) {
  const contactNumber = completedFollowupsBeforeIt + 2;
  return getNextFollowupDateAfterContact(
    followup.followupDate,
    contactNumber,
    followup.outcome,
  );
}

export function sortFollowups<T extends ScheduleFollowup>(followups: T[]) {
  return [...followups].sort((a, b) => {
    const dateCompare = a.followupDate.localeCompare(b.followupDate);
    if (dateCompare !== 0) return dateCompare;
    return (a.createdAt || "").localeCompare(b.createdAt || "");
  });
}

export function isTerminalStage(stage?: LeadStage) {
  return Boolean(stage && TERMINAL_LEAD_STAGES.includes(stage));
}

export function isTerminalOutcome(outcome?: FollowupOutcome) {
  return Boolean(outcome && TERMINAL_FOLLOWUP_OUTCOMES.includes(outcome));
}

function isWorkingDay(date: Date) {
  const day = date.getUTCDay();
  return day >= 1 && day <= 5;
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
