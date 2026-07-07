"use client";

import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, Mail, MessageCircle, Phone } from "lucide-react";
import { useState } from "react";
import { useCRM } from "@/components/crm-provider";
import { Badge, Button, EmptyState, Modal, PageHeader, Panel } from "@/components/ui";
import { WhatsAppModal } from "@/components/whatsapp-modal";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export function ClientDetailClient({ id }: { id: string }) {
  const { clients, projects, activityLogs, loading, logLeadActivity } = useCRM();
  const [showWhatsappForm, setShowWhatsappForm] = useState(false);
  const client = clients.find((item) => item.id === id);
  const clientLeadId = client?.leadId || "";
  const clientProjects = projects.filter((project) => project.clientId === id);
  const clientActivity = clientLeadId
    ? activityLogs
        .filter((log) => log.leadId === clientLeadId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  if (loading) {
    return <EmptyState title="Loading client" description="Opening the active CG Studio client profile." />;
  }

  if (!client) {
    return (
      <EmptyState
        title="Client not found"
        description="This client may have been deleted."
        action={<Link href="/clients" className="font-bold text-accent-dark">Back to Clients</Link>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/clients" className="inline-flex items-center gap-2 text-sm font-bold text-muted">
        <ArrowLeft className="h-4 w-4" />
        Back to Clients
      </Link>

      <PageHeader
        title={client.clientName}
        description={client.notes || "Client profile, package, renewal, linked projects, and activity."}
        action={
          <Button onClick={() => setShowWhatsappForm(true)}>
            <MessageCircle className="h-4 w-4" />
            Send WhatsApp
          </Button>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel dark className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{client.status}</Badge>
            <Badge>{client.paymentStatus}</Badge>
            <Badge tone="info">{client.packageName}</Badge>
          </div>
          <div>
            <p className="text-sm text-[#aebcc4]">Contact</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">
              {client.contactPerson || client.clientName}
            </h2>
            <div className="mt-4 grid gap-3 text-sm text-[#cad6dc]">
              <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-accent" /> {client.phone || "Phone unavailable"}</p>
              <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-accent" /> {client.email || "Email unavailable"}</p>
              <p>{client.location || "Location not set"} - {client.industry || "Industry not set"}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <DarkMetric label="Monthly Value" value={formatCurrency(client.monthlyValue)} />
            <DarkMetric label="Owner" value={client.owner || "Naveen"} />
            <DarkMetric label="Projects" value={String(clientProjects.length)} />
            <DarkMetric label="Payment" value={client.paymentStatus} />
            <DarkMetric label="Start Date" value={formatDate(client.startDate)} />
            <DarkMetric label="Renewal Date" value={formatDate(client.renewalDate)} />
          </div>
          <div className="rounded-2xl bg-white/8 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#aebcc4]">Notes</p>
            <p className="mt-2 text-sm leading-6 text-[#cad6dc]">{client.notes || "No client notes added yet."}</p>
          </div>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Projects</h2>
            <Badge tone="neutral">{clientProjects.length} active</Badge>
          </div>
          <div className="mt-5 space-y-3">
            {clientProjects.length ? (
              clientProjects.map((project) => (
                <div key={project.id} className="rounded-2xl border border-border bg-surface-soft p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{project.projectName}</p>
                    <Badge>{project.status}</Badge>
                  </div>
                  <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                    <BriefcaseBusiness className="h-4 w-4" />
                    {project.projectType} - {project.monthlyPosterTarget} posters
                  </p>
                  <p className="mt-1 text-sm text-muted">Due: {formatDate(project.dueDate)}</p>
                </div>
              ))
            ) : (
              <EmptyState title="No projects yet" description="Create a project from the Projects module." />
            )}
          </div>
        </Panel>
      </div>

      <Panel>
        <h2 className="text-xl font-semibold">Activity timeline</h2>
        <div className="mt-5 space-y-3">
          {clientActivity.length ? (
            clientActivity.map((log) => (
              <div key={log.id} className="rounded-2xl border border-border bg-surface-soft p-4">
                <p className="font-semibold">{log.action}</p>
                <p className="mt-1 text-sm text-muted">{formatDateTime(log.createdAt)}</p>
                {log.newValue ? <p className="mt-2 text-xs text-muted">{log.newValue}</p> : null}
              </div>
            ))
          ) : (
            <EmptyState
              title="No client activity yet"
              description={client.leadId ? "Client activity from the linked lead will appear here." : "Manual clients do not have a linked lead timeline yet."}
            />
          )}
        </div>
      </Panel>

      {showWhatsappForm ? (
        <Modal title="Send WhatsApp" description="Preview and edit the message before opening WhatsApp." onClose={() => setShowWhatsappForm(false)}>
          <WhatsAppModal
            recipient={client}
            onClose={() => setShowWhatsappForm(false)}
            onOpened={(template) => {
              if (client.leadId) return logLeadActivity(client.leadId, "WhatsApp opened", template);
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/8 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[#aebcc4]">{label}</p>
      <p className="mt-2 font-semibold text-white">{value}</p>
    </div>
  );
}
