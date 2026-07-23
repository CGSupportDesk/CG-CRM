"use client";

import { useState } from "react";
import { Button, FieldLabel, inputClasses } from "@/components/ui";
import { followupOutcomeOptions, followupTypeOptions } from "@/lib/constants";
import { formatFollowupDelay, getNextFollowupDateForNewFollowup, getWorkingDayDelta, isTerminalOutcome } from "@/lib/followup-schedule";
import type { Followup, FollowupDraft, Lead } from "@/lib/types";
import { formatDate, formatDateTime, todayIso } from "@/lib/utils";

export function FollowupForm({
  leads,
  followups = [],
  fixedLeadId,
  onSubmit,
  onCancel,
}: {
  leads: Lead[];
  followups?: Followup[];
  fixedLeadId?: string;
  onSubmit: (draft: FollowupDraft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<FollowupDraft>({
    leadId: fixedLeadId || leads[0]?.id || "",
    followupDate: todayIso(),
    followupType: "Call",
    outcome: "Call Back Later",
    nextFollowupDate: "",
    remarks: "",
    createdBy: "captain",
  });
  const [markedAt] = useState(() => new Date().toISOString());
  const [overrideNextDate, setOverrideNextDate] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const selectedLead = leads.find((lead) => lead.id === draft.leadId);
  const existingFollowups = followups.filter((followup) => followup.leadId === draft.leadId);
  const scheduledFollowupDate = draft.scheduledFollowupDate || selectedLead?.nextFollowupDate || draft.followupDate;
  const calculatedNextFollowupDate = selectedLead
    ? getNextFollowupDateForNewFollowup(
        selectedLead,
        existingFollowups,
        draft.followupDate,
        draft.outcome,
      )
    : "";

  function setField<Key extends keyof FollowupDraft>(key: Key, value: FollowupDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    const nextErrors: Record<string, string> = {};
    if (!draft.leadId) nextErrors.leadId = "Choose a lead.";
    if (!draft.followupDate) nextErrors.followupDate = "Choose the follow-up date.";
    if (overrideNextDate && !isTerminalOutcome(draft.outcome) && !draft.nextFollowupDate) {
      nextErrors.nextFollowupDate = "Choose the override next follow-up date.";
    }
    if (!draft.remarks.trim()) nextErrors.remarks = "Remarks are mandatory before saving.";
    setErrors(nextErrors);

    if (!Object.keys(nextErrors).length) {
      onSubmit({
        ...draft,
        scheduledFollowupDate,
        markedAt,
        nextFollowupDate: overrideNextDate && !isTerminalOutcome(draft.outcome)
          ? draft.nextFollowupDate
          : calculatedNextFollowupDate,
        remarks: draft.remarks.trim(),
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
        {!fixedLeadId ? (
          <FieldLabel label="Lead" error={errors.leadId}>
            <select
              className={inputClasses}
              value={draft.leadId}
              onChange={(event) => setField("leadId", event.target.value)}
            >
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.businessName || lead.leadName}
                </option>
              ))}
            </select>
          </FieldLabel>
        ) : null}
        <FieldLabel label="Actual Follow-up Date" error={errors.followupDate}>
          <input
            type="date"
            className={inputClasses}
            value={draft.followupDate}
            onInput={(event) => setField("followupDate", event.currentTarget.value)}
            onChange={(event) => setField("followupDate", event.target.value)}
          />
        </FieldLabel>
        <FieldLabel label="Scheduled Date (Plan)">
          <div className={`${inputClasses} flex items-center bg-surface-soft text-muted`}>
            {formatDate(scheduledFollowupDate, "No scheduled date")}
          </div>
        </FieldLabel>
        <FieldLabel label="Marked Date">
          <div className={`${inputClasses} flex items-center bg-surface-soft text-muted`}>
            {formatDateTime(markedAt)}
          </div>
        </FieldLabel>
        <FieldLabel label="Delay Tracking">
          <div className={`${inputClasses} flex items-center bg-surface-soft text-muted`}>
            {formatFollowupDelay(getWorkingDayDelta(scheduledFollowupDate, draft.followupDate))}
          </div>
        </FieldLabel>
        <FieldLabel label="Follow-up Type">
          <select
            className={inputClasses}
            value={draft.followupType}
            onChange={(event) => setField("followupType", event.target.value as FollowupDraft["followupType"])}
          >
            {followupTypeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Outcome">
          <select
            className={inputClasses}
            value={draft.outcome}
            onChange={(event) => setField("outcome", event.target.value as FollowupDraft["outcome"])}
          >
            {followupOutcomeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Next Follow-up Date (Auto)">
          <div className={`${inputClasses} flex items-center bg-surface-soft text-muted`}>
            {formatDate(calculatedNextFollowupDate, "No next follow-up")}
          </div>
        </FieldLabel>
        <FieldLabel label="Override Next Follow-up" error={errors.nextFollowupDate}>
          <div className="space-y-2">
            <label className={`${inputClasses} flex cursor-pointer items-center justify-between gap-3`}>
              <span className="text-sm font-semibold">Use manual date</span>
              <input
                type="checkbox"
                checked={overrideNextDate}
                disabled={isTerminalOutcome(draft.outcome)}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setOverrideNextDate(checked);
                  if (checked && !draft.nextFollowupDate) {
                    setField("nextFollowupDate", calculatedNextFollowupDate || selectedLead?.nextFollowupDate || "");
                  }
                }}
              />
            </label>
            {overrideNextDate && !isTerminalOutcome(draft.outcome) ? (
              <input
                type="date"
                className={inputClasses}
                value={draft.nextFollowupDate}
                onChange={(event) => setField("nextFollowupDate", event.target.value)}
              />
            ) : (
              <p className="text-xs font-semibold text-muted">
                Auto schedule is used unless manual date is enabled.
              </p>
            )}
          </div>
        </FieldLabel>
      </div>
      <FieldLabel label="Remarks" error={errors.remarks}>
        <textarea
          className={`${inputClasses} min-h-28 py-3`}
          value={draft.remarks}
          onChange={(event) => setField("remarks", event.target.value)}
          placeholder="What happened on this follow-up?"
        />
      </FieldLabel>
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save Follow-up</Button>
      </div>
    </form>
  );
}
