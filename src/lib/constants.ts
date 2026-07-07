import type {
  ClientStatus,
  FollowupOutcome,
  FollowupType,
  LeadStage,
  LeadTemperature,
  ObjectionReason,
  PaymentStatus,
  PosterSlotStatus,
  ProjectStatus,
  ProjectType,
  ServiceInterest,
  StudioSettingCategory,
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

export const designerOptions = [DEFAULT_ASSIGNEE, "Sachin", "Kristom"];

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
  { label: "Daily Sales", href: "/daily-sales" },
  { label: "Leads", href: "/leads" },
  { label: "Follow-ups", href: "/follow-ups" },
  { label: "Reports", href: "/reports" },
];

export const clientStatusOptions: ClientStatus[] = [
  "Active",
  "Onboarding",
  "Paused",
  "Renewal Due",
  "Closed",
];

export const paymentStatusOptions: PaymentStatus[] = [
  "Not Started",
  "Advance Paid",
  "Partially Paid",
  "Paid",
  "Overdue",
];

export const projectTypeOptions: ProjectType[] = [
  "Poster Package",
  "Branding",
  "One-time Creative",
  "Maintenance",
];

export const projectStatusOptions: ProjectStatus[] = [
  "Planning",
  "In Progress",
  "In Review",
  "Approved",
  "Delivered",
  "On Hold",
];

export const posterSlotStatusOptions: PosterSlotStatus[] = [
  "Planned",
  "Designing",
  "Review",
  "Approved",
  "Scheduled",
  "Posted",
];

export const settingCategoryOptions: StudioSettingCategory[] = [
  "Package",
  "Industry",
  "Team Member",
  "Lead Status",
  "Lead Source",
  "Project Status",
];

export const cgStudioModules = [
  { label: "Clients", href: "/clients", status: "Active" },
  { label: "Projects", href: "/projects", status: "Active" },
  { label: "Poster Calendar", href: "/poster-calendar", status: "Active" },
  { label: "Website Projects", href: "/website-projects", status: "Coming Soon" },
  { label: "Payments", href: "/payments", status: "Coming Soon" },
  { label: "Settings", href: "/settings", status: "Active" },
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
  "Clients",
  "Projects",
  "Poster Calendar",
  "Settings",
];

export const futureModules = [
  "Website Projects",
  "Payments",
  "YAA",
  "Hiring",
  "Outsourcing",
];
