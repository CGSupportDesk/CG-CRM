"use client";

import Link from "next/link";
import { Archive, CalendarPlus, Edit3, Eye, FileUp, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CsvImporter } from "@/components/csv-importer";
import { useCRM } from "@/components/crm-provider";
import { LeadForm } from "@/components/lead-form";
import { Badge, Button, EmptyState, Modal, PageHeader, Panel, buttonClasses, inputClasses } from "@/components/ui";
import { leadStageOptions, leadTemperatureOptions, serviceInterestOptions } from "@/lib/constants";
import type { FollowupDraft, FollowupOutcome, Lead, LeadDraft, LeadStage, LeadTemperature } from "@/lib/types";
import { activeLeads } from "@/lib/analytics";
import { cn, formatCurrency, getDisplayName, isOverdue, isToday, offsetDate, todayIso } from "@/lib/utils";

type SortMode = "created-desc" | "created-asc" | "followup-asc" | "temperature";
type FollowupFilter = "all" | "today" | "overdue" | "no-date" | "upcoming";

const temperatureWeight = { Hot: 0, Warm: 1, Cold: 2 };

export function LeadsClient() {
  const { leads, loading, saving, addLead, updateLead, archiveLead, deleteLead, addFollowup } = useCRM();
  const [query, setQuery] = useState("");
  const [temperature, setTemperature] = useState("all");
  const [stage, setStage] = useState("all");
  const [industry, setIndustry] = useState("all");
  const [service, setService] = useState("all");
  const [followupFilter, setFollowupFilter] = useState<FollowupFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("created-desc");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [addingLead, setAddingLead] = useState(false);

  const industries = useMemo(
    () =>
      Array.from(new Set(leads.map((lead) => lead.industry).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [leads],
  );

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

  function removeLead(lead: Lead) {
    if (window.confirm(`Delete ${getDisplayName(lead)} permanently?`)) {
      void deleteLead(lead.id);
    }
  }

  function quickLogFollowup(lead: Lead, outcome: FollowupOutcome) {
    const followupType: FollowupDraft["followupType"] =
      outcome === "Details Sent" ? "WhatsApp" : "Call";

    void addFollowup({
      leadId: lead.id,
      followupDate: todayIso(),
      followupType,
      outcome,
      nextFollowupDate: getQuickNextFollowupDate(lead, outcome),
      remarks: `Quick update: ${outcome}`,
      createdBy: "captain",
    });
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
        <div className="grid gap-3 xl:grid-cols-[1.4fr_repeat(6,minmax(130px,1fr))]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              className={`${inputClasses} pl-10`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search lead name, business, phone, or URL"
            />
          </label>
          <FilterSelect value={temperature} onChange={setTemperature} options={["all", ...leadTemperatureOptions]} />
          <FilterSelect value={stage} onChange={setStage} options={["all", ...leadStageOptions]} />
          <FilterSelect value={industry} onChange={setIndustry} options={["all", ...industries]} />
          <FilterSelect value={service} onChange={setService} options={["all", ...serviceInterestOptions]} />
          <FilterSelect
            value={followupFilter}
            onChange={(value) => setFollowupFilter(value as FollowupFilter)}
            options={["all", "today", "overdue", "no-date", "upcoming"]}
          />
          <FilterSelect
            value={sortMode}
            onChange={(value) => setSortMode(value as SortMode)}
            options={["created-desc", "created-asc", "followup-asc", "temperature"]}
          />
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead className="bg-surface-strong text-xs font-bold uppercase tracking-[0.08em] text-[#cad6dc]">
                  <tr>
                    <th className="min-w-[360px] px-4 py-3">Lead</th>
                    <th className="min-w-[150px] px-4 py-3">Phone</th>
                    <th className="min-w-[130px] px-4 py-3">Temperature</th>
                    <th className="min-w-[190px] px-4 py-3">Stage</th>
                    <th className="min-w-[190px] px-4 py-3">Next Follow-up</th>
                    <th className="min-w-[240px] px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className={cn("align-top", lead.isArchived && "opacity-60")}>
                      <td className="px-4 py-4">
                        <Link href={`/leads/${lead.id}`} className="font-semibold hover:underline">
                          {getDisplayName(lead)}
                        </Link>
                        <p className="mt-1 text-xs text-muted">{lead.leadUrl || lead.industry || "No URL"}</p>
                        <p className="mt-1 text-xs font-semibold text-foreground">
                          {lead.serviceInterest} - {formatCurrency(lead.expectedValue)}
                        </p>
                        <div className="mt-2 max-w-[320px]">
                          <InlineTextField
                            value={lead.remarks}
                            placeholder="Add remark"
                            title="Update remarks"
                            onSave={(value) => updateLead(lead.id, { remarks: value })}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <InlineTextField
                          value={lead.phone}
                          placeholder="Unavailable"
                          title="Update phone"
                          onSave={(value) => updateLead(lead.id, { phone: value })}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <InlineSelect<LeadTemperature>
                          value={lead.leadTemperature}
                          options={leadTemperatureOptions}
                          onChange={(value) => updateLead(lead.id, { leadTemperature: value })}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <InlineSelect<LeadStage>
                          value={lead.leadStage}
                          options={leadStageOptions}
                          onChange={(value) => updateLead(lead.id, { leadStage: value })}
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          <input
                            type="date"
                            className={`${inputClasses} min-h-9 rounded-xl text-xs`}
                            value={lead.nextFollowupDate}
                            title="Update next follow-up date"
                            onChange={(event) => updateLead(lead.id, { nextFollowupDate: event.target.value })}
                          />
                          {isOverdue(lead.nextFollowupDate) ? <Badge tone="danger">Overdue</Badge> : null}
                          {!lead.nextFollowupDate ? <Badge tone="muted">No follow-up date</Badge> : null}
                          {isToday(lead.nextFollowupDate) ? <Badge tone="success">Today</Badge> : null}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex min-w-[210px] flex-col gap-2">
                          <div className="flex flex-wrap gap-1.5">
                            <QuickFollowupButton label="No response" outcome="No Response" onClick={() => quickLogFollowup(lead, "No Response")} />
                            <QuickFollowupButton label="Sent" outcome="Details Sent" onClick={() => quickLogFollowup(lead, "Details Sent")} />
                            <QuickFollowupButton label="Interested" outcome="Interested" onClick={() => quickLogFollowup(lead, "Interested")} />
                            <QuickFollowupButton label="Reject" outcome="Rejected" onClick={() => quickLogFollowup(lead, "Rejected")} danger />
                          </div>
                          <div className="flex items-center gap-1">
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
    </div>
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

function QuickFollowupButton({
  label,
  outcome,
  danger = false,
  onClick,
}: {
  label: string;
  outcome: FollowupOutcome;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={danger ? "danger" : "secondary"}
      size="sm"
      className="min-h-8 px-2 text-[11px]"
      title={`Log ${outcome}`}
      onClick={onClick}
    >
      <CalendarPlus className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

function getQuickNextFollowupDate(lead: Lead, outcome: FollowupOutcome) {
  if (outcome === "Rejected" || outcome === "Converted") return "";
  if (outcome === "No Response") return offsetDate(1);
  if (outcome === "Details Sent") return offsetDate(2);
  return lead.nextFollowupDate || offsetDate(1);
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
