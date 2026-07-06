"use client";

import { useMemo, useState } from "react";
import { Button, FieldLabel, inputClasses } from "@/components/ui";
import {
  leadStageOptions,
  leadTemperatureOptions,
  objectionReasonOptions,
  serviceInterestOptions,
} from "@/lib/constants";
import { getInitialLeadNextFollowupDate } from "@/lib/followup-schedule";
import type { Lead, LeadDraft } from "@/lib/types";

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
  assignedTo: "captain",
  remarks: "",
};

export function LeadForm({
  lead,
  onSubmit,
  onCancel,
}: {
  lead?: Lead;
  onSubmit: (draft: LeadDraft) => void;
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
            source: lead.source,
            leadTemperature: lead.leadTemperature,
            leadStage: lead.leadStage,
            serviceInterest: lead.serviceInterest,
            expectedValue: lead.expectedValue,
            objectionReason: lead.objectionReason,
            firstContactDate: lead.firstContactDate,
            nextFollowupDate: lead.nextFollowupDate,
            assignedTo: lead.assignedTo,
            remarks: lead.remarks,
          }
        : defaultDraft,
    [lead],
  );
  const [draft, setDraft] = useState<LeadDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const calculatedNextFollowupDate = getInitialLeadNextFollowupDate(
    draft.firstContactDate,
    draft.leadStage,
  );

  function setField<Key extends keyof LeadDraft>(key: Key, value: LeadDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit() {
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
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      onSubmit({
        ...draft,
        leadName: draft.leadName.trim() || draft.businessName.trim(),
        businessName: draft.businessName.trim() || draft.leadName.trim(),
        nextFollowupDate: calculatedNextFollowupDate,
      });
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Lead URL"
          value={draft.leadUrl}
          onChange={(value) => setField("leadUrl", value)}
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
        <TextField
          label="Source"
          value={draft.source}
          onChange={(value) => setField("source", value)}
          placeholder="Instagram, Referral, Cold Call"
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
        <TextField
          label="Assigned To"
          value={draft.assignedTo}
          onChange={(value) => setField("assignedTo", value)}
          placeholder="captain"
        />
      </div>
      <FieldLabel label="Remarks">
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
        <Button type="submit">{lead ? "Save Changes" : "Add Lead"}</Button>
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
