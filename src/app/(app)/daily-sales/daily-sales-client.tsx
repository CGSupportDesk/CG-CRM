"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarPlus,
  Download,
  ExternalLink,
  Flame,
  MessageCircle,
  PhoneCall,
  Target,
} from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";
import { BarList } from "@/components/charts";
import { useCRM } from "@/components/crm-provider";
import { FollowupForm } from "@/components/followup-form";
import { WhatsAppModal } from "@/components/whatsapp-modal";
import { Badge, Button, EmptyState, Modal, PageHeader, Panel, buttonClasses } from "@/components/ui";
import {
  getFollowupAuditRows,
  getFollowupTasks,
  getLeadScores,
  openLeads,
  samplePosterWorkflow,
  whatsappTemplatePerformance,
  type FollowupAuditRow,
  type LeadScore,
  type TemplatePerformanceRow,
} from "@/lib/analytics";
import { exportRowsToCsv } from "@/lib/export-utils";
import type { Followup, FollowupDraft, Lead } from "@/lib/types";
import { formatDate, formatDateTime, getDisplayName, isOverdue, isToday, todayIso } from "@/lib/utils";

type SalesQueueItem = {
  lead: Lead;
  latestFollowup: Followup | null;
};

type SalesQueueKey = "today" | "overdue" | "hot" | "no-response";
type SalesQueueTone = "success" | "danger" | "hot" | "muted";

export function DailySalesClient() {
  const { leads, followups, activityLogs, loading, addFollowup, logLeadActivity } = useCRM();
  const [followupLeadId, setFollowupLeadId] = useState<string | null>(null);
  const [whatsappLead, setWhatsappLead] = useState<Lead | null>(null);
  const [focusQueue, setFocusQueue] = useState<SalesQueueKey>("today");
  const latestFollowupByLead = useMemo(() => buildLatestFollowupMap(followups), [followups]);
  const tasks = useMemo(() => getFollowupTasks(leads, followups), [followups, leads]);
  const activeOpenLeads = useMemo(() => openLeads(leads), [leads]);
  const leadScores = useMemo(() => getLeadScores(leads, followups), [followups, leads]);
  const sampleWorkflow = useMemo(() => samplePosterWorkflow(leads, followups), [followups, leads]);
  const followupAuditRows = useMemo(() => getFollowupAuditRows(leads, followups), [followups, leads]);
  const templateRows = useMemo(
    () => whatsappTemplatePerformance(leads, activityLogs),
    [activityLogs, leads],
  );
  const todaysCalls = tasks.filter(({ lead }) => isToday(lead.nextFollowupDate));
  const overdue = tasks.filter(({ lead }) => isOverdue(lead.nextFollowupDate));
  const priorityScores = leadScores
    .filter((score) => score.band === "Priority" && !["Won", "Lost", "Rejected"].includes(score.lead.leadStage))
    .slice(0, 8);
  const auditFocusRows = followupAuditRows
    .filter((row) => ["Pending Late", "Due Today", "Completed Late"].includes(row.status))
    .slice(0, 10);
  const hotLeads = activeOpenLeads
    .filter((lead) => lead.leadTemperature === "Hot")
    .sort(compareSalesPriority)
    .map((lead) => ({ lead, latestFollowup: latestFollowupByLead.get(lead.id) || null }));
  const noResponseLeads = activeOpenLeads
    .filter((lead) => lead.leadStage === "No Response")
    .sort(compareSalesPriority)
    .map((lead) => ({ lead, latestFollowup: latestFollowupByLead.get(lead.id) || null }));
  const commandQueues = [
    {
      key: "today",
      title: "Today's Calls",
      description: "Start here. These leads are due today.",
      tone: "success",
      items: todaysCalls,
    },
    {
      key: "overdue",
      title: "Overdue",
      description: "Recover delayed follow-ups before they turn cold.",
      tone: "danger",
      items: overdue,
    },
    {
      key: "hot",
      title: "Hot Leads",
      description: "Move high-interest leads toward details, proposal, or win.",
      tone: "hot",
      items: hotLeads,
    },
    {
      key: "no-response",
      title: "No Response",
      description: "Use recovery templates and log every attempt.",
      tone: "muted",
      items: noResponseLeads,
    },
  ] satisfies Array<{
    key: SalesQueueKey;
    title: string;
    description: string;
    tone: SalesQueueTone;
    items: SalesQueueItem[];
  }>;
  const activeCommandQueue = commandQueues.find((queue) => queue.key === focusQueue) || commandQueues[0];

  async function submitFollowup(draft: FollowupDraft) {
    await addFollowup(draft);
    setFollowupLeadId(null);
  }

  function exportDailySales() {
    exportRowsToCsv(`growth-engine-daily-sales-workspace-${todayIso()}.csv`, [
      ...priorityScores.map((score) => ({
        Section: "Priority score",
        Lead: getDisplayName(score.lead),
        "Lead ID": score.lead.leadCode,
        Value: score.score,
        Detail: score.reasons.join("; "),
      })),
      ...sampleWorkflow.sampleCandidates.map((lead) => ({
        Section: "Sample candidate",
        Lead: getDisplayName(lead),
        "Lead ID": lead.leadCode,
        Value: lead.leadTemperature,
        Detail: lead.remarks,
      })),
      ...sampleWorkflow.sentNeedsFollowup.map((lead) => ({
        Section: "Sample needs follow-up",
        Lead: getDisplayName(lead),
        "Lead ID": lead.leadCode,
        Value: formatDate(lead.nextFollowupDate, "No next date"),
        Detail: lead.remarks,
      })),
      ...auditFocusRows.map((row) => ({
        Section: "Follow-up audit",
        Lead: getDisplayName(row.lead),
        "Lead ID": row.lead.leadCode,
        Value: row.status,
        Detail: `${row.label}: scheduled ${row.scheduledDate}; actual ${row.actualDate || "pending"}; ${row.delayText}`,
      })),
    ]);
  }

  if (loading) {
    return <EmptyState title="Loading daily sales" description="Preparing today's calls and priority lead queues." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Sales"
        description="The campaign workspace for today's calls, overdue follow-ups, hot leads, and no-response recovery."
        action={
          <>
            <Link href="/pipeline" className={buttonClasses("secondary")}>
              Pipeline
            </Link>
            <Button variant="secondary" onClick={exportDailySales}>
              <Download className="h-4 w-4" />
              Export Workspace
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DailyMetric icon={PhoneCall} label="Today's Calls" value={todaysCalls.length} />
        <DailyMetric icon={AlertTriangle} label="Overdue" value={overdue.length} tone="danger" />
        <DailyMetric icon={Flame} label="Hot Leads" value={hotLeads.length} tone="hot" />
        <DailyMetric icon={MessageCircle} label="No Response" value={noResponseLeads.length} tone="muted" />
      </div>

      <FocusQueuePanel
        queues={commandQueues}
        activeKey={focusQueue}
        activeQueue={activeCommandQueue}
        onSelect={setFocusQueue}
        onLog={setFollowupLeadId}
        onWhatsApp={setWhatsappLead}
      />

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <LeadScoreQueue scores={priorityScores} onLog={setFollowupLeadId} onWhatsApp={setWhatsappLead} />
        <SamplePosterPanel
          candidates={sampleWorkflow.sampleCandidates}
          sentNeedsFollowup={sampleWorkflow.sentNeedsFollowup}
          wins={sampleWorkflow.sampleWins.length}
          onLog={setFollowupLeadId}
          onWhatsApp={setWhatsappLead}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <FollowupAuditPanel rows={auditFocusRows} />
        <TemplatePerformancePanel rows={templateRows.slice(0, 6)} />
      </div>

      <div className="grid gap-5 2xl:grid-cols-2">
        <SalesQueue
          title="Today's Calls"
          description="Leads whose automatic next follow-up date is today."
          tone="success"
          items={todaysCalls}
          onLog={setFollowupLeadId}
          onWhatsApp={setWhatsappLead}
        />
        <SalesQueue
          title="Overdue"
          description="Follow these first; the promised call date has already passed."
          tone="danger"
          items={overdue}
          onLog={setFollowupLeadId}
          onWhatsApp={setWhatsappLead}
        />
        <SalesQueue
          title="Hot Leads"
          description="High-priority leads needing fast movement or next action."
          tone="hot"
          items={hotLeads}
          onLog={setFollowupLeadId}
          onWhatsApp={setWhatsappLead}
        />
        <SalesQueue
          title="No Response"
          description="Recovery queue for missed calls, seen/no-reply, and silent leads."
          tone="muted"
          items={noResponseLeads}
          onLog={setFollowupLeadId}
          onWhatsApp={setWhatsappLead}
        />
      </div>

      {followupLeadId ? (
        <Modal
          title="Log follow-up"
          description="Record the call or WhatsApp result. The next follow-up date is generated automatically."
          onClose={() => setFollowupLeadId(null)}
        >
          <FollowupForm
            leads={leads.filter((lead) => !lead.isArchived)}
            followups={followups}
            fixedLeadId={followupLeadId}
            onSubmit={submitFollowup}
            onCancel={() => setFollowupLeadId(null)}
          />
        </Modal>
      ) : null}

      {whatsappLead ? (
        <Modal
          title="Send WhatsApp"
          description="Preview and edit the message before opening WhatsApp."
          onClose={() => setWhatsappLead(null)}
        >
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

function FocusQueuePanel({
  queues,
  activeKey,
  activeQueue,
  onSelect,
  onLog,
  onWhatsApp,
}: {
  queues: Array<{
    key: SalesQueueKey;
    title: string;
    description: string;
    tone: SalesQueueTone;
    items: SalesQueueItem[];
  }>;
  activeKey: SalesQueueKey;
  activeQueue: {
    key: SalesQueueKey;
    title: string;
    description: string;
    tone: SalesQueueTone;
    items: SalesQueueItem[];
  };
  onSelect: (key: SalesQueueKey) => void;
  onLog: (leadId: string) => void;
  onWhatsApp: (lead: Lead) => void;
}) {
  return (
    <Panel className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Daily command center</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Pick one queue, work it down, and log the result immediately.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {queues.map((queue) => (
            <Button
              key={queue.key}
              variant={activeKey === queue.key ? "dark" : "secondary"}
              size="sm"
              onClick={() => onSelect(queue.key)}
            >
              {queue.title}
              <Badge tone={queue.tone}>{queue.items.length}</Badge>
            </Button>
          ))}
        </div>
      </div>

      <div className="rounded-[18px] border border-border bg-surface-soft p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">{activeQueue.title}</h3>
            <p className="mt-1 text-sm text-muted">{activeQueue.description}</p>
          </div>
          <Badge tone={activeQueue.tone}>{activeQueue.items.length} leads</Badge>
        </div>

        {activeQueue.items.length ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {activeQueue.items.slice(0, 8).map(({ lead, latestFollowup }) => (
              <div key={lead.id} className="rounded-2xl border border-border bg-white p-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/leads/${lead.id}`} className="block truncate font-semibold hover:underline">
                      {getDisplayName(lead)}
                    </Link>
                    <p className="mt-1 truncate text-xs text-muted">
                      {lead.leadCode} - Created {formatDate(lead.createdAt.slice(0, 10))}
                    </p>
                  </div>
                  <Badge>{lead.leadTemperature}</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted sm:grid-cols-2">
                  <p>
                    Next{" "}
                    <span className="font-semibold text-foreground">
                      {formatDate(lead.nextFollowupDate, "No date")}
                    </span>
                  </p>
                  <p>
                    Last{" "}
                    <span className="font-semibold text-foreground">
                      {latestFollowup?.outcome || lead.leadStage}
                    </span>
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => onWhatsApp(lead)}>
                    <MessageCircle className="h-4 w-4" />
                    WhatsApp
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => onLog(lead.id)}>
                    <CalendarPlus className="h-4 w-4" />
                    Log
                  </Button>
                  <Link href={`/leads/${lead.id}`} className={buttonClasses("ghost", "sm")}>
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="Queue clear" description="No lead currently needs this action." />
        )}
      </div>
    </Panel>
  );
}

function LeadScoreQueue({
  scores,
  onLog,
  onWhatsApp,
}: {
  scores: LeadScore[];
  onLog: (leadId: string) => void;
  onWhatsApp: (lead: Lead) => void;
}) {
  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Priority lead score</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Leads ranked by heat, stage, due date, sample status, value, and touch freshness.
          </p>
        </div>
        <Badge tone="hot">{scores.length}</Badge>
      </div>
      {scores.length ? (
        <div className="space-y-3">
          {scores.map((score) => (
            <div key={score.lead.id} className="rounded-2xl border border-border bg-surface-soft p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/leads/${score.lead.id}`} className="font-semibold hover:underline">
                    {getDisplayName(score.lead)}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    Last touch: {formatDate(score.lastTouchDate, "Not touched")} - Age {score.ageDays} days
                  </p>
                </div>
                <Badge tone="hot">Score {score.score}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {score.reasons.map((reason) => (
                  <Badge key={reason} tone="neutral">{reason}</Badge>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => onWhatsApp(score.lead)}>
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onLog(score.lead.id)}>
                  <CalendarPlus className="h-4 w-4" />
                  Log
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No priority leads" description="No open lead is currently scoring as priority." />
      )}
    </Panel>
  );
}

function SamplePosterPanel({
  candidates,
  sentNeedsFollowup,
  wins,
  onLog,
  onWhatsApp,
}: {
  candidates: Lead[];
  sentNeedsFollowup: Lead[];
  wins: number;
  onLog: (leadId: string) => void;
  onWhatsApp: (lead: Lead) => void;
}) {
  const visibleLeads = [...sentNeedsFollowup.slice(0, 4), ...candidates.slice(0, 4)].slice(0, 6);

  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Sample poster workflow</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Track leads that should receive samples and leads whose samples need follow-up.
          </p>
        </div>
        <Badge tone="success">{wins} won</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniQueue label="Candidates" value={candidates.length} />
        <MiniQueue label="Needs follow-up" value={sentNeedsFollowup.length} />
        <MiniQueue label="Sample wins" value={wins} />
      </div>
      {visibleLeads.length ? (
        <div className="space-y-2">
          {visibleLeads.map((lead) => (
            <div key={lead.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface-soft p-3">
              <div className="min-w-0">
                <Link href={`/leads/${lead.id}`} className="block truncate text-sm font-semibold hover:underline">
                  {getDisplayName(lead)}
                </Link>
                <p className="mt-1 text-xs text-muted">
                  {lead.samplePosterSent ? "Sample sent" : "Sample candidate"} - {formatDate(lead.nextFollowupDate, "No next date")}
                </p>
              </div>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="icon" title="WhatsApp" onClick={() => onWhatsApp(lead)}>
                  <MessageCircle className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="icon" title="Log follow-up" onClick={() => onLog(lead.id)}>
                  <CalendarPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Sample workflow clear" description="No sample poster action is currently pending." />
      )}
    </Panel>
  );
}

function FollowupAuditPanel({ rows }: { rows: FollowupAuditRow[] }) {
  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Follow-up audit trail</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Scheduled date, actual date, marked time, and delay status for urgent follow-ups.
          </p>
        </div>
        <Badge tone={rows.some((row) => row.status === "Pending Late") ? "danger" : "success"}>
          {rows.length}
        </Badge>
      </div>
      {rows.length ? (
        <div className="overflow-hidden rounded-[18px] border border-border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-surface-strong text-xs font-bold uppercase tracking-[0.08em] text-[#cad6dc]">
                <tr>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Step</th>
                  <th className="px-4 py-3">Scheduled</th>
                  <th className="px-4 py-3">Actual</th>
                  <th className="px-4 py-3">Marked</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-white">
                {rows.map((row) => (
                  <tr key={`${row.lead.id}-${row.label}-${row.scheduledDate}`}>
                    <td className="px-4 py-3 font-semibold">
                      <Link href={`/leads/${row.lead.id}`} className="hover:underline">
                        {getDisplayName(row.lead)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{row.label}</td>
                    <td className="px-4 py-3">{formatDate(row.scheduledDate)}</td>
                    <td className="px-4 py-3">{formatDate(row.actualDate, "Pending")}</td>
                    <td className="px-4 py-3">{row.markedAt ? formatDateTime(row.markedAt) : "Not marked"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={row.status.includes("Late") ? "danger" : row.status === "Due Today" ? "success" : "neutral"}>
                        {row.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState title="No audit issues" description="No late or due follow-up audit rows need attention." />
      )}
    </Panel>
  );
}

function TemplatePerformancePanel({ rows }: { rows: TemplatePerformanceRow[] }) {
  const chartData = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.template] = row.opens;
    return acc;
  }, {});

  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">WhatsApp template opens</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Tracks which templates were opened from Growth Engine, not delivery or read receipts.
          </p>
        </div>
        <Target className="h-5 w-5 text-accent-dark" />
      </div>
      <BarList data={chartData} compact />
      {rows.length ? (
        <div className="space-y-2">
          {rows.slice(0, 3).map((row) => (
            <div key={row.template} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-soft p-3">
              <span className="min-w-0 truncate text-sm font-semibold">{row.template}</span>
              <Badge tone="neutral">{row.conversionRate}% won</Badge>
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

function SalesQueue({
  title,
  description,
  tone,
  items,
  onLog,
  onWhatsApp,
}: {
  title: string;
  description: string;
  tone: "success" | "danger" | "hot" | "muted";
  items: SalesQueueItem[];
  onLog: (leadId: string) => void;
  onWhatsApp: (lead: Lead) => void;
}) {
  return (
    <Panel className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
        </div>
        <Badge tone={tone}>{items.length}</Badge>
      </div>

      {items.length ? (
        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-1">
          {items.slice(0, 12).map(({ lead, latestFollowup }) => (
            <div key={lead.id} className="min-w-0 rounded-2xl border border-border bg-surface-soft p-4">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <Link href={`/leads/${lead.id}`} className="font-semibold hover:underline">
                    {getDisplayName(lead)}
                  </Link>
                  <p className="mt-1 truncate text-xs text-muted">
                    {lead.phone || "No phone"} - {lead.assignedTo || "Naveen"}
                  </p>
                </div>
                <div className="flex max-w-full flex-wrap gap-1.5 sm:justify-end">
                  <Badge>{lead.leadTemperature}</Badge>
                  <Badge>{lead.leadStage}</Badge>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-sm text-muted sm:grid-cols-2">
                <p>
                  Next:{" "}
                  <span className="font-semibold text-foreground">
                    {formatDate(lead.nextFollowupDate, "No next date")}
                  </span>
                </p>
                <p>
                  Last:{" "}
                  <span className="font-semibold text-foreground">
                    {latestFollowup?.outcome || lead.leadStage}
                  </span>
                </p>
              </div>
              {lead.remarks ? <p className="mt-3 line-clamp-2 text-sm text-muted">{lead.remarks}</p> : null}
              <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
                <Button className="w-full sm:w-auto" variant="secondary" size="sm" onClick={() => onWhatsApp(lead)}>
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
                <Button className="w-full sm:w-auto" variant="secondary" size="sm" onClick={() => onLog(lead.id)}>
                  <CalendarPlus className="h-4 w-4" />
                  Log Follow-up
                </Button>
                <Link
                  href={`/leads/${lead.id}`}
                  className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-full border border-border bg-white px-3 text-xs font-semibold text-accent-dark transition hover:border-[#c2d1d8] hover:bg-surface-soft sm:w-auto"
                >
                  Open <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Queue clear" description="No leads currently match this daily sales queue." />
      )}
    </Panel>
  );
}

function DailyMetric({
  icon: Icon,
  label,
  value,
  tone = "info",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: "info" | "danger" | "hot" | "muted";
}) {
  return (
    <Panel className="p-5">
      <Icon className="h-5 w-5 text-accent-dark" />
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="font-mono text-3xl font-bold tracking-tight">{value}</p>
        <Badge tone={tone}>Live</Badge>
      </div>
    </Panel>
  );
}

function MiniQueue({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-surface-soft p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl font-bold">{value}</p>
    </div>
  );
}

function buildLatestFollowupMap(followups: Followup[]) {
  const latest = new Map<string, Followup>();

  [...followups]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .forEach((followup) => {
      if (!latest.has(followup.leadId)) latest.set(followup.leadId, followup);
    });

  return latest;
}

function compareSalesPriority(a: Lead, b: Lead) {
  const aDate = a.nextFollowupDate || "9999-12-31";
  const bDate = b.nextFollowupDate || "9999-12-31";
  return aDate.localeCompare(bDate) || b.createdAt.localeCompare(a.createdAt);
}
