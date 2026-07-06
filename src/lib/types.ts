export type LeadTemperature = "Hot" | "Warm" | "Cold";

export type LeadStage =
  | "New Lead"
  | "Contacted"
  | "Details Sent"
  | "Follow-up Needed"
  | "Proposal Sent"
  | "Won"
  | "Lost"
  | "Rejected"
  | "No Response";

export type ServiceInterest =
  | "30 Poster Package"
  | "15 Posters Monthly Package"
  | "Website"
  | "Posters + Website"
  | "Branding"
  | "One-time Creative"
  | "Maintenance"
  | "Not Sure";

export type ObjectionReason =
  | "Price High"
  | "Already Has Team"
  | "Already Has Agency"
  | "Need Time"
  | "No Budget"
  | "No Response"
  | "Wants Videos"
  | "Not Decision Maker"
  | "Not Interested Now"
  | "Will Contact Later"
  | "Other";

export type FollowupType = "Call" | "WhatsApp" | "Instagram DM" | "Meeting";

export type FollowupOutcome =
  | "No Response"
  | "Call Back Later"
  | "Details Sent"
  | "Interested"
  | "Not Interested"
  | "Asked for Price"
  | "Proposal Requested"
  | "Converted"
  | "Rejected";

export type WingStatus = "Active" | "Coming Soon";

export interface Lead {
  id: string;
  leadUrl: string;
  leadName: string;
  businessName: string;
  contactPerson: string;
  phone: string;
  email: string;
  industry: string;
  location: string;
  source: string;
  leadTemperature: LeadTemperature;
  leadStage: LeadStage;
  serviceInterest: ServiceInterest;
  expectedValue: number;
  objectionReason: ObjectionReason | "";
  firstContactDate: string;
  nextFollowupDate: string;
  remarks: string;
  assignedTo: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type LeadDraft = Omit<
  Lead,
  "id" | "isArchived" | "createdAt" | "updatedAt"
>;

export interface Followup {
  id: string;
  leadId: string;
  followupDate: string;
  followupType: FollowupType;
  outcome: FollowupOutcome;
  nextFollowupDate: string;
  remarks: string;
  createdBy: string;
  createdAt: string;
}

export type FollowupDraft = Omit<Followup, "id" | "createdAt">;

export interface ActivityLog {
  id: string;
  leadId: string;
  action: string;
  oldValue: string;
  newValue: string;
  createdBy: string;
  createdAt: string;
}

export type ClientStatus = "Active" | "Onboarding" | "Paused" | "Renewal Due" | "Closed";

export interface StudioClient {
  id: string;
  leadId: string;
  clientName: string;
  contactPerson: string;
  phone: string;
  email: string;
  industry: string;
  location: string;
  packageName: ServiceInterest;
  monthlyValue: number;
  owner: string;
  status: ClientStatus;
  startDate: string;
  renewalDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type StudioClientDraft = Omit<StudioClient, "id" | "createdAt" | "updatedAt">;

export type ProjectType =
  | "Poster Package"
  | "Branding"
  | "One-time Creative"
  | "Maintenance";

export type ProjectStatus =
  | "Planning"
  | "In Progress"
  | "In Review"
  | "Approved"
  | "Delivered"
  | "On Hold";

export interface StudioProject {
  id: string;
  clientId: string;
  projectName: string;
  projectType: ProjectType;
  status: ProjectStatus;
  designer: string;
  monthlyPosterTarget: number;
  postersCompleted: number;
  dueDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type StudioProjectDraft = Omit<StudioProject, "id" | "createdAt" | "updatedAt">;

export type PosterSlotStatus =
  | "Planned"
  | "Designing"
  | "Review"
  | "Approved"
  | "Scheduled"
  | "Posted";

export interface PosterSlot {
  id: string;
  projectId: string;
  clientId: string;
  title: string;
  slotDate: string;
  designer: string;
  status: PosterSlotStatus;
  captionRequired: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type PosterSlotDraft = Omit<PosterSlot, "id" | "createdAt" | "updatedAt">;

export type StudioSettingCategory =
  | "Package"
  | "Industry"
  | "Team Member"
  | "Lead Status"
  | "Lead Source"
  | "Project Status";

export interface StudioSetting {
  id: string;
  category: StudioSettingCategory;
  label: string;
  value: string;
  isActive: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type StudioSettingDraft = Omit<StudioSetting, "id" | "createdAt" | "updatedAt">;

export interface CRMState {
  leads: Lead[];
  followups: Followup[];
  activityLogs: ActivityLog[];
  clients: StudioClient[];
  projects: StudioProject[];
  posterSlots: PosterSlot[];
  settings: StudioSetting[];
}

export interface ImportPreviewRow {
  rowNumber: number;
  lead: LeadDraft;
  followups: Array<Omit<FollowupDraft, "leadId">>;
  warnings: string[];
}

export interface ImportPreview {
  rows: ImportPreviewRow[];
  errors: string[];
  totalRows: number;
}

export interface ImportSummary {
  leadsImported: number;
  followupsImported: number;
  skippedRows: number;
}

export type WhatsappTemplateKey =
  | "First Contact"
  | "Follow-up"
  | "Details Sent"
  | "Proposal Follow-up"
  | "Final Follow-up"
  | "Custom Message";

export interface SmartLeadSuggestion {
  summary: string;
  confidence: number;
  suggestedLead: Partial<LeadDraft>;
  reasons: string[];
  warnings: string[];
  recommendedWhatsappTemplate: WhatsappTemplateKey;
}

export interface ImportCleanupRowSuggestion {
  rowNumber: number;
  confidence: number;
  suggestedLead: Partial<LeadDraft>;
  warnings: string[];
  notes: string;
}

export interface ImportCleanupResult {
  overview: string;
  rows: ImportCleanupRowSuggestion[];
}

export interface DailyBriefPriority {
  leadId: string;
  leadName: string;
  reason: string;
  action: string;
  recommendedWhatsappTemplate: WhatsappTemplateKey;
}

export interface DailyBrief {
  generatedAt: string;
  headline: string;
  focus: string;
  priorities: DailyBriefPriority[];
  todayPlan: string[];
  risks: string[];
  quickWins: string[];
}

export interface ReportAiInsight {
  title: string;
  detail: string;
  action: string;
}

export interface ReportInsights {
  generatedAt: string;
  executiveSummary: string;
  insights: ReportAiInsight[];
  risks: ReportAiInsight[];
  opportunities: ReportAiInsight[];
  nextActions: string[];
}
