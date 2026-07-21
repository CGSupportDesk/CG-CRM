"use client";

import Link from "next/link";
import { ArrowRight, Flame, IndianRupee, ListChecks, Search, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { useCRM } from "@/components/crm-provider";
import { Badge, EmptyState, PageHeader, Panel, buttonClasses, inputClasses } from "@/components/ui";
import { getLeadScores, leadScoreDistribution } from "@/lib/analytics";
import { leadStageOptions, leadTemperatureOptions } from "@/lib/constants";
import type { Lead, LeadStage } from "@/lib/types";
import { cn, formatCurrency, formatDate, getDisplayName, isOverdue, isToday } from "@/lib/utils";

export function PipelineClient() {
  const { leads, followups, loading, updateLead } = useCRM();
  const [query, setQuery] = useState("");
  const [temperatureFilter, setTemperatureFilter] = useState("all");
  const scores = useMemo(() => getLeadScores(leads, followups), [followups, leads]);
  const scoreByLeadId = useMemo(
    () => new Map(scores.map((score) => [score.lead.id, score])),
    [scores],
  );
  const distribution = leadScoreDistribution(scores);
  const filteredPipelineLeads = useMemo(() => {
    const text = query.trim().toLowerCase();

    return leads
      .filter((lead) => !lead.isArchived)
      .filter((lead) => temperatureFilter === "all" || lead.leadTemperature === temperatureFilter)
      .filter((lead) => {
        if (!text) return true;
        return [
          getDisplayName(lead),
          lead.leadCode,
          lead.phone,
          lead.leadUrl,
          lead.remarks,
        ]
          .join(" ")
          .toLowerCase()
          .includes(text);
      });
  }, [leads, query, temperatureFilter]);
  const columns = leadStageOptions.map((stage) => {
    const stageLeads = filteredPipelineLeads
      .filter((lead) => lead.leadStage === stage)
      .sort((a, b) => (scoreByLeadId.get(b.id)?.score || 0) - (scoreByLeadId.get(a.id)?.score || 0));

    return {
      stage,
      leads: stageLeads,
      expectedValue: stageLeads.reduce((sum, lead) => sum + lead.expectedValue, 0),
    };
  });
  const priorityLeads = scores.filter((score) => score.band === "Priority" && score.lead.leadStage !== "Won");

  if (loading) {
    return <EmptyState title="Loading pipeline" description="Building the CG Studio lead pipeline." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Pipeline"
        description="Move CG Studio leads by stage, watch priority scores, and keep every opportunity visible from first contact to conversion."
        action={
          <Link href="/daily-sales" className={buttonClasses("primary")}>
            Daily Sales
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PipelineMetric icon={Target} label="Pipeline Leads" value={scores.length} />
        <PipelineMetric icon={Flame} label="Priority Leads" value={priorityLeads.length} tone="hot" />
        <PipelineMetric icon={ListChecks} label="Healthy Leads" value={distribution.Healthy || 0} />
        <PipelineMetric
          icon={IndianRupee}
          label="Open Value"
          value={formatCurrency(
            leads
              .filter((lead) => !lead.isArchived && !["Lost", "Rejected"].includes(lead.leadStage))
              .reduce((sum, lead) => sum + lead.expectedValue, 0),
          )}
        />
      </div>

      <Panel className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Kanban by stage</h2>
            <p className="mt-1 text-sm text-muted">
              Search, filter, and use the next-stage action inside a card to move leads faster.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{leadStageOptions.length} stages</Badge>
            <Badge tone="info">{filteredPipelineLeads.length} visible</Badge>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_220px_auto] md:items-end">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
              Search Pipeline
            </span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                className={`${inputClasses} pl-10`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Lead, phone, code, URL"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
              Temperature
            </span>
            <select
              className={inputClasses}
              value={temperatureFilter}
              onChange={(event) => setTemperatureFilter(event.target.value)}
            >
              <option value="all">All temperatures</option>
              {leadTemperatureOptions.map((temperature) => (
                <option key={temperature} value={temperature}>
                  {temperature}
                </option>
              ))}
            </select>
          </label>
          <Link href="/leads" className={buttonClasses("secondary")}>
            Lead Table
          </Link>
        </div>

        <div className="-mx-2 overflow-x-auto px-2 pb-2">
          <div className="grid min-w-[1180px] grid-cols-9 gap-3">
            {columns.map((column) => (
              <section key={column.stage} className="min-w-0 rounded-[18px] border border-border bg-surface-soft">
                <div className="sticky top-0 rounded-t-[18px] border-b border-border bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold">{column.stage}</h3>
                      <p className="mt-1 font-mono text-xs font-bold text-muted">
                        {formatCurrency(column.expectedValue)}
                      </p>
                    </div>
                    <Badge tone="neutral">{column.leads.length}</Badge>
                  </div>
                </div>
                <div className="space-y-3 p-3">
                  {column.leads.length ? (
                    column.leads.map((lead) => (
                      <PipelineCard
                        key={lead.id}
                        lead={lead}
                        score={scoreByLeadId.get(lead.id)?.score || 0}
                        reasons={scoreByLeadId.get(lead.id)?.reasons || []}
                        onStageChange={(stage) => void updateLead(lead.id, { leadStage: stage })}
                        onMoveNext={(stage) => void updateLead(lead.id, { leadStage: stage })}
                      />
                    ))
                  ) : (
                    <p className="rounded-2xl border border-dashed border-border bg-white p-4 text-xs font-semibold text-muted">
                      No leads here.
                    </p>
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function PipelineCard({
  lead,
  score,
  reasons,
  onStageChange,
  onMoveNext,
}: {
  lead: Lead;
  score: number;
  reasons: string[];
  onStageChange: (stage: LeadStage) => void;
  onMoveNext: (stage: LeadStage) => void;
}) {
  const nextStage = getNextLeadStage(lead.leadStage);
  const followupTone = isOverdue(lead.nextFollowupDate)
    ? "danger"
    : isToday(lead.nextFollowupDate)
      ? "success"
      : "info";

  return (
    <article className="rounded-2xl border border-border bg-white p-3 shadow-[0_10px_26px_rgba(22,44,55,0.06)]">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/leads/${lead.id}`} className="min-w-0 font-semibold hover:underline">
          <span className="line-clamp-2">{getDisplayName(lead)}</span>
        </Link>
        <Badge tone={score >= 75 ? "hot" : score >= 50 ? "success" : "muted"}>{score}</Badge>
      </div>
      <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
        {lead.leadCode}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge>{lead.leadTemperature}</Badge>
        <Badge tone={followupTone}>{formatDate(lead.nextFollowupDate, "No next date")}</Badge>
      </div>
      <select
        className={`${inputClasses} mt-3 min-h-9 rounded-xl text-xs`}
        value={lead.leadStage}
        onChange={(event) => onStageChange(event.target.value as LeadStage)}
      >
        {leadStageOptions.map((stage) => (
          <option key={stage} value={stage}>
            {stage}
          </option>
        ))}
      </select>
      {nextStage ? (
        <button
          type="button"
          className="mt-2 inline-flex min-h-8 w-full items-center justify-center gap-2 rounded-full border border-border bg-surface-soft px-3 text-xs font-semibold text-accent-dark transition hover:border-[#c2d1d8] hover:bg-white"
          onClick={() => onMoveNext(nextStage)}
        >
          Move to {nextStage}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <div className="mt-3 space-y-1">
        {reasons.slice(0, 3).map((reason) => (
          <p key={reason} className="truncate text-xs text-muted">
            {reason}
          </p>
        ))}
      </div>
    </article>
  );
}

function getNextLeadStage(stage: LeadStage): LeadStage | "" {
  const terminalStages: LeadStage[] = ["Won", "Lost", "Rejected"];
  if (terminalStages.includes(stage)) return "";

  const index = leadStageOptions.indexOf(stage);
  const nextStage = leadStageOptions[index + 1];
  if (!nextStage || nextStage === "Lost" || nextStage === "Rejected" || nextStage === "No Response") {
    return "";
  }
  return nextStage;
}

function PipelineMetric({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: typeof Target;
  label: string;
  value: string | number;
  tone?: "neutral" | "hot";
}) {
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-3">
        <Icon className={cn("h-5 w-5", tone === "hot" ? "text-[#c13a2e]" : "text-accent-dark")} />
        <Badge tone={tone === "hot" ? "hot" : "neutral"}>Live</Badge>
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl font-bold tracking-tight">{value}</p>
    </Panel>
  );
}
