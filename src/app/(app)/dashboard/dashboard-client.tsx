"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CheckSquare, Flame, FolderKanban, IndianRupee, MessageCircle, Target, TrendingUp, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DailyBriefPanel } from "@/components/ai-panels";
import { BarList, DonutChart, Sparkline } from "@/components/charts";
import { useCRM } from "@/components/crm-provider";
import { Badge, EmptyState, PageHeader, Panel, buttonClasses } from "@/components/ui";
import { DEFAULT_ASSIGNEE, wingCards } from "@/lib/constants";
import {
  activeLeads,
  followupDueChart,
  getFollowupTasks,
  getKpis,
  getOperationsKpis,
  industryChart,
  leadStageChart,
  leadTemperatureChart,
  objectionChart,
} from "@/lib/analytics";
import { formatCurrency, formatDate, formatDateTime, getDisplayName, isOverdue, isToday, todayIso } from "@/lib/utils";

export function DashboardClient() {
  const { leads, followups, activityLogs, clients, projects, posterSlots, loading } = useCRM();
  const kpis = getKpis(leads);
  const operationsKpis = getOperationsKpis(clients, projects, posterSlots);
  const followupTasks = getFollowupTasks(leads, followups);
  const openLeadItems = activeLeads(leads).filter(
    (lead) => !["Won", "Lost", "Rejected"].includes(lead.leadStage),
  );
  const todaysFollowups = followupTasks.filter(({ lead }) => isToday(lead.nextFollowupDate));
  const overdueFollowups = followupTasks.filter(({ lead }) => isOverdue(lead.nextFollowupDate));
  const noDateLeads = openLeadItems.filter((lead) => !lead.nextFollowupDate);
  const missedPosterSlots = posterSlots.filter(
    (slot) => slot.slotDate < todayIso() && slot.status !== "Posted",
  );
  const renewalClients = clients.filter(
    (client) => client.status === "Renewal Due" || isOverdue(client.renewalDate) || isToday(client.renewalDate),
  );
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
        description="CG Studio is active. Start with the action queues, then review sales and operations health."
        action={
          <Link href="/leads" className={buttonClasses("primary")}>
            Open Leads
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <Panel dark className="overflow-hidden p-0">
        <div className="grid gap-0 lg:grid-cols-[1fr_1.4fr]">
          <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r">
            <Badge tone="success">Action Center</Badge>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
              Today&apos;s growth desk
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#cad6dc]">
              A quick read of calls, recoveries, no-date leads, and CG Studio delivery risks.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/daily-sales" className={buttonClasses("primary", "sm")}>
                Daily Sales
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link href="/pipeline" className={buttonClasses("secondary", "sm")}>
                Pipeline
              </Link>
              <Link href="/poster-calendar" className={buttonClasses("secondary", "sm")}>
                Calendar
              </Link>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            <ActionQueueCard
              href="/daily-sales"
              icon={CalendarClock}
              label="Today Calls"
              value={todaysFollowups.length}
              detail="Follow-ups due today"
              tone="success"
            />
            <ActionQueueCard
              href="/daily-sales"
              icon={AlertTriangle}
              label="Overdue"
              value={overdueFollowups.length}
              detail="Past promised dates"
              tone="danger"
            />
            <ActionQueueCard
              href="/daily-sales"
              icon={Flame}
              label="Hot Action"
              value={hotLeadsNeedingAction.length}
              detail="Hot leads needing movement"
              tone="hot"
            />
            <ActionQueueCard
              href="/leads"
              icon={Target}
              label="No Date"
              value={noDateLeads.length}
              detail="Open leads missing next date"
              tone="info"
            />
            <ActionQueueCard
              href="/poster-calendar"
              icon={CheckSquare}
              label="Missed Posters"
              value={missedPosterSlots.length}
              detail="Past slots not posted"
              tone="danger"
            />
            <ActionQueueCard
              href="/clients"
              icon={Users}
              label="Renewals"
              value={renewalClients.length}
              detail="Due or marked renewal"
              tone="warm"
            />
          </div>
        </div>
      </Panel>

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

      <Panel className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">CG Studio operations</h2>
            <p className="mt-1 text-sm text-muted">
              Client, project, poster, approval, renewal, and recurring value pulse.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/clients" className={buttonClasses("secondary", "sm")}>Clients</Link>
            <Link href="/projects" className={buttonClasses("secondary", "sm")}>Projects</Link>
            <Link href="/poster-calendar" className={buttonClasses("secondary", "sm")}>Poster Calendar</Link>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <OperationsMetric label="Active Clients" value={operationsKpis.activeClients} icon={Users} />
          <OperationsMetric label="Active Projects" value={operationsKpis.activeProjects} icon={FolderKanban} />
          <OperationsMetric label="Poster Slots" value={operationsKpis.posterSlotsThisMonth} icon={CalendarClock} />
          <OperationsMetric label="Posted This Month" value={operationsKpis.postersPostedThisMonth} icon={CheckSquare} />
          <OperationsMetric label="Pending Approvals" value={operationsKpis.pendingApprovals} icon={TrendingUp} />
          <OperationsMetric label="Monthly Value" value={formatCurrency(operationsKpis.monthlyRecurringRevenue)} icon={IndianRupee} />
        </div>
      </Panel>

      <DailyBriefPanel />

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
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Badge>{lead.leadTemperature}</Badge>
                    <Badge tone="info">
                      <MessageCircle className="h-3 w-3" />
                      Open
                    </Badge>
                  </div>
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

function ActionQueueCard({
  href,
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: number;
  detail: string;
  tone: "success" | "danger" | "hot" | "info" | "warm";
}) {
  return (
    <Link
      href={href}
      className="rounded-[18px] border border-white/10 bg-white/8 p-4 transition hover:bg-white/12"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-accent">
          <Icon className="h-4 w-4" />
        </span>
        <Badge tone={tone}>{value}</Badge>
      </div>
      <p className="mt-4 text-xs font-bold uppercase tracking-[0.08em] text-[#aebcc4]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{detail}</p>
    </Link>
  );
}

function OperationsMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-[18px] border border-border bg-surface-soft p-4">
      <Icon className="h-4 w-4 text-accent-dark" />
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl font-bold">{value}</p>
    </div>
  );
}
