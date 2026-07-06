import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";
import {
  activeLeads,
  followupDueChart,
  getKpis,
  industryChart,
  leadStageChart,
  leadTemperatureChart,
  objectionChart,
} from "@/lib/analytics";
import { generateGroqJson, hasGroqConfig } from "@/lib/ai/groq";
import { DEFAULT_ASSIGNEE, leadSourceOptions, leadStageOptions, leadTemperatureOptions, objectionReasonOptions, serviceInterestOptions } from "@/lib/constants";
import { getCrmState, hasDatabaseUrl } from "@/lib/crm-db";
import type {
  DailyBrief,
  ImportCleanupResult,
  ImportPreviewRow,
  Lead,
  LeadDraft,
  ReportInsights,
  SmartLeadSuggestion,
  WhatsappTemplateKey,
} from "@/lib/types";
import { isOverdue, isToday, todayIso, truncate } from "@/lib/utils";
import { whatsappTemplateContext, whatsappTemplateOptions } from "@/lib/whatsapp-templates";

export const dynamic = "force-dynamic";

type AiAction =
  | { action: "smartLeadDraft"; draft: Partial<LeadDraft> }
  | { action: "importCleanup"; rows: ImportPreviewRow[] }
  | { action: "dailyBrief" }
  | { action: "reportInsights" };

export async function POST(request: Request) {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  if (!hasGroqConfig()) {
    return NextResponse.json({ error: "Groq is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as AiAction | null;
  if (!body?.action) {
    return NextResponse.json({ error: "Missing AI action." }, { status: 400 });
  }

  try {
    if (body.action === "smartLeadDraft") {
      return NextResponse.json(await suggestLeadDraft(body.draft));
    }
    if (body.action === "importCleanup") {
      return NextResponse.json(await cleanupImportRows(body.rows));
    }
    if (body.action === "dailyBrief") {
      return NextResponse.json(await buildDailyBrief());
    }
    if (body.action === "reportInsights") {
      return NextResponse.json(await buildReportInsights());
    }

    return NextResponse.json({ error: "Unknown AI action." }, { status: 400 });
  } catch (error) {
    console.error("Growth Engine AI API error", error);
    return NextResponse.json(
      { error: "AI request failed. Please try again." },
      { status: 500 },
    );
  }
}

async function suggestLeadDraft(draft: Partial<LeadDraft>): Promise<SmartLeadSuggestion> {
  const result = await generateGroqJson<SmartLeadSuggestion>({
    maxTokens: 1200,
    messages: [
      {
        role: "system",
        content: [
          "You are Growth Engine's internal CRM assistant for Closing Gap Studio.",
          "Focus on the 30 Poster Package campaign.",
          "Return strict JSON only.",
          "Never invent phone numbers, emails, dates, or URLs.",
          "Preserve original remarks unless the user clearly pasted rough notes that need a cleaner CRM note.",
          `Allowed lead temperatures: ${leadTemperatureOptions.join(", ")}.`,
          `Allowed lead stages: ${leadStageOptions.join(", ")}.`,
          `Allowed service interests: ${serviceInterestOptions.join(", ")}.`,
          `Allowed objection reasons: ${["", ...objectionReasonOptions].join(", ")}.`,
          `Allowed sources: ${leadSourceOptions.join(", ")}.`,
          whatsappTemplateContext,
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          task:
            "Suggest CRM fields for this lead. Fill only what can be inferred. Return: summary, confidence 0-100, suggestedLead, reasons, warnings, recommendedWhatsappTemplate.",
          draft,
        }),
      },
    ],
  });

  return {
    summary: text(result.summary),
    confidence: clampConfidence(result.confidence),
    suggestedLead: sanitizeLeadSuggestion(result.suggestedLead, "smart"),
    reasons: stringList(result.reasons).slice(0, 5),
    warnings: stringList(result.warnings).slice(0, 5),
    recommendedWhatsappTemplate: normalizeTemplate(result.recommendedWhatsappTemplate),
  };
}

async function cleanupImportRows(rows: ImportPreviewRow[]): Promise<ImportCleanupResult> {
  const compactRows = rows.slice(0, 30).map((row) => ({
    rowNumber: row.rowNumber,
    leadUrl: row.lead.leadUrl,
    leadName: row.lead.leadName,
    businessName: row.lead.businessName,
    contactPerson: row.lead.contactPerson,
    phoneAvailable: Boolean(row.lead.phone),
    industry: row.lead.industry,
    source: row.lead.source,
    leadTemperature: row.lead.leadTemperature,
    leadStage: row.lead.leadStage,
    objectionReason: row.lead.objectionReason,
    remarks: truncate(row.lead.remarks, 240),
    followupCount: row.followups.length,
  }));

  const result = await generateGroqJson<ImportCleanupResult>({
    maxTokens: 2600,
    messages: [
      {
        role: "system",
        content: [
          "You are cleaning a Growth Engine import preview for Closing Gap Studio.",
          "Return strict JSON only.",
          "Do not change phone numbers, original remarks, contact dates, follow-up dates, or lead URLs.",
          "Only improve inferred CRM fields: leadName, businessName, contactPerson, industry, source, leadTemperature, leadStage, serviceInterest, expectedValue, objectionReason.",
          "Use serviceInterest as 30 Poster Package and expectedValue as 5000 unless clearly impossible.",
          `Allowed lead temperatures: ${leadTemperatureOptions.join(", ")}.`,
          `Allowed lead stages: ${leadStageOptions.join(", ")}.`,
          `Allowed objection reasons: ${["", ...objectionReasonOptions].join(", ")}.`,
          `Allowed sources: ${leadSourceOptions.join(", ")}.`,
          "Industries should be practical labels like Restaurant & Food, Salon & Beauty, Healthcare, Retail, Fitness & Sports, Real Estate & Interiors, Education, Events, Travel & Hospitality, Other Services.",
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          task:
            "For every row, return rowNumber, confidence 0-100, suggestedLead, warnings, notes. Include all rowNumbers.",
          rows: compactRows,
        }),
      },
    ],
  });

  const requestedRows = new Set(compactRows.map((row) => row.rowNumber));
  return {
    overview: text(result.overview),
    rows: (Array.isArray(result.rows) ? result.rows : [])
      .filter((row) => requestedRows.has(Number(row.rowNumber)))
      .map((row) => ({
        rowNumber: Number(row.rowNumber),
        confidence: clampConfidence(row.confidence),
        suggestedLead: sanitizeLeadSuggestion(row.suggestedLead, "import"),
        warnings: stringList(row.warnings).slice(0, 4),
        notes: text(row.notes),
      })),
  };
}

async function buildDailyBrief(): Promise<DailyBrief> {
  const state = await readStateForAi();
  const active = activeLeads(state.leads);
  const kpis = getKpis(state.leads);
  const priorityLeads = active
    .filter((lead) => !["Won", "Lost", "Rejected"].includes(lead.leadStage))
    .sort((a, b) => priorityScore(b) - priorityScore(a))
    .slice(0, 24)
    .map(compactLead);

  const result = await generateGroqJson<DailyBrief>({
    maxTokens: 1800,
    messages: [
      {
        role: "system",
        content: [
          "You are Growth Engine's daily sales brief assistant for Closing Gap Studio.",
          "Return strict JSON only. No markdown.",
          "Be practical, short, and action-oriented for Naveen.",
          "Use the 30 Poster Package campaign context: Rs 4,999 per month for 30 custom posts.",
          whatsappTemplateContext,
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          today: todayIso(),
          kpis,
          followupDue: followupDueChart(state.leads),
          temperatures: leadTemperatureChart(state.leads),
          stages: leadStageChart(state.leads),
          topIndustries: industryChart(state.leads),
          topObjections: objectionChart(state.leads),
          priorityLeads,
          requiredShape:
            "Return generatedAt, headline, focus, priorities[{leadId,leadName,reason,action,recommendedWhatsappTemplate}], todayPlan[], risks[], quickWins[].",
        }),
      },
    ],
  });

  return sanitizeDailyBrief(result, active);
}

async function buildReportInsights(): Promise<ReportInsights> {
  const state = await readStateForAi();
  const kpis = getKpis(state.leads);

  const result = await generateGroqJson<ReportInsights>({
    maxTokens: 2200,
    messages: [
      {
        role: "system",
        content: [
          "You are Growth Engine's CRM reporting analyst for Closing Gap Studio.",
          "Return strict JSON only. No markdown.",
          "Explain what the numbers mean and what the sales team should do next.",
          "Focus only on lead performance, follow-ups, rejection reasons, industries, conversion, and expected revenue.",
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          today: todayIso(),
          kpis,
          followupDue: followupDueChart(state.leads),
          temperatures: leadTemperatureChart(state.leads),
          stages: leadStageChart(state.leads),
          industries: industryChart(state.leads),
          objections: objectionChart(state.leads),
          requiredShape:
            "Return generatedAt, executiveSummary, insights[{title,detail,action}], risks[{title,detail,action}], opportunities[{title,detail,action}], nextActions[].",
        }),
      },
    ],
  });

  return sanitizeReportInsights(result);
}

async function readStateForAi() {
  if (!hasDatabaseUrl()) {
    throw new Error("Database is not configured.");
  }

  return getCrmState();
}

function sanitizeLeadSuggestion(
  value: unknown,
  mode: "smart" | "import",
): Partial<LeadDraft> {
  const input = isRecord(value) ? value : {};
  const output: Partial<LeadDraft> = {};
  const stringFields: Array<keyof LeadDraft> = [
    "leadName",
    "businessName",
    "contactPerson",
    "email",
    "industry",
    "location",
    "remarks",
  ];

  for (const field of stringFields) {
    if (mode === "import" && ["email", "location", "remarks"].includes(field)) continue;
    const valueText = text(input[field]);
    if (valueText) output[field] = valueText as never;
  }

  const source = pickAllowed(input.source, leadSourceOptions);
  if (source) output.source = source;

  const leadTemperature = pickAllowed(input.leadTemperature, leadTemperatureOptions);
  if (leadTemperature) output.leadTemperature = leadTemperature;

  const leadStage = pickAllowed(input.leadStage, leadStageOptions);
  if (leadStage) output.leadStage = leadStage;

  const serviceInterest = pickAllowed(input.serviceInterest, serviceInterestOptions);
  output.serviceInterest = serviceInterest || "30 Poster Package";

  const objectionReason = pickAllowed(input.objectionReason, ["", ...objectionReasonOptions]);
  if (objectionReason !== undefined) output.objectionReason = objectionReason;

  const expectedValue = Number(input.expectedValue);
  if (Number.isFinite(expectedValue) && expectedValue >= 0) output.expectedValue = expectedValue;
  else output.expectedValue = 5000;

  if (mode === "smart") {
    const phone = text(input.phone);
    const leadUrl = text(input.leadUrl);
    if (phone) output.phone = phone;
    if (leadUrl) output.leadUrl = leadUrl;
  }

  output.assignedTo = DEFAULT_ASSIGNEE;
  return output;
}

function sanitizeDailyBrief(result: DailyBrief, leads: Lead[]): DailyBrief {
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  return {
    generatedAt: new Date().toISOString(),
    headline: text(result.headline) || "Daily Growth Brief",
    focus: text(result.focus),
    priorities: (Array.isArray(result.priorities) ? result.priorities : [])
      .filter((item) => leadById.has(text(item.leadId)))
      .slice(0, 6)
      .map((item) => ({
        leadId: text(item.leadId),
        leadName: text(item.leadName) || leadById.get(text(item.leadId))?.businessName || "Lead",
        reason: text(item.reason),
        action: text(item.action),
        recommendedWhatsappTemplate: normalizeTemplate(item.recommendedWhatsappTemplate),
      })),
    todayPlan: stringList(result.todayPlan).slice(0, 6),
    risks: stringList(result.risks).slice(0, 5),
    quickWins: stringList(result.quickWins).slice(0, 5),
  };
}

function sanitizeReportInsights(result: ReportInsights): ReportInsights {
  return {
    generatedAt: new Date().toISOString(),
    executiveSummary: text(result.executiveSummary),
    insights: insightList(result.insights),
    risks: insightList(result.risks),
    opportunities: insightList(result.opportunities),
    nextActions: stringList(result.nextActions).slice(0, 6),
  };
}

function insightList(value: unknown) {
  return (Array.isArray(value) ? value : [])
    .map((item) => (isRecord(item) ? item : {}))
    .map((item) => ({
      title: text(item.title),
      detail: text(item.detail),
      action: text(item.action),
    }))
    .filter((item) => item.title || item.detail || item.action)
    .slice(0, 5);
}

function compactLead(lead: Lead) {
  return {
    id: lead.id,
    name: lead.businessName || lead.leadName || lead.contactPerson,
    phoneAvailable: Boolean(lead.phone),
    industry: lead.industry,
    source: lead.source,
    temperature: lead.leadTemperature,
    stage: lead.leadStage,
    nextFollowupDate: lead.nextFollowupDate,
    firstContactDate: lead.firstContactDate,
    assignedTo: lead.assignedTo || DEFAULT_ASSIGNEE,
    objectionReason: lead.objectionReason,
    remarks: truncate(lead.remarks, 180),
  };
}

function priorityScore(lead: Lead) {
  let score = 0;
  if (lead.leadTemperature === "Hot") score += 8;
  if (lead.leadTemperature === "Warm") score += 4;
  if (lead.leadStage === "No Response") score += 3;
  if (isOverdue(lead.nextFollowupDate)) score += 10;
  if (isToday(lead.nextFollowupDate)) score += 7;
  if (!lead.nextFollowupDate) score += 2;
  return score;
}

function normalizeTemplate(value: unknown): WhatsappTemplateKey {
  const selected = whatsappTemplateOptions.find(
    (option) => option.toLowerCase() === text(value).toLowerCase(),
  );
  return selected || "None";
}

function pickAllowed<T extends string>(value: unknown, options: T[]): T | undefined {
  const normalized = text(value).toLowerCase();
  return options.find((option) => option.toLowerCase() === normalized);
}

function clampConfidence(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function stringList(value: unknown) {
  return (Array.isArray(value) ? value : [])
    .map(text)
    .filter(Boolean);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function requireSession() {
  const cookieStore = await cookies();
  if (!isValidSession(cookieStore.get(SESSION_COOKIE)?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
