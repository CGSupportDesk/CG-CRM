"use client";

import Link from "next/link";
import { Archive, ArrowLeft, CheckCircle2, Edit3, MessageCircle, Phone, Plus, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useCRM } from "@/components/crm-provider";
import { FollowupForm } from "@/components/followup-form";
import { LeadForm } from "@/components/lead-form";
import { Badge, Button, EmptyState, FieldLabel, Modal, PageHeader, Panel, inputClasses } from "@/components/ui";
import { WhatsAppModal } from "@/components/whatsapp-modal";
import { leadStageOptions, leadTemperatureOptions } from "@/lib/constants";
import { formatFollowupDelay, getWorkingDayDelta } from "@/lib/followup-schedule";
import type { FollowupDraft, LeadDraft, LeadStage, LeadTemperature } from "@/lib/types";
import { formatCurrency, formatDate, formatDateTime, getDisplayName, isOverdue } from "@/lib/utils";

export function LeadDetailClient({ id }: { id: string }) {
  const {
    leads,
    followups,
    activityLogs,
    loading,
    updateLead,
    archiveLead,
    addFollowup,
    logLeadActivity,
  } = useCRM();
  const [showFollowupForm, setShowFollowupForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showWhatsappForm, setShowWhatsappForm] = useState(false);

  const lead = leads.find((item) => item.id === id);
  const leadFollowups = useMemo(
    () =>
      followups
        .filter((followup) => followup.leadId === id)
        .sort((a, b) => b.followupDate.localeCompare(a.followupDate)),
    [followups, id],
  );
  const leadActivity = useMemo(
    () =>
      activityLogs
        .filter((log) => log.leadId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [activityLogs, id],
  );

  if (loading) {
    return <EmptyState title="Loading lead" description="Opening the full lead profile." />;
  }

  if (!lead) {
    return (
      <EmptyState
        title="Lead not found"
        description="This lead may have been deleted from the local CRM data."
        action={<Link href="/leads" className="font-bold text-accent-dark">Back to Leads</Link>}
      />
    );
  }

  function quickUpdate(changes: Partial<LeadDraft>) {
    void updateLead(id, changes);
  }

  function submitFollowup(draft: FollowupDraft) {
    void addFollowup(draft);
    setShowFollowupForm(false);
  }

  function submitEdit(draft: LeadDraft) {
    void updateLead(id, draft);
    setShowEditForm(false);
  }

  return (
    <div className="space-y-6">
      <Link href="/leads" className="inline-flex items-center gap-2 text-sm font-bold text-muted">
        <ArrowLeft className="h-4 w-4" />
        Back to Leads
      </Link>
      <PageHeader
        title={getDisplayName(lead)}
        description={lead.remarks || "Full lead profile, status, follow-up history, and activity timeline."}
        action={
          <>
            <Button variant="secondary" onClick={() => setShowWhatsappForm(true)}>
              <MessageCircle className="h-4 w-4" />
              Send WhatsApp
            </Button>
            <Button variant="secondary" onClick={() => setShowEditForm(true)}>
              <Edit3 className="h-4 w-4" />
              Edit Lead
            </Button>
            <Button onClick={() => setShowFollowupForm(true)}>
              <Plus className="h-4 w-4" />
              Add Follow-up
            </Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel dark className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{lead.leadTemperature}</Badge>
            <Badge>{lead.leadStage}</Badge>
            {lead.isArchived ? <Badge tone="soon">Archived</Badge> : null}
            {isOverdue(lead.nextFollowupDate) ? <Badge tone="danger">Overdue</Badge> : null}
          </div>
          <div>
            <p className="text-sm text-[#aebcc4]">Contact</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">{lead.contactPerson || lead.leadName}</h2>
            <div className="mt-4 grid gap-3 text-sm text-[#cad6dc]">
              <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-accent" /> {lead.phone || "Phone unavailable"}</p>
              <p>{lead.email || "Email unavailable"}</p>
              <p>{lead.location || "Location not set"} - {lead.industry || "Industry not set"}</p>
              <p>{lead.leadUrl || "Lead URL not set"}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <DarkMetric label="Service Interest" value={lead.serviceInterest} />
            <DarkMetric label="Expected Value" value={formatCurrency(lead.expectedValue)} />
            <DarkMetric label="First Contact" value={formatDate(lead.firstContactDate)} />
            <DarkMetric label="Next Follow-up" value={formatDate(lead.nextFollowupDate, "No date")} />
          </div>
        </Panel>

        <Panel className="space-y-5">
          <h2 className="text-xl font-semibold">Quick actions</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <FieldLabel label="Lead Stage">
              <select
                className={inputClasses}
                value={lead.leadStage}
                onChange={(event) => quickUpdate({ leadStage: event.target.value as LeadStage })}
              >
                {leadStageOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Temperature">
              <select
                className={inputClasses}
                value={lead.leadTemperature}
                onChange={(event) => quickUpdate({ leadTemperature: event.target.value as LeadTemperature })}
              >
                {leadTemperatureOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Next Follow-up">
              <div className={`${inputClasses} flex items-center bg-surface-soft text-muted`}>
                {formatDate(lead.nextFollowupDate, "No next follow-up")}
              </div>
            </FieldLabel>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border pt-5">
            <Button variant="secondary" onClick={() => quickUpdate({ leadStage: "Won" })}>
              <CheckCircle2 className="h-4 w-4" />
              Mark Won
            </Button>
            <Button variant="secondary" onClick={() => quickUpdate({ leadStage: "Lost" })}>
              <XCircle className="h-4 w-4" />
              Mark Lost
            </Button>
            <Button variant="danger" onClick={() => quickUpdate({ leadStage: "Rejected" })}>
              Mark Rejected
            </Button>
            {!lead.isArchived ? (
              <Button variant="ghost" onClick={() => archiveLead(id)}>
                <Archive className="h-4 w-4" />
                Archive Lead
              </Button>
            ) : null}
          </div>
          <div className="rounded-[18px] border border-border bg-surface-soft p-5">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">Full Remarks</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{lead.remarks || "No remarks yet."}</p>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Follow-up history</h2>
            <Badge tone="neutral">{leadFollowups.length} records</Badge>
          </div>
          <div className="mt-5 space-y-3">
            {leadFollowups.length ? (
              leadFollowups.map((followup) => {
                const delay = getWorkingDayDelta(followup.scheduledFollowupDate, followup.followupDate);
                return (
                  <div key={followup.id} className="rounded-2xl border border-border bg-surface-soft p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold">Actual: {formatDate(followup.followupDate)}</p>
                        <p className="mt-1 text-xs text-muted">
                          Scheduled: {formatDate(followup.scheduledFollowupDate, "No schedule")} - Marked:{" "}
                          {formatDateTime(followup.markedAt || followup.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone={delay > 0 ? "warm" : "neutral"}>{formatFollowupDelay(delay)}</Badge>
                        <Badge tone="info">{followup.followupType}</Badge>
                        <Badge>{followup.outcome}</Badge>
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted">{followup.remarks || "No remarks."}</p>
                    {followup.nextFollowupDate ? (
                      <p className="mt-2 text-sm font-semibold">Next: {formatDate(followup.nextFollowupDate)}</p>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <EmptyState title="No follow-ups yet" description="Add the first call, WhatsApp, Instagram DM, or meeting record." />
            )}
          </div>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold">Activity timeline</h2>
          <div className="mt-5 space-y-3">
            {leadActivity.length ? (
              leadActivity.map((log) => (
                <div key={log.id} className="rounded-2xl border border-border bg-surface-soft p-4">
                  <p className="font-semibold">{log.action}</p>
                  <p className="mt-1 text-sm text-muted">{formatDateTime(log.createdAt)}</p>
                  {log.newValue ? (
                    <p className="mt-2 text-xs text-muted">
                      {log.oldValue ? `${log.oldValue} -> ` : ""}{log.newValue}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState title="No activity yet" description="Changes to this lead will appear here." />
            )}
          </div>
        </Panel>
      </div>

      {showFollowupForm ? (
        <Modal title="Add follow-up" description="Create an unlimited follow-up record for this lead." onClose={() => setShowFollowupForm(false)}>
          <FollowupForm
            leads={[lead]}
            followups={leadFollowups}
            fixedLeadId={lead.id}
            onSubmit={submitFollowup}
            onCancel={() => setShowFollowupForm(false)}
          />
        </Modal>
      ) : null}

      {showEditForm ? (
        <Modal title="Edit lead" description="Update the full CRM profile." onClose={() => setShowEditForm(false)} wide>
          <LeadForm lead={lead} onSubmit={submitEdit} onCancel={() => setShowEditForm(false)} />
        </Modal>
      ) : null}

      {showWhatsappForm ? (
        <Modal title="Send WhatsApp" description="Preview and edit the message before opening WhatsApp." onClose={() => setShowWhatsappForm(false)}>
          <WhatsAppModal
            recipient={lead}
            onClose={() => setShowWhatsappForm(false)}
            onOpened={(template) => logLeadActivity(lead.id, "WhatsApp opened", template)}
          />
        </Modal>
      ) : null}
    </div>
  );
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/8 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#aebcc4]">{label}</p>
      <p className="mt-2 font-semibold text-white">{value}</p>
    </div>
  );
}
