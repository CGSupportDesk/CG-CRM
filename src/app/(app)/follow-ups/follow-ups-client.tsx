"use client";

import Link from "next/link";
import { CalendarPlus, ExternalLink, MessageCircle, Plus } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useCRM } from "@/components/crm-provider";
import { FollowupForm } from "@/components/followup-form";
import { Badge, Button, EmptyState, Modal, PageHeader, Panel, inputClasses } from "@/components/ui";
import { WhatsAppModal } from "@/components/whatsapp-modal";
import { DEFAULT_ASSIGNEE, assigneeOptions, followupOutcomeOptions, followupTypeOptions } from "@/lib/constants";
import { getFollowupTasks } from "@/lib/analytics";
import type { FollowupDraft, Lead } from "@/lib/types";
import { formatDate, getDisplayName, isOverdue, isToday } from "@/lib/utils";

export function FollowUpsClient() {
  const { leads, followups, loading, addFollowup, updateFollowup, logLeadActivity } = useCRM();
  const [typeFilter, setTypeFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [whatsappLead, setWhatsappLead] = useState<Lead | null>(null);

  const leadById = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);
  const assignedPeople = useMemo(
    () =>
      Array.from(new Set([...assigneeOptions, ...leads.map((lead) => lead.assignedTo).filter(Boolean)])),
    [leads],
  );
  const tasks = getFollowupTasks(leads, followups).filter(({ lead, latestFollowup }) => {
    if (assignedFilter !== "all" && lead.assignedTo !== assignedFilter) return false;
    if (typeFilter !== "all" && latestFollowup?.followupType !== typeFilter) return false;
    if (outcomeFilter !== "all" && latestFollowup?.outcome !== outcomeFilter) return false;
    return true;
  });
  const todays = tasks.filter(({ lead }) => isToday(lead.nextFollowupDate));
  const overdue = tasks.filter(({ lead }) => isOverdue(lead.nextFollowupDate));
  const upcoming = tasks.filter(
    ({ lead }) => lead.nextFollowupDate && !isToday(lead.nextFollowupDate) && !isOverdue(lead.nextFollowupDate),
  );

  const filteredHistory = followups.filter((followup) => {
    const lead = leadById.get(followup.leadId);
    if (assignedFilter !== "all" && lead?.assignedTo !== assignedFilter) return false;
    if (typeFilter !== "all" && followup.followupType !== typeFilter) return false;
    if (outcomeFilter !== "all" && followup.outcome !== outcomeFilter) return false;
    return true;
  });

  function openForm(leadId?: string) {
    setSelectedLeadId(leadId || null);
    setShowForm(true);
  }

  function submitFollowup(draft: FollowupDraft) {
    addFollowup(draft);
    setShowForm(false);
    setSelectedLeadId(null);
  }

  if (loading) {
    return <EmptyState title="Loading follow-ups" description="Preparing today's calls and overdue follow-up queue." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Follow-ups"
        description="Manage today's calls, overdue leads, upcoming follow-ups, and unlimited follow-up records."
        action={
          <Button onClick={() => openForm()}>
            <Plus className="h-4 w-4" />
            Add Follow-up
          </Button>
        }
      />

      <Panel>
        <div className="grid gap-3 md:grid-cols-3">
          <FilterField label="Type">
            <FilterSelect value={typeFilter} onChange={setTypeFilter} options={["all", ...followupTypeOptions]} />
          </FilterField>
          <FilterField label="Outcome">
            <FilterSelect value={outcomeFilter} onChange={setOutcomeFilter} options={["all", ...followupOutcomeOptions]} />
          </FilterField>
          <FilterField label="Assigned To">
            <FilterSelect value={assignedFilter} onChange={setAssignedFilter} options={["all", ...assignedPeople]} />
          </FilterField>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-3">
        <TaskColumn title="Today's follow-ups" tone="success" items={todays} onAdd={openForm} onWhatsApp={setWhatsappLead} />
        <TaskColumn title="Overdue follow-ups" tone="danger" items={overdue} onAdd={openForm} onWhatsApp={setWhatsappLead} />
        <TaskColumn title="Upcoming follow-ups" tone="info" items={upcoming} onAdd={openForm} onWhatsApp={setWhatsappLead} />
      </div>

      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Follow-up history</h2>
            <p className="mt-1 text-sm text-muted">Update follow-up outcomes and next follow-up dates inline.</p>
          </div>
          <Badge tone="neutral">{filteredHistory.length} records</Badge>
        </div>
        {filteredHistory.length ? (
          <div className="mt-5 overflow-hidden rounded-[20px] border border-border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-surface-strong text-xs font-bold uppercase tracking-[0.08em] text-[#cad6dc]">
                  <tr>
                    <th className="px-4 py-3">Lead</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Outcome</th>
                    <th className="px-4 py-3">Next Date</th>
                    <th className="px-4 py-3">Remarks</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {filteredHistory
                    .sort((a, b) => b.followupDate.localeCompare(a.followupDate))
                    .map((followup) => {
                      const lead = leadById.get(followup.leadId);
                      return (
                        <tr key={followup.id} className="align-top">
                          <td className="px-4 py-4 font-semibold">{lead ? getDisplayName(lead) : "Deleted lead"}</td>
                          <td className="px-4 py-4">{formatDate(followup.followupDate)}</td>
                          <td className="px-4 py-4"><Badge tone="info">{followup.followupType}</Badge></td>
                          <td className="px-4 py-4">
                            <select
                              className={inputClasses}
                              value={followup.outcome}
                              onChange={(event) => updateFollowup(followup.id, { outcome: event.target.value as FollowupDraft["outcome"] })}
                            >
                              {followupOutcomeOptions.map((option) => (
                                <option key={option} value={option}>{option}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-4">
                            <div className={`${inputClasses} flex items-center bg-surface-soft text-muted`}>
                              {formatDate(followup.nextFollowupDate, "No next follow-up")}
                            </div>
                          </td>
                          <td className="max-w-[260px] px-4 py-4 text-muted">{followup.remarks || "No remarks"}</td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              {lead ? (
                                <>
                                  <Button variant="secondary" size="sm" onClick={() => setWhatsappLead(lead)}>
                                    <MessageCircle className="h-4 w-4" />
                                    WhatsApp
                                  </Button>
                                  <Link href={`/leads/${lead.id}`} className="inline-flex items-center gap-2 font-bold text-accent-dark">
                                    Open <ExternalLink className="h-3.5 w-3.5" />
                                  </Link>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <EmptyState title="No follow-ups found" description="Try clearing a filter or add a new follow-up record." />
          </div>
        )}
      </Panel>

      {showForm ? (
        <Modal title="Add follow-up" description="Log a call, WhatsApp, Instagram DM, or meeting and set the next date." onClose={() => setShowForm(false)}>
          <FollowupForm
            leads={leads.filter((lead) => !lead.isArchived)}
            followups={followups}
            fixedLeadId={selectedLeadId || undefined}
            onSubmit={submitFollowup}
            onCancel={() => setShowForm(false)}
          />
        </Modal>
      ) : null}

      {whatsappLead ? (
        <Modal title="Send WhatsApp" description="Preview and edit the message before opening WhatsApp." onClose={() => setWhatsappLead(null)}>
          <WhatsAppModal
            recipient={whatsappLead}
            onClose={() => setWhatsappLead(null)}
            onOpened={(template) => logLeadActivity(whatsappLead.id, "WhatsApp opened", template)}
          />
        </Modal>
      ) : null}
    </div>
  );
}

function TaskColumn({
  title,
  tone,
  items,
  onAdd,
  onWhatsApp,
}: {
  title: string;
  tone: "success" | "danger" | "info";
  items: ReturnType<typeof getFollowupTasks>;
  onAdd: (leadId: string) => void;
  onWhatsApp: (lead: Lead) => void;
}) {
  return (
    <Panel className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        <Badge tone={tone}>{items.length}</Badge>
      </div>
      {items.length ? (
        <div className="space-y-3">
          {items.map(({ lead, latestFollowup }) => (
            <div
              key={lead.id}
              className={tone === "danger" ? "rounded-2xl border border-[#f7c7c7] bg-[#fff0f0] p-4" : "rounded-2xl border border-border bg-surface-soft p-4"}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/leads/${lead.id}`} className="font-semibold hover:underline">
                    {getDisplayName(lead)}
                  </Link>
                  <p className="mt-1 text-sm text-muted">
                    {formatDate(lead.nextFollowupDate)} - {lead.assignedTo || DEFAULT_ASSIGNEE}
                  </p>
                </div>
                <Badge>{lead.leadTemperature}</Badge>
              </div>
              <p className="mt-3 text-sm text-muted">{latestFollowup?.outcome || lead.leadStage}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => onWhatsApp(lead)}>
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onAdd(lead.id)}>
                  <CalendarPlus className="h-4 w-4" />
                  Log Follow-up
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Nothing here" description="No follow-up records match this section." />
      )}
    </Panel>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function FilterSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <select className={inputClasses} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option} value={option}>
          {option === "all" ? "All" : option}
        </option>
      ))}
    </select>
  );
}
