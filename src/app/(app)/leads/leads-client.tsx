"use client";

import Link from "next/link";
import { Archive, Download, Edit3, Eye, FileUp, MessageCircle, Plus, Search, Trash2 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { CsvImporter } from "@/components/csv-importer";
import { useCRM } from "@/components/crm-provider";
import { LeadForm } from "@/components/lead-form";
import { Badge, Button, EmptyState, FieldLabel, Modal, PageHeader, Panel, buttonClasses, inputClasses } from "@/components/ui";
import { WhatsAppModal } from "@/components/whatsapp-modal";
import {
  followupOutcomeOptions,
  followupTypeOptions,
  leadStageOptions,
  leadTemperatureOptions,
  serviceInterestOptions,
} from "@/lib/constants";
import {
  buildLeadContactTimeline,
  formatFollowupDelay,
  getWorkingDayDelta,
  type LeadContactTimelineItem,
} from "@/lib/followup-schedule";
import { exportRowsToCsv } from "@/lib/export-utils";
import type {
  Followup,
  FollowupDraft,
  FollowupOutcome,
  FollowupType,
  Lead,
  LeadDraft,
  LeadStage,
  LeadTemperature,
} from "@/lib/types";
import { activeLeads } from "@/lib/analytics";
import { cn, formatCurrency, formatDate, formatDateTime, getDisplayName, isOverdue, isToday, todayIso } from "@/lib/utils";

type SortMode = "created-desc" | "created-asc" | "followup-asc" | "temperature";
type FollowupFilter = "all" | "today" | "overdue" | "no-date" | "upcoming";
type ScheduledFollowupMark = {
  lead: Lead;
  item: Extract<LeadContactTimelineItem, { kind: "followup" }>;
};

const temperatureWeight = { Hot: 0, Warm: 1, Cold: 2 };

export function LeadsClient() {
  const {
    leads,
    followups,
    loading,
    saving,
    addLead,
    updateLead,
    archiveLead,
    deleteLead,
    addFollowup,
    updateFollowup,
    logLeadActivity,
  } = useCRM();
  const [query, setQuery] = useState("");
  const [temperature, setTemperature] = useState("all");
  const [stage, setStage] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [service, setService] = useState("all");
  const [followupFilter, setFollowupFilter] = useState<FollowupFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("followup-asc");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [addingLead, setAddingLead] = useState(false);
  const [whatsappLead, setWhatsappLead] = useState<Lead | null>(null);
  const [markingFollowup, setMarkingFollowup] = useState<ScheduledFollowupMark | null>(null);

  const industries = useMemo(
    () =>
      Array.from(new Set(leads.map((lead) => lead.industry).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [leads],
  );
  const followupsByLeadId = useMemo(() => {
    const nextMap = new Map<string, Followup[]>();
    followups.forEach((followup) => {
      const leadFollowups = nextMap.get(followup.leadId) || [];
      leadFollowups.push(followup);
      nextMap.set(followup.leadId, leadFollowups);
    });
    return nextMap;
  }, [followups]);

  const filteredLeads = useMemo(() => {
    const text = query.trim().toLowerCase();
    return [...(includeArchived ? leads : activeLeads(leads))]
      .filter((lead) => {
        const haystack = [
          lead.leadName,
          lead.leadCode,
          lead.businessName,
          lead.phone,
          lead.leadUrl,
          lead.contactPerson,
        ]
          .join(" ")
          .toLowerCase();
        return !text || haystack.includes(text);
      })
      .filter((lead) => temperature === "all" || lead.leadTemperature === temperature)
      .filter((lead) => stage === "all" || lead.leadStage === stage)
      .filter((lead) => industry === "all" || lead.industry === industry)
      .filter((lead) => service === "all" || lead.serviceInterest === service)
      .filter((lead) => {
        if (followupFilter === "all") return true;
        if (followupFilter === "today") return isToday(lead.nextFollowupDate);
        if (followupFilter === "overdue") return isOverdue(lead.nextFollowupDate);
        if (followupFilter === "no-date") return !lead.nextFollowupDate;
        return Boolean(lead.nextFollowupDate && !isToday(lead.nextFollowupDate) && !isOverdue(lead.nextFollowupDate));
      })
      .sort((a, b) => {
        if (sortMode === "created-asc") return a.createdAt.localeCompare(b.createdAt);
        if (sortMode === "followup-asc") {
          return (a.nextFollowupDate || "9999-12-31").localeCompare(b.nextFollowupDate || "9999-12-31");
        }
        if (sortMode === "temperature") {
          return temperatureWeight[a.leadTemperature] - temperatureWeight[b.leadTemperature];
        }
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [
    followupFilter,
    includeArchived,
    industry,
    leads,
    query,
    service,
    sortMode,
    stage,
    temperature,
  ]);

  async function saveLead(draft: LeadDraft) {
    if (editingLead) {
      await updateLead(editingLead.id, draft);
      setEditingLead(null);
    } else {
      await addLead(draft);
      setAddingLead(false);
    }
  }

  async function saveScheduledFollowup(draft: FollowupDraft) {
    const existingFollowupId = markingFollowup?.item.completedFollowup?.id;
    if (existingFollowupId) {
      await updateFollowup(existingFollowupId, draft);
    } else {
      await addFollowup(draft);
    }
    setMarkingFollowup(null);
  }

  function exportLeads() {
    exportRowsToCsv(
      `growth-engine-leads-${todayIso()}.csv`,
      filteredLeads.map((lead) => ({
        "Lead ID": lead.leadCode,
        "Lead Name": lead.leadName,
        "Business Name": lead.businessName,
        "Contact Person": lead.contactPerson,
        Phone: lead.phone,
        Email: lead.email,
        URL: lead.leadUrl,
        Industry: lead.industry,
        Source: lead.source,
        Temperature: lead.leadTemperature,
        Stage: lead.leadStage,
        Service: lead.serviceInterest,
        "Expected Value": lead.expectedValue,
        "Objection Reason": lead.objectionReason,
        "First Contact Date": lead.firstContactDate,
        "Next Follow-up Date": lead.nextFollowupDate,
        "Free Sample Sent": lead.samplePosterSent ? "Yes" : "No",
        "Free Sample Sent At": lead.samplePosterSentAt,
        Assigned: lead.assignedTo,
        Remarks: lead.remarks,
        Archived: lead.isArchived ? "Yes" : "No",
        "Created At": lead.createdAt,
        "Updated At": lead.updatedAt,
      })),
    );
  }

  function removeLead(lead: Lead) {
    if (window.confirm(`Delete ${getDisplayName(lead)} permanently?`)) {
      void deleteLead(lead.id);
    }
  }

  if (loading) {
    return <EmptyState title="Loading leads" description="Opening the CG Studio Lead Tracker." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Replace the Excel Sales Lead Tracker with searchable leads, follow-up dates, status badges, import preview, and clean lead actions."
        action={
          <>
            <Button variant="secondary" onClick={() => setShowImport((current) => !current)}>
              <FileUp className="h-4 w-4" />
              CSV Import
            </Button>
            <Button variant="secondary" onClick={exportLeads}>
              <Download className="h-4 w-4" />
              Export Leads
            </Button>
            <Button onClick={() => setAddingLead(true)}>
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
          </>
        }
      />

      {showImport ? <CsvImporter /> : null}

      <Panel className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-[minmax(220px,1.25fr)_repeat(6,minmax(112px,1fr))]">
          <FilterField label="Search">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                className={`${inputClasses} pl-10`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Lead, phone, URL"
              />
            </div>
          </FilterField>
          <FilterField label="Temperature">
            <FilterSelect value={temperature} onChange={setTemperature} options={["all", ...leadTemperatureOptions]} />
          </FilterField>
          <FilterField label="Stage">
            <FilterSelect value={stage} onChange={setStage} options={["all", ...leadStageOptions]} />
          </FilterField>
          <FilterField label="Industry">
            <FilterSelect value={industry} onChange={setIndustry} options={["all", ...industries]} />
          </FilterField>
          <FilterField label="Service">
            <FilterSelect value={service} onChange={setService} options={["all", ...serviceInterestOptions]} />
          </FilterField>
          <FilterField label="Follow-up">
            <FilterSelect
              value={followupFilter}
              onChange={(value) => setFollowupFilter(value as FollowupFilter)}
              options={["all", "today", "overdue", "no-date", "upcoming"]}
            />
          </FilterField>
          <FilterField label="Sort">
            <FilterSelect
              value={sortMode}
              onChange={(value) => setSortMode(value as SortMode)}
              options={["created-desc", "created-asc", "followup-asc", "temperature"]}
            />
          </FilterField>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{filteredLeads.length} visible</Badge>
            <Badge tone="success">{activeLeads(leads).length} active</Badge>
            <Badge tone="soon">{leads.length - activeLeads(leads).length} archived</Badge>
            {saving ? <Badge tone="info">Saving...</Badge> : null}
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-muted">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
            />
            Show archived
          </label>
        </div>

        {filteredLeads.length ? (
          <div className="space-y-3">
            <div className="grid gap-3 lg:hidden">
              {filteredLeads.map((lead) => (
                <MobileLeadCard
                  key={lead.id}
                  lead={lead}
                  followups={followupsByLeadId.get(lead.id) || []}
                  saving={saving}
                  onMark={(item) => setMarkingFollowup({ lead, item })}
                  onWhatsapp={() => setWhatsappLead(lead)}
                  onEdit={() => setEditingLead(lead)}
                  onArchive={() => void archiveLead(lead.id)}
                  onDelete={() => removeLead(lead)}
                  onUpdate={(changes) => updateLead(lead.id, changes)}
                />
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-[20px] border border-border lg:block">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="bg-surface-strong text-xs font-bold uppercase tracking-[0.08em] text-[#cad6dc]">
                  <tr>
                    <th className="w-[28%] px-4 py-3">Lead</th>
                    <th className="w-[11%] px-3 py-3">Phone</th>
                    <th className="w-[9%] px-3 py-3">Temp</th>
                    <th className="w-[13%] px-3 py-3">Stage</th>
                    <th className="w-[30%] px-3 py-3">Contact Plan</th>
                    <th className="w-[9%] px-2 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className={cn("align-top", lead.isArchived && "opacity-60")}>
                      <td className="px-4 py-4">
                        <Link href={`/leads/${lead.id}`} className="font-semibold hover:underline">
                          {getDisplayName(lead)}
                        </Link>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
                          {lead.leadCode}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted" title={lead.leadUrl || lead.industry || "No URL"}>
                          {lead.leadUrl || lead.industry || "No URL"}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground">
                          <span>{lead.serviceInterest} - {formatCurrency(lead.expectedValue)}</span>
                          <label className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-soft px-2 py-1 text-[10px] font-bold text-muted">
                            <input
                              type="checkbox"
                              checked={lead.samplePosterSent}
                              onChange={(event) =>
                                void updateLead(lead.id, {
                                  samplePosterSent: event.target.checked,
                                  samplePosterSentAt: event.target.checked
                                    ? lead.samplePosterSentAt || new Date().toISOString()
                                    : "",
                                })
                              }
                            />
                            Sample
                          </label>
                        </div>
                        <div className="mt-2">
                          <InlineTextField
                            value={lead.remarks}
                            placeholder="Add remark"
                            title="Update remarks"
                            onSave={(value) => {
                              const remarks = value.trim();
                              if (!remarks) {
                                window.alert("Remarks are mandatory before saving.");
                                return;
                              }
                              return updateLead(lead.id, { remarks });
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-4">
                        <InlineTextField
                          value={lead.phone}
                          placeholder="Unavailable"
                          title="Update phone"
                          onSave={(value) => updateLead(lead.id, { phone: value })}
                        />
                      </td>
                      <td className="px-3 py-4">
                        <InlineSelect<LeadTemperature>
                          value={lead.leadTemperature}
                          options={leadTemperatureOptions}
                          onChange={(value) => updateLead(lead.id, { leadTemperature: value })}
                        />
                      </td>
                      <td className="px-3 py-4">
                        <InlineSelect<LeadStage>
                          value={lead.leadStage}
                          options={leadStageOptions}
                          onChange={(value) => updateLead(lead.id, { leadStage: value })}
                        />
                      </td>
                      <td className="px-3 py-4">
                        <LeadContactChecklist
                          lead={lead}
                          followups={followupsByLeadId.get(lead.id) || []}
                          onMark={(item) => setMarkingFollowup({ lead, item })}
                        />
                      </td>
                      <td className="px-2 py-4">
                        <div className="grid grid-cols-2 justify-items-center gap-1.5">
                          <Button
                            variant="secondary"
                            size="icon"
                            title="Send WhatsApp"
                            className="h-8 w-8"
                            onClick={() => setWhatsappLead(lead)}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Link
                            href={`/leads/${lead.id}`}
                            className={cn(buttonClasses("ghost", "icon"), "h-8 w-8")}
                            title="Open lead"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          {!lead.isArchived ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Archive lead"
                              className="h-8 w-8"
                              onClick={() => void archiveLead(lead.id)}
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <span aria-hidden="true" className="h-8 w-8" />
                          )}
                          <Button
                            variant="danger"
                            size="icon"
                            title="Delete lead"
                            className="h-8 w-8"
                            onClick={() => removeLead(lead)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <span aria-hidden="true" className="h-8 w-8" />
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Full edit"
                            className="h-8 w-8"
                            onClick={() => setEditingLead(lead)}
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No leads match these filters"
            description="Clear a filter or import the old tracker CSV to start filling the CRM."
            action={<Button onClick={() => setAddingLead(true)}>Add Lead</Button>}
          />
        )}
      </Panel>

      {addingLead || editingLead ? (
        <Modal
          title={editingLead ? "Edit lead" : "Add new lead"}
          description="Capture the fields from the old tracker plus CRM-ready lead details."
          onClose={() => {
            setAddingLead(false);
            setEditingLead(null);
          }}
          wide
        >
          <LeadForm
            lead={editingLead || undefined}
            onSubmit={saveLead}
            onCancel={() => {
              setAddingLead(false);
              setEditingLead(null);
            }}
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

      {markingFollowup ? (
        <Modal
          title={`${markingFollowup.item.completedFollowup ? "Update" : "Mark"} ${markingFollowup.item.label}`}
          description={`${getDisplayName(markingFollowup.lead)} - scheduled ${formatDate(markingFollowup.item.date)}`}
          onClose={() => setMarkingFollowup(null)}
        >
          <ScheduledFollowupModal
            mark={markingFollowup}
            saving={saving}
            onSubmit={saveScheduledFollowup}
            onCancel={() => setMarkingFollowup(null)}
          />
        </Modal>
      ) : null}
    </div>
  );
}

function MobileLeadCard({
  lead,
  followups,
  saving,
  onMark,
  onWhatsapp,
  onEdit,
  onArchive,
  onDelete,
  onUpdate,
}: {
  lead: Lead;
  followups: Followup[];
  saving: boolean;
  onMark: (item: Extract<LeadContactTimelineItem, { kind: "followup" }>) => void;
  onWhatsapp: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onUpdate: (changes: Partial<LeadDraft>) => Promise<void> | void;
}) {
  return (
    <article className={cn("rounded-[20px] border border-border bg-white p-4", lead.isArchived && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/leads/${lead.id}`} className="block truncate text-base font-bold hover:underline">
            {getDisplayName(lead)}
          </Link>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted">
            {lead.leadCode}
          </p>
          <p className="mt-1 truncate text-xs text-muted" title={lead.leadUrl || lead.industry || "No URL"}>
            {lead.leadUrl || lead.industry || "No URL"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge>{lead.leadTemperature}</Badge>
          <Badge>{lead.leadStage}</Badge>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-2xl border border-border bg-surface-soft p-3">
          <p className="font-bold uppercase tracking-[0.08em] text-muted">Phone</p>
          <InlineTextField
            value={lead.phone}
            placeholder="Unavailable"
            title="Update phone"
            onSave={(value) => onUpdate({ phone: value })}
          />
        </div>
        <div className="rounded-2xl border border-border bg-surface-soft p-3">
          <p className="font-bold uppercase tracking-[0.08em] text-muted">Value</p>
          <p className="mt-2 font-mono text-sm font-bold">{formatCurrency(lead.expectedValue)}</p>
          <p className="mt-1 truncate font-semibold text-muted">{lead.serviceInterest}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <InlineSelect<LeadTemperature>
          value={lead.leadTemperature}
          options={leadTemperatureOptions}
          onChange={(value) => onUpdate({ leadTemperature: value })}
        />
        <InlineSelect<LeadStage>
          value={lead.leadStage}
          options={leadStageOptions}
          onChange={(value) => onUpdate({ leadStage: value })}
        />
      </div>

      <div className="mt-3">
        <LeadContactChecklist lead={lead} followups={followups} onMark={onMark} />
      </div>

      <div className="mt-3">
        <InlineTextField
          value={lead.remarks}
          placeholder="Add remark"
          title="Update remarks"
          onSave={(value) => {
            const remarks = value.trim();
            if (!remarks) {
              window.alert("Remarks are mandatory before saving.");
              return;
            }
            return onUpdate({ remarks });
          }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="inline-flex min-h-9 items-center gap-2 rounded-full border border-border bg-surface-soft px-3 text-xs font-bold text-muted">
          <input
            type="checkbox"
            checked={lead.samplePosterSent}
            disabled={saving}
            onChange={(event) =>
              void onUpdate({
                samplePosterSent: event.target.checked,
                samplePosterSentAt: event.target.checked
                  ? lead.samplePosterSentAt || new Date().toISOString()
                  : "",
              })
            }
          />
          Sample
        </label>
        <Button variant="secondary" size="icon" title="Send WhatsApp" onClick={onWhatsapp}>
          <MessageCircle className="h-4 w-4" />
        </Button>
        <Link href={`/leads/${lead.id}`} className={buttonClasses("ghost", "icon")} title="Open lead">
          <Eye className="h-4 w-4" />
        </Link>
        {!lead.isArchived ? (
          <Button variant="ghost" size="icon" title="Archive lead" onClick={onArchive}>
            <Archive className="h-4 w-4" />
          </Button>
        ) : null}
        <Button variant="ghost" size="icon" title="Full edit" onClick={onEdit}>
          <Edit3 className="h-4 w-4" />
        </Button>
        <Button variant="danger" size="icon" title="Delete lead" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </article>
  );
}

function LeadContactChecklist({
  lead,
  followups,
  onMark,
}: {
  lead: Lead;
  followups: Followup[];
  onMark: (item: Extract<LeadContactTimelineItem, { kind: "followup" }>) => void;
}) {
  const timeline = buildLeadContactTimeline(lead.firstContactDate, followups);
  const contactItem = timeline.find((item) => item.kind === "contact");
  const followupItems = timeline.filter(
    (item): item is Extract<LeadContactTimelineItem, { kind: "followup" }> =>
      item.kind === "followup",
  );

  return (
    <div className="min-w-0 space-y-1.5">
      <div
        className={cn(
          "flex min-w-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px]",
          contactItem?.date
            ? "border-[#b8ead6] bg-[#f4fcf8] text-[#0c7c52]"
            : "border-[#d8e0e4] bg-surface-soft text-muted",
        )}
        title={formatDate(contactItem?.date || "", "No contact date")}
      >
        <input
          className="h-3.5 w-3.5 shrink-0"
          type="checkbox"
          checked={Boolean(contactItem?.date)}
          disabled
          readOnly
        />
        <span className="shrink-0 font-bold">Contacted</span>
        <span className="min-w-0 truncate font-semibold">
          {formatCompactDate(contactItem?.date || "", "No date")}
        </span>
      </div>

      <div className="grid min-w-0 grid-cols-5 gap-1">
        {followupItems.map((item) => {
          const completed = item.completedFollowup;
          const checked = Boolean(completed);
          const disabled = !item.date || lead.isArchived || isClosedLead(lead);
          const title = [
            `${item.label} scheduled: ${formatDate(item.date, "No date")}`,
            checked
              ? [
                  `Actual: ${formatDate(item.actualDate || "", "No actual date")}`,
                  `Marked: ${formatDateTime(item.markedAt || completed?.createdAt || "")}`,
                  formatFollowupDelay(item.delayWorkingDays),
                  completed?.remarks || completed?.outcome || "Done",
                ].join(" - ")
              : getTimelineStatusText(item.date),
          ]
            .filter(Boolean)
            .join(" - ");

          return (
            <label
              key={item.label}
              className={cn(
                "grid min-w-0 cursor-pointer justify-items-start gap-0.5 rounded-lg border px-1.5 py-1 text-[10px] leading-none transition",
                checked &&
                  (item.delayWorkingDays && item.delayWorkingDays > 0
                    ? "border-[#f1c36d] bg-[#fff8eb] text-[#9a5d00]"
                    : "border-[#b8ead6] bg-[#f4fcf8] text-[#0c7c52]"),
                !checked && item.date && getTimelineChipClass(item.date),
                !item.date && "border-[#d8e0e4] bg-surface-soft text-muted opacity-75",
                disabled && "cursor-not-allowed",
              )}
              title={title}
            >
              <input
                className="h-3.5 w-3.5 accent-[#a8e600]"
                aria-label={`Mark ${item.label} for ${getDisplayName(lead)}`}
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => onMark(item)}
              />
              <span className="font-bold">{item.label}</span>
              <span className="max-w-full truncate text-[9px] font-semibold opacity-80">
                {formatCompactDate(checked ? item.actualDate || item.date : item.date, "No date")}
              </span>
              {checked ? (
                <span className="max-w-full truncate text-[8px] font-semibold opacity-75">
                  Prev {formatCompactDate(item.actualDate || "", "")}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ScheduledFollowupModal({
  mark,
  saving,
  onSubmit,
  onCancel,
}: {
  mark: ScheduledFollowupMark;
  saving: boolean;
  onSubmit: (draft: FollowupDraft) => Promise<void> | void;
  onCancel: () => void;
}) {
  const existingFollowup = mark.item.completedFollowup;
  const previousActualDate = existingFollowup?.followupDate || "";
  const [outcome, setOutcome] = useState<FollowupOutcome>(
    existingFollowup?.outcome || "Call Back Later",
  );
  const [actualFollowupDate, setActualFollowupDate] = useState(
    existingFollowup?.followupDate || todayIso(),
  );
  const [followupType, setFollowupType] = useState<FollowupType>(
    existingFollowup?.followupType || "Call",
  );
  const [markedAt] = useState(() => new Date().toISOString());
  const [remarks, setRemarks] = useState(existingFollowup?.remarks || "");
  const [error, setError] = useState("");
  const delayText = formatFollowupDelay(getWorkingDayDelta(mark.item.date, actualFollowupDate));

  async function submit() {
    const trimmedRemarks = remarks.trim();
    if (!trimmedRemarks) {
      setError("Add a short comment before marking this follow-up.");
      return;
    }
    if (!actualFollowupDate) {
      setError("Choose the actual follow-up date.");
      return;
    }

    await onSubmit({
      leadId: mark.lead.id,
      scheduledFollowupDate: mark.item.date,
      followupDate: actualFollowupDate,
      followupType,
      outcome,
      nextFollowupDate: "",
      remarks: trimmedRemarks,
      createdBy: "captain",
      markedAt,
    });
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <FieldLabel label="Scheduled Date">
          <div className={`${inputClasses} flex items-center bg-surface-soft text-muted`}>
            {formatDate(mark.item.date)}
          </div>
        </FieldLabel>
        <FieldLabel label="Actual Follow-up Date">
          <div>
            <input
              type="date"
              className={inputClasses}
              value={actualFollowupDate}
              onInput={(event) => setActualFollowupDate(event.currentTarget.value)}
              onChange={(event) => setActualFollowupDate(event.target.value)}
            />
            {previousActualDate ? (
              <p className="mt-1 text-[11px] font-semibold text-muted">
                Previously mentioned actual follow-up: {formatDate(previousActualDate)}
              </p>
            ) : null}
          </div>
        </FieldLabel>
        <FieldLabel label="Marked Date">
          <div className={`${inputClasses} flex items-center bg-surface-soft text-muted`}>
            {formatDateTime(markedAt)}
          </div>
        </FieldLabel>
        <FieldLabel label="Delay Tracking">
          <div className={`${inputClasses} flex items-center bg-surface-soft text-muted`}>
            {delayText}
          </div>
        </FieldLabel>
        <FieldLabel label="Follow-up Type">
          <select
            className={inputClasses}
            value={followupType}
            onChange={(event) => setFollowupType(event.target.value as FollowupType)}
          >
            {followupTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Outcome">
          <select
            className={inputClasses}
            value={outcome}
            onChange={(event) => setOutcome(event.target.value as FollowupOutcome)}
          >
            {followupOutcomeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </FieldLabel>
      </div>
      <FieldLabel label="Comments" error={error}>
        <textarea
          className={`${inputClasses} min-h-28 py-3`}
          value={remarks}
          onChange={(event) => {
            setRemarks(event.target.value);
            setError("");
          }}
          placeholder="Example: Called, no answer. Sent WhatsApp details."
          autoFocus
        />
      </FieldLabel>
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : existingFollowup ? "Update Follow-up" : "Mark Follow-up"}
        </Button>
      </div>
    </form>
  );
}

function InlineTextField({
  value,
  placeholder,
  title,
  onSave,
}: {
  value: string;
  placeholder: string;
  title: string;
  onSave: (value: string) => Promise<void> | void;
}) {
  const [localDraft, setLocalDraft] = useState(() => ({ source: value, value }));
  const draft = localDraft.source === value ? localDraft.value : value;

  async function commit() {
    if (draft === value) return;
    await onSave(draft);
    setLocalDraft({ source: draft, value: draft });
  }

  return (
    <input
      className={`${inputClasses} min-h-9 rounded-xl px-2 text-xs`}
      value={draft}
      placeholder={placeholder}
      title={title}
      onChange={(event) => setLocalDraft({ source: value, value: event.target.value })}
      onBlur={() => void commit()}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setLocalDraft({ source: value, value });
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function InlineSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: T[];
  onChange: (value: T) => Promise<void> | void;
}) {
  return (
    <select
      className={`${inputClasses} min-h-9 rounded-xl text-xs`}
      value={value}
      onChange={(event) => void onChange(event.target.value as T)}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
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
          {formatOption(option)}
        </option>
      ))}
    </select>
  );
}

function formatOption(option: string) {
  if (option === "all") return "All";
  if (option === "created-desc") return "Newest first";
  if (option === "created-asc") return "Oldest first";
  if (option === "followup-asc") return "Next follow-up";
  if (option === "temperature") return "Temperature";
  if (option === "no-date") return "No next date";
  return option;
}

function getTimelineChipClass(date: string) {
  if (isToday(date)) return "border-[#b8ead6] bg-[#f4fcf8] text-[#0c7c52] hover:bg-[#eafaf3]";
  if (isOverdue(date)) return "border-[#f7c7c7] bg-[#fff7f7] text-[#bd2727] hover:bg-[#fff0f0]";
  return "border-[#cddcff] bg-[#f7faff] text-[#2f5edb] hover:bg-[#eef4ff]";
}

function getTimelineStatusText(date: string) {
  if (!date) return "No date";
  if (isToday(date)) return "Today";
  if (isOverdue(date)) return "Overdue";
  return "Due";
}

function formatCompactDate(value: string, fallback = "No date") {
  if (!value) return fallback;
  const formatted = formatDate(value, fallback);
  return formatted.replace(/\s+\d{4}$/, "");
}

function isClosedLead(lead: Lead) {
  return ["Won", "Lost", "Rejected"].includes(lead.leadStage);
}
