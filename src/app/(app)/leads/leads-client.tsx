"use client";

import Link from "next/link";
import { Archive, Edit3, Eye, FileUp, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CsvImporter } from "@/components/csv-importer";
import { useCRM } from "@/components/crm-provider";
import { LeadForm } from "@/components/lead-form";
import { Badge, Button, EmptyState, Modal, PageHeader, Panel, buttonClasses, inputClasses } from "@/components/ui";
import { leadStageOptions, leadTemperatureOptions, serviceInterestOptions } from "@/lib/constants";
import type { Lead, LeadDraft } from "@/lib/types";
import { activeLeads } from "@/lib/analytics";
import { cn, formatCurrency, formatDate, getDisplayName, isOverdue, isToday, truncate } from "@/lib/utils";

type SortMode = "created-desc" | "created-asc" | "followup-asc" | "temperature";
type FollowupFilter = "all" | "today" | "overdue" | "no-date" | "upcoming";

const temperatureWeight = { Hot: 0, Warm: 1, Cold: 2 };

export function LeadsClient() {
  const { leads, loading, addLead, updateLead, archiveLead, deleteLead } = useCRM();
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

  function saveLead(draft: LeadDraft) {
    if (editingLead) {
      updateLead(editingLead.id, draft);
      setEditingLead(null);
    } else {
      addLead(draft);
      setAddingLead(false);
    }
  }

  function removeLead(lead: Lead) {
    if (window.confirm(`Delete ${getDisplayName(lead)} permanently?`)) {
      deleteLead(lead.id);
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
              <table className="w-full min-w-[1060px] text-left text-sm">
                <thead className="bg-surface-strong text-xs font-bold uppercase tracking-[0.08em] text-[#cad6dc]">
                  <tr>
                    <th className="min-w-[360px] px-4 py-3">Lead</th>
                    <th className="min-w-[150px] px-4 py-3">Phone</th>
                    <th className="min-w-[130px] px-4 py-3">Temperature</th>
                    <th className="min-w-[190px] px-4 py-3">Stage</th>
                    <th className="min-w-[190px] px-4 py-3">Next Follow-up</th>
                    <th className="min-w-[150px] px-4 py-3">Actions</th>
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
                          {lead.serviceInterest} · {formatCurrency(lead.expectedValue)}
                        </p>
                        {lead.remarks ? (
                          <p className="mt-1 max-w-[280px] text-xs leading-5 text-muted">
                            {truncate(lead.remarks, 86)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">{lead.phone || "Unavailable"}</td>
                      <td className="px-4 py-4"><Badge>{lead.leadTemperature}</Badge></td>
                      <td className="px-4 py-4"><Badge>{lead.leadStage}</Badge></td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          <span>{formatDate(lead.nextFollowupDate, "No date")}</span>
                          {isOverdue(lead.nextFollowupDate) ? <Badge tone="danger">Overdue</Badge> : null}
                          {!lead.nextFollowupDate ? <Badge tone="muted">No follow-up date</Badge> : null}
                          {isToday(lead.nextFollowupDate) ? <Badge tone="success">Today</Badge> : null}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          <Link href={`/leads/${lead.id}`} className={buttonClasses("ghost", "icon")} title="Open lead">
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Button variant="ghost" size="icon" title="Edit lead" onClick={() => setEditingLead(lead)}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          {!lead.isArchived ? (
                            <Button variant="ghost" size="icon" title="Archive lead" onClick={() => archiveLead(lead.id)}>
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
          </div>
        ) : (
          <EmptyState
            title="No leads match these filters"
            description="Clear a filter or import the old tracker CSV to start filling the CRM."
            action={<Button onClick={() => setAddingLead(true)}>Add Lead</Button>}
          />
        )}
      </Panel>

      {(addingLead || editingLead) ? (
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
