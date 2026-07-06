"use client";

import Link from "next/link";
import { ArrowRight, CalendarClock, Flame, IndianRupee, Target, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BarList, DonutChart, Sparkline } from "@/components/charts";
import { useCRM } from "@/components/crm-provider";
import { Badge, EmptyState, PageHeader, Panel, buttonClasses } from "@/components/ui";
import { DEFAULT_ASSIGNEE, wingCards } from "@/lib/constants";
import {
  activeLeads,
  followupDueChart,
  getFollowupTasks,
  getKpis,
  industryChart,
  leadStageChart,
  leadTemperatureChart,
  objectionChart,
} from "@/lib/analytics";
import { formatCurrency, formatDate, formatDateTime, getDisplayName, isOverdue, isToday } from "@/lib/utils";

export function DashboardClient() {
  const { leads, followups, activityLogs, loading } = useCRM();
  const kpis = getKpis(leads);
  const followupTasks = getFollowupTasks(leads, followups);
  const todaysFollowups = followupTasks.filter(({ lead }) => isToday(lead.nextFollowupDate));
  const overdueFollowups = followupTasks.filter(({ lead }) => isOverdue(lead.nextFollowupDate));
  const hotLeadsNeedingAction = activeLeads(leads)
    .filter((lead) => lead.leadTemperature === "Hot")
    .filter((lead) => !["Won", "Lost", "Rejected"].includes(lead.leadStage))
    .filter((lead) => !lead.nextFollowupDate || isToday(lead.nextFollowupDate) || isOverdue(lead.nextFollowupDate))
    .slice(0, 5);

  const leadNameById = new Map(leads.map((lead) => [lead.id, getDisplayName(lead)]));
  const recentActivity = [...activityLogs]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 7);

  if (loading) {
    return <EmptyState title="Loading Growth Engine" description="Preparing dashboard metrics and CG Studio lead data." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="CG Studio is active. Track leads, follow-ups, reports, and CSV imports from one command center."
        action={
          <Link href="/leads" className={buttonClasses("primary")}>
            Open Leads
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Total Leads" value={kpis.totalLeads} icon={Target} />
        <KpiCard label="Hot Leads" value={kpis.hotLeads} tone="hot" icon={Flame} />
        <KpiCard label="Follow-ups Due Today" value={kpis.followupsDueToday} icon={CalendarClock} />
        <KpiCard label="Overdue Follow-ups" value={kpis.overdueFollowups} tone="danger" icon={TrendingUp} />
        <KpiCard label="Expected Revenue" value={formatCurrency(kpis.expectedRevenue)} icon={IndianRupee} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MiniStat label="Warm Leads" value={kpis.warmLeads} />
        <MiniStat label="Cold Leads" value={kpis.coldLeads} />
        <MiniStat label="No Response Leads" value={kpis.noResponseLeads} />
        <MiniStat label="Rejected Leads" value={kpis.rejectedLeads} />
        <MiniStat label="Won / Lost Leads" value={`${kpis.wonLeads} / ${kpis.lostLeads}`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel dark className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Today&apos;s follow-ups</h2>
              <p className="mt-1 text-sm text-[#aebcc4]">Calls and next actions due now.</p>
            </div>
            <Badge tone="success">{todaysFollowups.length} due today</Badge>
          </div>
          {todaysFollowups.length ? (
            <div className="space-y-2">
              {todaysFollowups.slice(0, 5).map(({ lead, latestFollowup }) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="grid gap-3 rounded-2xl bg-white/8 p-4 transition hover:bg-white/12 sm:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-semibold text-white">{getDisplayName(lead)}</p>
                    <p className="mt-1 text-sm text-[#cad6dc]">
                      {latestFollowup?.outcome || lead.leadStage} - {lead.assignedTo || DEFAULT_ASSIGNEE}
                    </p>
                  </div>
                  <Badge>{lead.leadTemperature}</Badge>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No follow-ups today" description="The daily call queue is clear for CG Studio." />
          )}
        </Panel>

        <Panel className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold">Overdue follow-ups</h2>
            <p className="mt-1 text-sm text-muted">Highlighted clearly so leads do not slip.</p>
          </div>
          {overdueFollowups.length ? (
            <div className="space-y-3">
              {overdueFollowups.slice(0, 5).map(({ lead }) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#f7c7c7] bg-[#fff0f0] p-4"
                >
                  <span>
                    <span className="block font-semibold">{getDisplayName(lead)}</span>
                    <span className="text-sm text-muted">{formatDate(lead.nextFollowupDate)}</span>
                  </span>
                  <Badge tone="danger">Overdue</Badge>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="Nothing overdue" description="Every pending follow-up has breathing room." />
          )}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold">Hot leads needing action</h2>
            <p className="mt-1 text-sm text-muted">Hot leads with overdue, today, or missing follow-up dates.</p>
          </div>
          {hotLeadsNeedingAction.length ? (
            hotLeadsNeedingAction.map((lead) => (
              <Link
                href={`/leads/${lead.id}`}
                key={lead.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-soft p-4"
              >
                <span>
                  <span className="block font-semibold">{getDisplayName(lead)}</span>
                  <span className="text-sm text-muted">
                    Next: {formatDate(lead.nextFollowupDate, "No date set")}
                  </span>
                </span>
                <Badge tone={lead.nextFollowupDate ? "hot" : "danger"}>
                  {lead.nextFollowupDate ? "Action" : "No Date"}
                </Badge>
              </Link>
            ))
          ) : (
            <EmptyState title="No hot leads stuck" description="Hot leads all have a clear next action." />
          )}
        </Panel>

        <Panel className="space-y-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold">Lead Temperature Chart</h2>
              <div className="mt-5">
                <DonutChart data={leadTemperatureChart(leads)} />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold">Lead Stage Chart</h2>
              <div className="mt-5">
                <BarList data={leadStageChart(leads)} compact />
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel>
          <h2 className="text-xl font-semibold">Follow-up Due Chart</h2>
          <div className="mt-5">
            <BarList data={followupDueChart(leads)} />
          </div>
        </Panel>
        <Panel>
          <h2 className="text-xl font-semibold">Industry-wise Leads</h2>
          <div className="mt-5">
            <BarList data={industryChart(leads)} />
          </div>
        </Panel>
        <Panel>
          <h2 className="text-xl font-semibold">Objection Reason Chart</h2>
          <div className="mt-5">
            <BarList data={objectionChart(leads)} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <Panel>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recent activity timeline</h2>
            <Sparkline values={[3, 7, 4, 9, 5, 8, 6]} />
          </div>
          <div className="mt-5 space-y-3">
            {recentActivity.map((log) => (
              <div key={log.id} className="rounded-2xl border border-border bg-surface-soft p-4">
                <p className="font-semibold">{log.action}</p>
                <p className="mt-1 text-sm text-muted">
                  {leadNameById.get(log.leadId) || "Deleted lead"} - {formatDateTime(log.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <h2 className="text-xl font-semibold">Wing status</h2>
          <div className="mt-5 grid gap-3">
            {wingCards.map((wing) => (
              <Link
                key={wing.title}
                href={wing.href}
                className="rounded-2xl border border-border bg-surface-soft p-4 transition hover:bg-white"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold">{wing.title}</p>
                  <Badge tone={wing.status === "Active" ? "success" : "soon"}>{wing.status}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">{wing.description}</p>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "neutral" | "hot" | "danger";
}) {
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-surface-soft text-accent-dark">
          <Icon className="h-5 w-5" />
        </span>
        {tone !== "neutral" ? <Badge tone={tone}>{tone === "hot" ? "Hot" : "Risk"}</Badge> : null}
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl font-bold tracking-tight">{value}</p>
    </Panel>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[18px] border border-border bg-white/70 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl font-bold">{value}</p>
    </div>
  );
}
