"use client";

import Link from "next/link";
import { AlertTriangle, Download, ShieldCheck, Target, Wrench } from "lucide-react";
import { BarList } from "@/components/charts";
import { useCRM } from "@/components/crm-provider";
import { Badge, Button, EmptyState, PageHeader, Panel } from "@/components/ui";
import { activeLeads, getDataQualityReport, type DataQualityGroup } from "@/lib/analytics";
import { exportRowsToCsv } from "@/lib/export-utils";
import type { Lead } from "@/lib/types";
import { formatDate, getDisplayName, todayIso } from "@/lib/utils";

export function DataQualityClient() {
  const { leads, loading } = useCRM();
  const report = getDataQualityReport(leads);
  const active = activeLeads(leads);
  const criticalIssues =
    report.duplicatePhones.length +
    report.duplicateUrls.length +
    report.missingNextFollowupDate.length +
    report.missingRemarks.length;

  function exportDataQuality() {
    exportRowsToCsv(`growth-engine-data-quality-${todayIso()}.csv`, [
      ...Object.entries(report.issueCounts).map(([issue, count]) => ({
        Section: "Summary",
        Issue: issue,
        Count: count,
        Lead: "",
        "Lead ID": "",
        Detail: "",
      })),
      ...report.duplicatePhones.flatMap((group) =>
        group.leads.map((lead) => ({
          Section: "Duplicate Phone",
          Issue: group.key,
          Count: group.leads.length,
          Lead: getDisplayName(lead),
          "Lead ID": lead.leadCode,
          Detail: lead.phone,
        })),
      ),
      ...report.duplicateUrls.flatMap((group) =>
        group.leads.map((lead) => ({
          Section: "Duplicate URL",
          Issue: group.key,
          Count: group.leads.length,
          Lead: getDisplayName(lead),
          "Lead ID": lead.leadCode,
          Detail: lead.leadUrl,
        })),
      ),
      ...report.missingNextFollowupDate.map((lead) => issueExportRow("Missing next follow-up", lead)),
      ...report.missingRemarks.map((lead) => issueExportRow("Missing remarks", lead)),
      ...report.staleOpenLeads.map((lead) => issueExportRow("Open 8+ days", lead)),
    ]);
  }

  if (loading) {
    return <EmptyState title="Loading data quality" description="Scanning Growth Engine lead records." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Quality Center"
        description="Find duplicate leads, missing fields, stale records, and cleanup risks before they affect sales follow-ups."
        action={
          <Button variant="secondary" onClick={exportDataQuality}>
            <Download className="h-4 w-4" />
            Export Quality Report
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <QualityMetric icon={ShieldCheck} label="Quality Score" value={`${report.qualityScore}%`} tone={report.qualityScore >= 80 ? "success" : "warm"} />
        <QualityMetric icon={Target} label="Active Leads" value={active.length} />
        <QualityMetric icon={AlertTriangle} label="Critical Issues" value={criticalIssues} tone={criticalIssues ? "danger" : "success"} />
        <QualityMetric icon={Wrench} label="Issue Types" value={Object.values(report.issueCounts).filter((count) => count > 0).length} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Issue summary</h2>
            <Badge tone="neutral">{Object.values(report.issueCounts).reduce((sum, count) => sum + count, 0)} checks</Badge>
          </div>
          <div className="mt-5">
            <BarList data={report.issueCounts} />
          </div>
        </Panel>

        <Panel className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Cleanup priority</h2>
            <p className="mt-1 text-sm text-muted">
              Start with duplicate phone/URL groups, then open leads without next follow-up or remarks.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <MiniIssue label="Duplicate phone groups" value={report.duplicatePhones.length} />
            <MiniIssue label="Duplicate URL groups" value={report.duplicateUrls.length} />
            <MiniIssue label="No next follow-up" value={report.missingNextFollowupDate.length} />
            <MiniIssue label="No remarks" value={report.missingRemarks.length} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <DuplicatePanel title="Duplicate phones" groups={report.duplicatePhones} />
        <DuplicatePanel title="Duplicate Instagram / URLs" groups={report.duplicateUrls} />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <LeadIssueList title="Missing next follow-up" leads={report.missingNextFollowupDate} />
        <LeadIssueList title="Missing remarks" leads={report.missingRemarks} />
        <LeadIssueList title="Open 8+ days" leads={report.staleOpenLeads} />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <LeadIssueList title="Missing phone" leads={report.missingPhone} />
        <LeadIssueList title="Missing first contact" leads={report.missingFirstContactDate} />
        <LeadIssueList title="Missing source / industry" leads={[...report.missingSource, ...report.missingIndustry]} />
      </div>
    </div>
  );
}

function DuplicatePanel({ title, groups }: { title: string; groups: DataQualityGroup[] }) {
  return (
    <Panel className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        <Badge tone={groups.length ? "danger" : "success"}>{groups.length}</Badge>
      </div>
      {groups.length ? (
        <div className="space-y-3">
          {groups.slice(0, 8).map((group) => (
            <div key={group.key} className="rounded-2xl border border-border bg-surface-soft p-4">
              <p className="truncate text-xs font-bold uppercase tracking-[0.08em] text-muted">{group.key}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.leads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold hover:border-[#c2d1d8]"
                  >
                    {getDisplayName(lead)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No duplicates found" description="This duplicate check is clean." />
      )}
    </Panel>
  );
}

function LeadIssueList({ title, leads }: { title: string; leads: Lead[] }) {
  return (
    <Panel className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge tone={leads.length ? "danger" : "success"}>{leads.length}</Badge>
      </div>
      {leads.length ? (
        <div className="space-y-2">
          {leads.slice(0, 10).map((lead) => (
            <Link
              key={lead.id}
              href={`/leads/${lead.id}`}
              className="block rounded-2xl border border-border bg-surface-soft p-3 transition hover:bg-white"
            >
              <span className="block truncate text-sm font-semibold">{getDisplayName(lead)}</span>
              <span className="mt-1 block text-xs text-muted">
                {lead.leadCode} - Created {formatDate(lead.createdAt.slice(0, 10))}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-border bg-surface-soft p-4 text-sm text-muted">
          No leads in this queue.
        </p>
      )}
    </Panel>
  );
}

function MiniIssue({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-soft p-4">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl font-bold">{value}</p>
    </div>
  );
}

function QualityMetric({
  icon: Icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string | number;
  tone?: "neutral" | "success" | "danger" | "warm";
}) {
  return (
    <Panel className="p-5">
      <Icon className="h-5 w-5 text-accent-dark" />
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="font-mono text-3xl font-bold tracking-tight">{value}</p>
        <Badge tone={tone === "warm" ? "warm" : tone}>Live</Badge>
      </div>
    </Panel>
  );
}

function issueExportRow(issue: string, lead: Lead) {
  return {
    Section: "Issue",
    Issue: issue,
    Count: 1,
    Lead: getDisplayName(lead),
    "Lead ID": lead.leadCode,
    Detail: lead.nextFollowupDate || lead.remarks || lead.phone || "",
  };
}
