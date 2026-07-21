"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Badge, Button, FieldLabel, inputClasses } from "@/components/ui";
import {
  DEFAULT_ASSIGNEE,
  assigneeOptions,
  leadSourceOptions,
  leadStageOptions,
  leadTemperatureOptions,
  objectionReasonOptions,
  serviceInterestOptions,
} from "@/lib/constants";
import { getInitialLeadNextFollowupDate } from "@/lib/followup-schedule";
import { inferLeadSourceFromUrl } from "@/lib/lead-normalization";
import type { Lead, LeadDraft, SmartLeadSuggestion } from "@/lib/types";

const defaultDraft: LeadDraft = {
  leadUrl: "",
  leadName: "",
  businessName: "",
  contactPerson: "",
  phone: "",
  email: "",
  industry: "",
  location: "",
  source: "Instagram",
  leadTemperature: "Warm",
  leadStage: "New Lead",
  serviceInterest: "30 Poster Package",
  expectedValue: 5000,
  objectionReason: "",
  firstContactDate: "",
  nextFollowupDate: "",
  assignedTo: DEFAULT_ASSIGNEE,
  samplePosterSent: false,
  samplePosterSentAt: "",
  remarks: "",
};

export function LeadForm({
  lead,
  onSubmit,
  onCancel,
}: {
  lead?: Lead;
  onSubmit: (draft: LeadDraft) => Promise<void> | void;
  onCancel: () => void;
}) {
  const initial = useMemo<LeadDraft>(
    () =>
      lead
        ? {
            leadUrl: lead.leadUrl,
            leadName: lead.leadName,
            businessName: lead.businessName,
            contactPerson: lead.contactPerson,
            phone: lead.phone,
            email: lead.email,
            industry: lead.industry,
            location: lead.location,
            source: lead.source || inferLeadSourceFromUrl(lead.leadUrl) || defaultDraft.source,
            leadTemperature: lead.leadTemperature,
            leadStage: lead.leadStage,
            serviceInterest: lead.serviceInterest,
            expectedValue: lead.expectedValue,
            objectionReason: lead.objectionReason,
            firstContactDate: lead.firstContactDate,
            nextFollowupDate: lead.nextFollowupDate,
            assignedTo: lead.assignedTo || DEFAULT_ASSIGNEE,
            samplePosterSent: lead.samplePosterSent,
            samplePosterSentAt: lead.samplePosterSentAt,
            remarks: lead.remarks,
          }
        : defaultDraft,
    [lead],
  );
  const [draft, setDraft] = useState<LeadDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<SmartLeadSuggestion | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const sourceOptions = useMemo(
    () => Array.from(new Set([...leadSourceOptions, draft.source].filter(Boolean))),
    [draft.source],
  );
  const assigneeSelectOptions = useMemo(
    () => Array.from(new Set([...assigneeOptions, draft.assignedTo].filter(Boolean))),
    [draft.assignedTo],
  );
  const calculatedNextFollowupDate = getInitialLeadNextFollowupDate(
    draft.firstContactDate,
    draft.leadStage,
  );
  const formChecks = [
    { label: "Name", done: Boolean(draft.leadName.trim() || draft.businessName.trim()) },
    { label: "Phone / URL", done: Boolean(draft.phone.trim() || draft.leadUrl.trim()) },
    { label: "First Contact", done: Boolean(draft.firstContactDate) },
    { label: "Remarks", done: Boolean(draft.remarks.trim()) },
    { label: "Auto Follow-up", done: Boolean(calculatedNextFollowupDate) || ["Won", "Lost", "Rejected"].includes(draft.leadStage) },
  ];
  const completedChecks = formChecks.filter((item) => item.done).length;

  function setField<Key extends keyof LeadDraft>(key: Key, value: LeadDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function setLeadUrl(value: string) {
    setDraft((current) => ({
      ...current,
      leadUrl: value,
      source: inferLeadSourceFromUrl(value) || current.source,
    }));
  }

  function setSamplePosterSent(value: boolean) {
    setDraft((current) => ({
      ...current,
      samplePosterSent: value,
      samplePosterSentAt: value ? current.samplePosterSentAt || new Date().toISOString() : "",
    }));
  }

  async function suggestWithAi() {
    setAiLoading(true);
    setAiError("");
    setAiSuggestion(null);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "smartLeadDraft", draft }),
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(error?.error || `AI request failed with ${response.status}`);
      }

      setAiSuggestion((await response.json()) as SmartLeadSuggestion);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Could not generate AI suggestions.");
    } finally {
      setAiLoading(false);
    }
  }

  function applyAiSuggestion() {
    if (!aiSuggestion) return;

    setDraft((current) => ({
      ...current,
      ...removeEmptySuggestion(aiSuggestion.suggestedLead),
      leadUrl: current.leadUrl,
      firstContactDate: current.firstContactDate,
      nextFollowupDate: current.nextFollowupDate,
      assignedTo: current.assignedTo,
    }));
  }

  async function submit() {
    if (submitting) return;

    const nextErrors: Record<string, string> = {};
    if (!draft.leadName.trim() && !draft.businessName.trim()) {
      nextErrors.leadName = "Add a lead name or business name.";
    }
    if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
      nextErrors.email = "Enter a valid email address or leave it blank.";
    }
    if (draft.expectedValue < 0) {
      nextErrors.expectedValue = "Expected value cannot be negative.";
    }
    if (!draft.remarks.trim()) {
      nextErrors.remarks = "Remarks are mandatory before saving.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      setSubmitting(true);
      try {
        await onSubmit({
          ...draft,
          leadName: draft.leadName.trim() || draft.businessName.trim(),
          businessName: draft.businessName.trim() || draft.leadName.trim(),
          nextFollowupDate: calculatedNextFollowupDate,
          remarks: draft.remarks.trim(),
        });
      } finally {
        setSubmitting(false);
      }
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-3 rounded-[20px] border border-border bg-white p-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">Lead entry checklist</p>
            <Badge tone={completedChecks === formChecks.length ? "success" : "info"}>
              {completedChecks}/{formChecks.length} ready
            </Badge>
          </div>
          <p className="mt-1 text-sm leading-6 text-muted">
            Fill the essentials first. Growth Engine will generate the next follow-up from the first contact date.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 md:justify-end">
          {formChecks.map((item) => (
            <span
              key={item.label}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                item.done
                  ? "border-[#b8ead6] bg-[#eafaf3] text-[#0c7c52]"
                  : "border-[#d8e0e4] bg-surface-soft text-muted"
              }`}
            >
              {item.done ? <CheckCircle2 className="h-3 w-3" /> : null}
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-[20px] border border-border bg-surface-soft p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">Smart Data Entry</p>
              <span className="rounded-full border border-[#cddcff] bg-[#eef4ff] px-2.5 py-1 text-[11px] font-bold text-[#2f5edb]">
                Groq
              </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-muted">
              Paste the URL, name, phone, and remarks first. AI can suggest industry, source, stage, temperature, objection, and package fields.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={suggestWithAi} disabled={aiLoading}>
            <Sparkles className="h-4 w-4" />
            {aiLoading ? "Suggesting..." : "Suggest Fields"}
          </Button>
        </div>

        {aiError ? (
          <p className="mt-3 rounded-2xl border border-[#f7c7c7] bg-[#fff0f0] p-3 text-sm font-semibold text-[#bd2727]">
            {aiError}
          </p>
        ) : null}

        {aiSuggestion ? (
          <div className="mt-4 rounded-2xl border border-border bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold">{aiSuggestion.summary}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.08em] text-muted">
                  Confidence {aiSuggestion.confidence}% - Template: {aiSuggestion.recommendedWhatsappTemplate}
                </p>
              </div>
              <Button type="button" size="sm" onClick={applyAiSuggestion}>
                Apply Suggestions
              </Button>
            </div>
            {aiSuggestion.reasons.length ? (
              <ul className="mt-3 grid gap-1 text-sm leading-6 text-muted">
                {aiSuggestion.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
            {aiSuggestion.warnings.length ? (
              <div className="mt-3 rounded-2xl border border-[#ffe1a3] bg-[#fff7df] p-3 text-xs font-semibold leading-5 text-[#9b6a00]">
                {aiSuggestion.warnings.join(" ")}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Lead URL"
          value={draft.leadUrl}
          onChange={setLeadUrl}
          placeholder="https://www.instagram.com/example"
        />
        <TextField
          label="Lead Name"
          value={draft.leadName}
          onChange={(value) => setField("leadName", value)}
          error={errors.leadName}
          placeholder="Lead or profile name"
        />
        <TextField
          label="Business Name"
          value={draft.businessName}
          onChange={(value) => setField("businessName", value)}
          placeholder="Business name"
        />
        <TextField
          label="Contact Person"
          value={draft.contactPerson}
          onChange={(value) => setField("contactPerson", value)}
          placeholder="Owner or decision maker"
        />
        <TextField
          label="Phone"
          value={draft.phone}
          onChange={(value) => setField("phone", value)}
          placeholder="+91..."
        />
        <TextField
          label="Email"
          value={draft.email}
          onChange={(value) => setField("email", value)}
          error={errors.email}
          placeholder="name@example.com"
        />
        <TextField
          label="Industry"
          value={draft.industry}
          onChange={(value) => setField("industry", value)}
          placeholder="Restaurant, Salon, Clinic..."
        />
        <TextField
          label="Location"
          value={draft.location}
          onChange={(value) => setField("location", value)}
          placeholder="City"
        />
        <SelectField
          label="Source"
          value={draft.source}
          options={sourceOptions}
          onChange={(value) => setField("source", value)}
        />
        <SelectField
          label="Lead Temperature"
          value={draft.leadTemperature}
          options={leadTemperatureOptions}
          onChange={(value) => setField("leadTemperature", value as LeadDraft["leadTemperature"])}
        />
        <SelectField
          label="Lead Stage"
          value={draft.leadStage}
          options={leadStageOptions}
          onChange={(value) => setField("leadStage", value as LeadDraft["leadStage"])}
        />
        <SelectField
          label="Service Interest"
          value={draft.serviceInterest}
          options={serviceInterestOptions}
          onChange={(value) => setField("serviceInterest", value as LeadDraft["serviceInterest"])}
        />
        <TextField
          label="Expected Value"
          type="number"
          value={String(draft.expectedValue)}
          onChange={(value) => setField("expectedValue", Number(value || 0))}
          error={errors.expectedValue}
          placeholder="5000"
        />
        <SelectField
          label="Objection Reason"
          value={draft.objectionReason}
          options={["", ...objectionReasonOptions]}
          onChange={(value) => setField("objectionReason", value as LeadDraft["objectionReason"])}
        />
        <TextField
          label="First Contact Date"
          type="date"
          value={draft.firstContactDate}
          onChange={(value) => setField("firstContactDate", value)}
        />
        <TextField
          label="Next Follow-up Date (Auto)"
          type="date"
          value={calculatedNextFollowupDate}
          onChange={() => undefined}
          placeholder="Generated after first contact"
          readOnly
        />
        <SelectField
          label="Assigned To"
          value={draft.assignedTo}
          options={assigneeSelectOptions}
          onChange={(value) => setField("assignedTo", value)}
        />
        <FieldLabel label="Free Sample Poster">
          <label className={`${inputClasses} flex cursor-pointer items-center justify-between gap-3`}>
            <span className="text-sm font-semibold">
              {draft.samplePosterSent ? "Sample sent" : "Not sent yet"}
            </span>
            <input
              type="checkbox"
              checked={Boolean(draft.samplePosterSent)}
              onChange={(event) => setSamplePosterSent(event.target.checked)}
            />
          </label>
        </FieldLabel>
      </div>
      <div className="rounded-2xl border border-[#cddcff] bg-[#eef4ff] p-4 text-sm font-semibold text-[#2f5edb]">
        Auto follow-up preview:{" "}
        {calculatedNextFollowupDate
          ? `next contact is scheduled for ${calculatedNextFollowupDate}.`
          : "add a first contact date to generate the first follow-up date."}
      </div>
      <FieldLabel label="Remarks" error={errors.remarks}>
        <textarea
          className={`${inputClasses} min-h-28 py-3`}
          value={draft.remarks}
          onChange={(event) => setField("remarks", event.target.value)}
          placeholder="Preserve sales notes, objections, next action, and context."
        />
      </FieldLabel>
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : lead ? "Save Changes" : "Add Lead"}
        </Button>
      </div>
    </form>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  error,
  type = "text",
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <FieldLabel label={label} error={error}>
      <input
        className={`${inputClasses} ${readOnly ? "bg-surface-soft text-muted" : ""}`}
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
      />
    </FieldLabel>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <FieldLabel label={label}>
      <select
        className={inputClasses}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option || "blank"} value={option}>
            {option || "Not set"}
          </option>
        ))}
      </select>
    </FieldLabel>
  );
}

function removeEmptySuggestion(suggestion: Partial<LeadDraft>) {
  return Object.fromEntries(
    Object.entries(suggestion).filter(([, value]) => {
      if (typeof value === "string") return value.trim().length > 0;
      return value !== undefined && value !== null;
    }),
  ) as Partial<LeadDraft>;
}
