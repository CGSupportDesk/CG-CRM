"use client";

import Link from "next/link";
import { Archive, Edit3, Eye, FileUp, MessageCircle, Plus, Search, Trash2 } from "lucide-react";
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
import { buildLeadContactTimeline, sortFollowups, type LeadContactTimelineItem } from "@/lib/followup-schedule";
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
import { cn, formatCurrency, formatDate, getDisplayName, isOverdue, isToday } from "@/lib/utils";

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
    await addFollowup(draft);
    setMarkingFollowup(null);
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
          <div className="overflow-hidden rounded-[20px] border border-border">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="bg-surface-strong text-xs font-bold uppercase tracking-[0.08em] text-[#cad6dc]">
                  <tr>
                    <th className="w-[27%] px-4 py-3">Lead</th>
                    <th className="w-[11%] px-3 py-3">Phone</th>
                    <th className="w-[9%] px-3 py-3">Temp</th>
                    <th className="w-[13%] px-3 py-3">Stage</th>
                    <th className="w-[27%] px-3 py-3">Contact Plan</th>
                    <th className="w-[13%] px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className={cn("align-top", lead.isArchived && "opacity-60")}>
                      <td className="px-4 py-4">
                        <Link href={`/leads/${lead.id}`} className="font-semibold hover:underline">
                          {getDisplayName(lead)}
                        </Link>
                        <p className="mt-1 truncate text-xs text-muted" title={lead.leadUrl || lead.industry || "No URL"}>
                          {lead.leadUrl || lead.industry || "No URL"}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-foreground">
                          {lead.serviceInterest} - {formatCurrency(lead.expectedValue)}
                        </p>
                        <div className="mt-2">
                          <InlineTextField
                            value={lead.remarks}
                            placeholder="Add remark"
                            title="Update remarks"
                            onSave={(value) => updateLead(lead.id, { remarks: value })}
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
                      <td className="px-3 py-4">
                        <div className="grid grid-cols-3 gap-1.5">
                          <Button variant="secondary" size="icon" title="Send WhatsApp" onClick={() => setWhatsappLead(lead)}>
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <Link href={`/leads/${lead.id}`} className={buttonClasses("ghost", "icon")} title="Open lead">
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Button variant="ghost" size="icon" title="Full edit" onClick={() => setEditingLead(lead)}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          {!lead.isArchived ? (
                            <Button variant="ghost" size="icon" title="Archive lead" onClick={() => void archiveLead(lead.id)}>
                              <Archive className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button variant="danger" size="icon" title="Delete lead" onClick={() => removeLead(lead)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
          title={`Mark ${markingFollowup.item.label}`}
          description={`${getDisplayName(markingFollowup.lead)} - ${formatDate(markingFollowup.item.date)}`}
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

function LeadContactChecklist({
  lead,
  followups,
  onMark,
}: {
  lead: Lead;
  followups: Followup[];
  onMark: (item: Extract<LeadContactTimelineItem, { kind: "followup" }>) => void;
}) {
  const completedByDate = new Map(
    sortFollowups(followups)
      .filter((followup) => followup.followupDate)
      .map((followup) => [followup.followupDate, followup]),
  );
  const timeline = buildLeadContactTimeline(lead.firstContactDate);

  return (
    <div className="space-y-1.5">
      {timeline.map((item) => {
        if (item.kind === "contact") {
          return (
            <div
              key="contacted"
              className={cn(
                "flex min-w-0 items-start gap-2 rounded-xl border px-2 py-1.5 text-xs",
                item.date
                  ? "border-[#b8ead6] bg-[#f4fcf8]"
                  : "border-[#d8e0e4] bg-surface-soft",
              )}
            >
              <input className="mt-0.5 h-4 w-4 shrink-0" type="checkbox" checked={Boolean(item.date)} disabled readOnly />
              <div className="min-w-0">
                <p className="font-bold text-foreground">Contacted</p>
                <p className="text-[11px] text-muted">{formatDate(item.date, "No contact date")}</p>
              </div>
            </div>
          );
        }

        const completed = item.date ? completedByDate.get(item.date) : undefined;
        const checked = Boolean(completed);
        const disabled = !item.date || checked || lead.isArchived || isClosedLead(lead);

        return (
          <label
            key={item.label}
            className={cn(
              "flex min-w-0 items-start gap-2 rounded-xl border px-2 py-1.5 text-xs transition",
              checked && "border-[#b8ead6] bg-[#f4fcf8]",
              !checked && item.date && "border-border bg-white hover:border-[#c2d1d8] hover:bg-surface-soft",
              !item.date && "border-[#d8e0e4] bg-surface-soft opacity-75",
              disabled && !checked && "cursor-not-allowed",
            )}
          >
            <input
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#a8e600]"
              type="checkbox"
              checked={checked}
              disabled={disabled}
              onChange={() => onMark(item)}
            />
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center justify-between gap-2">
                <span className="font-bold text-foreground">{item.label}</span>
                {getTimelineBadge(item.date, checked)}
              </span>
              <span className="block text-[11px] text-muted">
                {formatDate(item.date, "No date")}
              </span>
              {checked ? (
                <span className="block truncate text-[11px] font-semibold text-[#0c7c52]" title={completed?.remarks || completed?.outcome}>
                  Marked{completed?.remarks ? `: ${completed.remarks}` : ""}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
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
  const [followupType, setFollowupType] = useState<FollowupType>("Call");
  const [outcome, setOutcome] = useState<FollowupOutcome>("Call Back Later");
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    const trimmedRemarks = remarks.trim();
    if (!trimmedRemarks) {
      setError("Add a short comment before marking this follow-up.");
      return;
    }

    await onSubmit({
      leadId: mark.lead.id,
      followupDate: mark.item.date,
      followupType,
      outcome,
      nextFollowupDate: "",
      remarks: trimmedRemarks,
      createdBy: "captain",
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
          {saving ? "Saving..." : "Mark Follow-up"}
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

function getTimelineBadge(date: string, marked: boolean) {
  if (marked) return <Badge className="shrink-0" tone="success">Marked</Badge>;
  if (!date) return <Badge className="shrink-0" tone="soon">No date</Badge>;
  if (isToday(date)) return <Badge className="shrink-0" tone="success">Today</Badge>;
  if (isOverdue(date)) return <Badge className="shrink-0" tone="danger">Overdue</Badge>;
  return <Badge className="shrink-0" tone="info">Due</Badge>;
}

function isClosedLead(lead: Lead) {
  return ["Won", "Lost", "Rejected"].includes(lead.leadStage);
}
