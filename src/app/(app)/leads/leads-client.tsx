"use client";

import Link from "next/link";
import { Archive, Edit3, Eye, FileUp, MessageCircle, Plus, Search, Trash2 } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { CsvImporter } from "@/components/csv-importer";
import { useCRM } from "@/components/crm-provider";
import { LeadForm } from "@/components/lead-form";
import { Badge, Button, EmptyState, Modal, PageHeader, Panel, buttonClasses, inputClasses } from "@/components/ui";
import { WhatsAppModal } from "@/components/whatsapp-modal";
import { leadStageOptions, leadTemperatureOptions, serviceInterestOptions } from "@/lib/constants";
import type { Lead, LeadDraft, LeadStage, LeadTemperature } from "@/lib/types";
import { activeLeads } from "@/lib/analytics";
import { cn, formatCurrency, formatDate, getDisplayName, isOverdue, isToday } from "@/lib/utils";

type SortMode = "created-desc" | "created-asc" | "followup-asc" | "temperature";
type FollowupFilter = "all" | "today" | "overdue" | "no-date" | "upcoming";

const temperatureWeight = { Hot: 0, Warm: 1, Cold: 2 };

export function LeadsClient() {
  const { leads, loading, saving, addLead, updateLead, archiveLead, deleteLead, logLeadActivity } = useCRM();
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.25fr)_repeat(6,minmax(112px,1fr))]">
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
                    <th className="w-[31%] px-4 py-3">Lead</th>
                    <th className="w-[13%] px-3 py-3">Phone</th>
                    <th className="w-[10%] px-3 py-3">Temp</th>
                    <th className="w-[15%] px-3 py-3">Stage</th>
                    <th className="w-[16%] px-3 py-3">Next</th>
                    <th className="w-[15%] px-3 py-3">Actions</th>
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
                        <div className="flex flex-col gap-1">
                          <div className={`${inputClasses} flex min-h-9 items-center rounded-xl bg-surface-soft px-2 text-xs text-muted`}>
                            {getNextFollowupLabel(lead)}
                          </div>
                          {lead.nextFollowupDate ? <Badge tone="info">Auto</Badge> : null}
                          {!lead.nextFollowupDate ? (
                            <Badge tone={getMissingNextFollowupTone(lead)}>
                              {getMissingNextFollowupReason(lead)}
                            </Badge>
                          ) : null}
                          {isOverdue(lead.nextFollowupDate) ? <Badge tone="danger">Overdue</Badge> : null}
                          {isToday(lead.nextFollowupDate) ? <Badge tone="success">Today</Badge> : null}
                        </div>
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

function getNextFollowupLabel(lead: Lead) {
  if (lead.nextFollowupDate) return formatDate(lead.nextFollowupDate);
  if (isClosedLead(lead)) return lead.leadStage;
  if (!lead.firstContactDate) return "First contact needed";
  return "Review schedule";
}

function getMissingNextFollowupReason(lead: Lead) {
  if (isClosedLead(lead)) return "Closed lead";
  if (!lead.firstContactDate) return "No contact date";
  return "Needs follow-up date";
}

function getMissingNextFollowupTone(lead: Lead): "muted" | "danger" | "soon" {
  if (isClosedLead(lead)) return "muted";
  if (!lead.firstContactDate) return "soon";
  return "danger";
}

function isClosedLead(lead: Lead) {
  return ["Won", "Lost", "Rejected"].includes(lead.leadStage);
}
