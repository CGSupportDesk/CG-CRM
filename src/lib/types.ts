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

export interface CRMState {
  leads: Lead[];
  followups: Followup[];
  activityLogs: ActivityLog[];
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
