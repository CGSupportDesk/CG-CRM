"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarPlus,
  ExternalLink,
  Flame,
  MessageCircle,
  PhoneCall,
} from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";
import { useCRM } from "@/components/crm-provider";
import { FollowupForm } from "@/components/followup-form";
import { WhatsAppModal } from "@/components/whatsapp-modal";
import { Badge, Button, EmptyState, Modal, PageHeader, Panel } from "@/components/ui";
import { getFollowupTasks, openLeads } from "@/lib/analytics";
import type { Followup, FollowupDraft, Lead } from "@/lib/types";
import { formatDate, getDisplayName, isOverdue, isToday } from "@/lib/utils";

type SalesQueueItem = {
  lead: Lead;
  latestFollowup: Followup | null;
};

export function DailySalesClient() {
  const { leads, followups, loading, addFollowup, logLeadActivity } = useCRM();
  const [followupLeadId, setFollowupLeadId] = useState<string | null>(null);
  const [whatsappLead, setWhatsappLead] = useState<Lead | null>(null);
  const latestFollowupByLead = useMemo(() => buildLatestFollowupMap(followups), [followups]);
  const tasks = useMemo(() => getFollowupTasks(leads, followups), [followups, leads]);
  const activeOpenLeads = useMemo(() => openLeads(leads), [leads]);
  const todaysCalls = tasks.filter(({ lead }) => isToday(lead.nextFollowupDate));
  const overdue = tasks.filter(({ lead }) => isOverdue(lead.nextFollowupDate));
  const hotLeads = activeOpenLeads
    .filter((lead) => lead.leadTemperature === "Hot")
    .sort(compareSalesPriority)
    .map((lead) => ({ lead, latestFollowup: latestFollowupByLead.get(lead.id) || null }));
  const noResponseLeads = activeOpenLeads
    .filter((lead) => lead.leadStage === "No Response")
    .sort(compareSalesPriority)
    .map((lead) => ({ lead, latestFollowup: latestFollowupByLead.get(lead.id) || null }));

  async function submitFollowup(draft: FollowupDraft) {
    await addFollowup(draft);
    setFollowupLeadId(null);
  }

  if (loading) {
    return <EmptyState title="Loading daily sales" description="Preparing today's calls and priority lead queues." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Sales"
        description="The campaign workspace for today's calls, overdue follow-ups, hot leads, and no-response recovery."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DailyMetric icon={PhoneCall} label="Today's Calls" value={todaysCalls.length} />
        <DailyMetric icon={AlertTriangle} label="Overdue" value={overdue.length} tone="danger" />
        <DailyMetric icon={Flame} label="Hot Leads" value={hotLeads.length} tone="hot" />
        <DailyMetric icon={MessageCircle} label="No Response" value={noResponseLeads.length} tone="muted" />
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
            <div key={lead.id} className="rounded-2xl border border-border bg-surface-soft p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/leads/${lead.id}`} className="font-semibold hover:underline">
                    {getDisplayName(lead)}
                  </Link>
                  <p className="mt-1 truncate text-xs text-muted">
                    {lead.phone || "No phone"} - {lead.assignedTo || "Naveen"}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
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
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => onWhatsApp(lead)}>
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
                <Button variant="secondary" size="sm" onClick={() => onLog(lead.id)}>
                  <CalendarPlus className="h-4 w-4" />
                  Log Follow-up
                </Button>
                <Link href={`/leads/${lead.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-accent-dark">
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
