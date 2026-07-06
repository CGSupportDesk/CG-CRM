import type {
  FollowupOutcome,
  FollowupType,
  LeadStage,
  LeadTemperature,
  ObjectionReason,
  ServiceInterest,
} from "./types";

export const leadTemperatureOptions: LeadTemperature[] = ["Hot", "Warm", "Cold"];

export const leadStageOptions: LeadStage[] = [
  "New Lead",
  "Contacted",
  "Details Sent",
  "Follow-up Needed",
  "Proposal Sent",
  "Won",
  "Lost",
  "Rejected",
  "No Response",
];

export const serviceInterestOptions: ServiceInterest[] = [
  "30 Poster Package",
  "15 Posters Monthly Package",
  "Website",
  "Posters + Website",
  "Branding",
  "One-time Creative",
  "Maintenance",
  "Not Sure",
];

export const objectionReasonOptions: ObjectionReason[] = [
  "Price High",
  "Already Has Team",
  "Already Has Agency",
  "Need Time",
  "No Budget",
  "No Response",
  "Wants Videos",
  "Not Decision Maker",
  "Not Interested Now",
  "Will Contact Later",
  "Other",
];

export const followupTypeOptions: FollowupType[] = [
  "Call",
  "WhatsApp",
  "Instagram DM",
  "Meeting",
];

export const followupOutcomeOptions: FollowupOutcome[] = [
  "No Response",
  "Call Back Later",
  "Details Sent",
  "Interested",
  "Not Interested",
  "Asked for Price",
  "Proposal Requested",
  "Converted",
  "Rejected",
];

export const DEFAULT_ASSIGNEE = "Naveen";

export const assigneeOptions = [DEFAULT_ASSIGNEE, "Sachin", "Kristom"];

export const DEFAULT_INDUSTRY = "Other Services";

export const leadSourceOptions = [
  "Instagram",
  "Facebook",
  "WhatsApp",
  "Referral",
  "Website",
  "CSV Import",
  "Other",
];

export const primaryModules = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Leads", href: "/leads" },
  { label: "Follow-ups", href: "/follow-ups" },
  { label: "Reports", href: "/reports" },
];

export const cgStudioModules = [
  { label: "Clients", href: "/clients" },
  { label: "Projects", href: "/projects" },
  { label: "Poster Calendar", href: "/poster-calendar" },
  { label: "Website Projects", href: "/website-projects" },
  { label: "Payments", href: "/payments" },
  { label: "Settings", href: "/settings" },
];

export const wingCards = [
  {
    title: "CG Studio",
    status: "Active",
    href: "/dashboard",
    description:
      "Lead tracking, follow-ups, poster enquiries, website enquiries, creative service leads, and sales dashboards.",
  },
  {
    title: "YAA",
    status: "Coming Soon",
    href: "/wings/yaa",
    description:
      "Future workspace for career programs, student leads, training enquiries, onboarding, and progress tracking.",
  },
  {
    title: "Hiring",
    status: "Coming Soon",
    href: "/wings/hiring",
    description:
      "Future workspace for recruitment leads, clients, job openings, candidates, vendors, and placement tracking.",
  },
  {
    title: "Outsourcing",
    status: "Coming Soon",
    href: "/wings/outsourcing",
    description:
      "Future workspace for outsourcing clients, team allocation, task delivery, monthly billing, and operations tracking.",
  },
];

export const phaseOneModules = [
  "Dashboard",
  "Leads",
  "Follow-ups",
  "Reports",
  "CSV Import",
];

export const futureModules = [
  "Clients",
  "Projects",
  "Poster Calendar",
  "Website Projects",
  "Payments",
  "Settings",
  "YAA",
  "Hiring",
  "Outsourcing",
];
