"use client";

import Link from "next/link";
import { CalendarClock, CircleDollarSign, Edit3, Eye, MessageCircle, Plus, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useCRM } from "@/components/crm-provider";
import { Badge, Button, EmptyState, FieldLabel, Modal, PageHeader, Panel, buttonClasses, inputClasses } from "@/components/ui";
import { WhatsAppModal } from "@/components/whatsapp-modal";
import { assigneeOptions, clientStatusOptions, paymentStatusOptions, serviceInterestOptions } from "@/lib/constants";
import type { ClientStatus, PaymentStatus, StudioClient, StudioClientDraft } from "@/lib/types";
import { formatCurrency, formatDate, getDisplayName, isOverdue, isToday, todayIso } from "@/lib/utils";

export function ClientsClient() {
  const { clients, leads, projects, loading, saving, addClient, updateClient, deleteClient, logLeadActivity } = useCRM();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ClientStatus | "all">("all");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "all">("all");
  const [editingClient, setEditingClient] = useState<StudioClient | null>(null);
  const [addingClient, setAddingClient] = useState(false);
  const [whatsappClient, setWhatsappClient] = useState<StudioClient | null>(null);

  const projectCountByClient = useMemo(
    () =>
      projects.reduce<Record<string, number>>((acc, project) => {
        acc[project.clientId] = (acc[project.clientId] || 0) + 1;
        return acc;
      }, {}),
    [projects],
  );
  const wonLeadOptions = useMemo(
    () => leads.filter((lead) => lead.leadStage === "Won"),
    [leads],
  );
  const filteredClients = useMemo(() => {
    const text = query.trim().toLowerCase();
    return clients
      .filter((client) => status === "all" || client.status === status)
      .filter((client) => paymentStatus === "all" || client.paymentStatus === paymentStatus)
      .filter((client) => {
        const haystack = [
          client.clientName,
          client.contactPerson,
          client.phone,
          client.industry,
          client.packageName,
        ].join(" ").toLowerCase();
        return !text || haystack.includes(text);
      })
      .sort((a, b) => (a.renewalDate || "9999-12-31").localeCompare(b.renewalDate || "9999-12-31"));
  }, [clients, paymentStatus, query, status]);
  const renewalRiskClients = clients.filter(
    (client) => client.status === "Renewal Due" || isToday(client.renewalDate) || isOverdue(client.renewalDate),
  );
  const overduePaymentClients = clients.filter((client) => client.paymentStatus === "Overdue");

  async function saveClient(draft: StudioClientDraft) {
    if (editingClient) {
      await updateClient(editingClient.id, draft);
      setEditingClient(null);
    } else {
      await addClient(draft);
      setAddingClient(false);
    }
  }

  function removeClient(client: StudioClient) {
    if (window.confirm(`Delete client ${client.clientName}? Projects and poster slots for this client will also be deleted.`)) {
      void deleteClient(client.id);
    }
  }

  if (loading) {
    return <EmptyState title="Loading clients" description="Preparing active CG Studio clients." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Manage active CG Studio clients converted from won leads, packages, renewals, and account ownership."
        action={
          <Button onClick={() => setAddingClient(true)}>
            <Plus className="h-4 w-4" />
            Add Client
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <ClientMetric label="Total Clients" value={clients.length} />
        <ClientMetric label="Active" value={clients.filter((client) => client.status === "Active").length} />
        <ClientMetric label="Renewal Due" value={clients.filter((client) => client.status === "Renewal Due").length} />
        <ClientMetric label="Payment Overdue" value={clients.filter((client) => client.paymentStatus === "Overdue").length} />
        <ClientMetric
          label="Monthly Value"
          value={formatCurrency(clients.filter((client) => client.status !== "Closed").reduce((sum, client) => sum + client.monthlyValue, 0))}
        />
      </div>

      <Panel dark className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Client operations board</h2>
            <p className="mt-1 text-sm leading-6 text-[#cad6dc]">
              Watch renewals, payment risk, active packages, and project load from one client view.
            </p>
          </div>
          <Badge tone="success">CG Studio</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ClientOpsCard icon={CalendarClock} label="Renewal attention" value={renewalRiskClients.length} detail="Due, overdue, or marked renewal" tone={renewalRiskClients.length ? "danger" : "success"} />
          <ClientOpsCard icon={CircleDollarSign} label="Payment overdue" value={overduePaymentClients.length} detail="Clients needing collection" tone={overduePaymentClients.length ? "danger" : "success"} />
          <ClientOpsCard icon={Users} label="Active accounts" value={clients.filter((client) => client.status === "Active").length} detail="Currently managed clients" tone="info" />
          <ClientOpsCard icon={MessageCircle} label="WhatsApp ready" value={clients.filter((client) => client.phone).length} detail="Clients with phone numbers" tone="success" />
        </div>
      </Panel>

      <Panel className="space-y-5">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto] md:items-end">
          <FieldLabel label="Search">
            <input
              className={inputClasses}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Client, contact, package"
            />
          </FieldLabel>
          <FieldLabel label="Status">
            <select
              className={inputClasses}
              value={status}
              onChange={(event) => setStatus(event.target.value as ClientStatus | "all")}
            >
              <option value="all">All</option>
              {clientStatusOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Payment">
            <select
              className={inputClasses}
              value={paymentStatus}
              onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus | "all")}
            >
              <option value="all">All</option>
              {paymentStatusOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </FieldLabel>
          {saving ? <Badge tone="info">Saving...</Badge> : null}
        </div>

        {filteredClients.length ? (
          <div className="space-y-3">
            <div className="grid gap-3 lg:hidden">
              {filteredClients.map((client) => (
                <ClientMobileCard
                  key={client.id}
                  client={client}
                  projectCount={projectCountByClient[client.id] || 0}
                  onWhatsapp={() => setWhatsappClient(client)}
                  onEdit={() => setEditingClient(client)}
                  onDelete={() => removeClient(client)}
                />
              ))}
            </div>
            <div className="hidden overflow-hidden rounded-[20px] border border-border lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-left text-sm">
                <thead className="bg-surface-strong text-xs font-bold uppercase tracking-[0.08em] text-[#cad6dc]">
                  <tr>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Package</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Renewal</th>
                    <th className="px-4 py-3">Projects</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {filteredClients.map((client) => (
                    <tr key={client.id}>
                      <td className="px-4 py-4">
                        <Link href={`/clients/${client.id}`} className="font-semibold hover:underline">
                          {client.clientName}
                        </Link>
                        <p className="mt-1 text-xs text-muted">{client.contactPerson || "No contact"} - {client.phone || "No phone"}</p>
                        <p className="mt-1 text-xs text-muted">{client.industry || "Industry not set"}</p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-semibold">{client.packageName}</p>
                        <p className="text-xs text-muted">{formatCurrency(client.monthlyValue)}</p>
                      </td>
                      <td className="px-4 py-4">{client.owner}</td>
                      <td className="px-4 py-4">{formatDate(client.renewalDate)}</td>
                      <td className="px-4 py-4 font-mono font-bold">{projectCountByClient[client.id] || 0}</td>
                      <td className="px-4 py-4"><Badge>{client.paymentStatus}</Badge></td>
                      <td className="px-4 py-4"><Badge>{client.status}</Badge></td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <Button variant="secondary" size="icon" title="Send WhatsApp" onClick={() => setWhatsappClient(client)}>
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <Link href={`/clients/${client.id}`} className={buttonClasses("ghost", "icon")} title="Open client">
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Button variant="ghost" size="icon" title="Edit client" onClick={() => setEditingClient(client)}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button variant="danger" size="icon" title="Delete client" onClick={() => removeClient(client)}>
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
          </div>
        ) : (
          <EmptyState
            title="No clients yet"
            description="Mark a lead as Won to create a client automatically, or add a client manually."
            action={<Button onClick={() => setAddingClient(true)}>Add Client</Button>}
          />
        )}
      </Panel>

      {addingClient || editingClient ? (
        <Modal
          title={editingClient ? "Edit client" : "Add client"}
          description="Won leads become clients automatically; this form is for cleanup and manual additions."
          onClose={() => {
            setAddingClient(false);
            setEditingClient(null);
          }}
          wide
        >
          <ClientForm
            client={editingClient || undefined}
            wonLeadOptions={wonLeadOptions}
            onSubmit={saveClient}
            onCancel={() => {
              setAddingClient(false);
              setEditingClient(null);
            }}
          />
        </Modal>
      ) : null}

      {whatsappClient ? (
        <Modal title="Send WhatsApp" description="Preview and edit the message before opening WhatsApp." onClose={() => setWhatsappClient(null)}>
          <WhatsAppModal
            recipient={whatsappClient}
            onClose={() => setWhatsappClient(null)}
            onOpened={(template) => {
              if (whatsappClient.leadId) {
                return logLeadActivity(whatsappClient.leadId, "WhatsApp opened", template);
              }
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}

function ClientMobileCard({
  client,
  projectCount,
  onWhatsapp,
  onEdit,
  onDelete,
}: {
  client: StudioClient;
  projectCount: number;
  onWhatsapp: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const renewalRisk = client.renewalDate && (isOverdue(client.renewalDate) || isToday(client.renewalDate));

  return (
    <article className="w-full min-w-0 overflow-hidden rounded-[20px] border border-border bg-white p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/clients/${client.id}`} className="block truncate text-base font-bold hover:underline">
            {client.clientName}
          </Link>
          <p className="mt-1 truncate text-xs text-muted">
            {client.contactPerson || "No contact"} - {client.phone || "No phone"}
          </p>
        </div>
        <Badge>{client.status}</Badge>
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        <MiniClientCell label="Package" value={client.packageName} />
        <MiniClientCell label="Monthly" value={formatCurrency(client.monthlyValue)} />
        <MiniClientCell label="Renewal" value={formatDate(client.renewalDate)} danger={Boolean(renewalRisk)} />
        <MiniClientCell label="Projects" value={projectCount} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge>{client.paymentStatus}</Badge>
        <Badge tone="neutral">{client.owner}</Badge>
        <Button variant="secondary" size="icon" title="Send WhatsApp" onClick={onWhatsapp}>
          <MessageCircle className="h-4 w-4" />
        </Button>
        <Link href={`/clients/${client.id}`} className={buttonClasses("ghost", "icon")} title="Open client">
          <Eye className="h-4 w-4" />
        </Link>
        <Button variant="ghost" size="icon" title="Edit client" onClick={onEdit}>
          <Edit3 className="h-4 w-4" />
        </Button>
        <Button variant="danger" size="icon" title="Delete client" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </article>
  );
}

function MiniClientCell({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-2xl border p-3 ${danger ? "border-[#f7c7c7] bg-[#fff0f0]" : "border-border bg-surface-soft"}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}

function ClientOpsCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  detail: string;
  tone: "success" | "danger" | "info";
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-5 w-5 text-accent" />
        <Badge tone={tone}>{value}</Badge>
      </div>
      <p className="mt-4 text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 text-xs leading-5 text-[#cad6dc]">{detail}</p>
    </div>
  );
}

function ClientForm({
  client,
  wonLeadOptions,
  onSubmit,
  onCancel,
}: {
  client?: StudioClient;
  wonLeadOptions: ReturnType<typeof useCRM>["leads"];
  onSubmit: (draft: StudioClientDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const firstLead = wonLeadOptions.find((lead) => lead.id === client?.leadId);
  const [draft, setDraft] = useState<StudioClientDraft>(() => ({
    leadId: client?.leadId || "",
    clientName: client?.clientName || (firstLead ? getDisplayName(firstLead) : ""),
    contactPerson: client?.contactPerson || firstLead?.contactPerson || "",
    phone: client?.phone || firstLead?.phone || "",
    email: client?.email || firstLead?.email || "",
    industry: client?.industry || firstLead?.industry || "",
    location: client?.location || firstLead?.location || "",
    packageName: client?.packageName || firstLead?.serviceInterest || "30 Poster Package",
    monthlyValue: client?.monthlyValue || firstLead?.expectedValue || 5000,
    owner: client?.owner || firstLead?.assignedTo || "Naveen",
    status: client?.status || "Active",
    paymentStatus: client?.paymentStatus || "Not Started",
    startDate: client?.startDate || todayIso(),
    renewalDate: client?.renewalDate || "",
    notes: client?.notes || firstLead?.remarks || "",
  }));

  function update<K extends keyof StudioClientDraft>(key: K, value: StudioClientDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function fillFromLead(leadId: string) {
    const lead = wonLeadOptions.find((item) => item.id === leadId);
    update("leadId", leadId);
    if (!lead) return;
    setDraft((current) => ({
      ...current,
      leadId,
      clientName: getDisplayName(lead),
      contactPerson: lead.contactPerson || lead.leadName,
      phone: lead.phone,
      email: lead.email,
      industry: lead.industry,
      location: lead.location,
      packageName: lead.serviceInterest,
      monthlyValue: lead.expectedValue,
      owner: lead.assignedTo || current.owner,
      paymentStatus: current.paymentStatus,
      notes: lead.remarks,
    }));
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(draft);
      }}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <FieldLabel label="Won Lead">
          <select className={inputClasses} value={draft.leadId} onChange={(event) => fillFromLead(event.target.value)}>
            <option value="">Manual client</option>
            {wonLeadOptions.map((lead) => (
              <option key={lead.id} value={lead.id}>{getDisplayName(lead)}</option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Client Name">
          <input className={inputClasses} value={draft.clientName} onChange={(event) => update("clientName", event.target.value)} required />
        </FieldLabel>
        <FieldLabel label="Contact Person">
          <input className={inputClasses} value={draft.contactPerson} onChange={(event) => update("contactPerson", event.target.value)} />
        </FieldLabel>
        <FieldLabel label="Phone">
          <input className={inputClasses} value={draft.phone} onChange={(event) => update("phone", event.target.value)} />
        </FieldLabel>
        <FieldLabel label="Email">
          <input className={inputClasses} value={draft.email} onChange={(event) => update("email", event.target.value)} />
        </FieldLabel>
        <FieldLabel label="Industry">
          <input className={inputClasses} value={draft.industry} onChange={(event) => update("industry", event.target.value)} />
        </FieldLabel>
        <FieldLabel label="Package">
          <select className={inputClasses} value={draft.packageName} onChange={(event) => update("packageName", event.target.value as StudioClientDraft["packageName"])}>
            {serviceInterestOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </FieldLabel>
        <FieldLabel label="Monthly Value">
          <input className={inputClasses} type="number" value={draft.monthlyValue} onChange={(event) => update("monthlyValue", Number(event.target.value))} />
        </FieldLabel>
        <FieldLabel label="Owner">
          <select className={inputClasses} value={draft.owner} onChange={(event) => update("owner", event.target.value)}>
            {assigneeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </FieldLabel>
        <FieldLabel label="Status">
          <select className={inputClasses} value={draft.status} onChange={(event) => update("status", event.target.value as ClientStatus)}>
            {clientStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </FieldLabel>
        <FieldLabel label="Payment Status">
          <select className={inputClasses} value={draft.paymentStatus} onChange={(event) => update("paymentStatus", event.target.value as PaymentStatus)}>
            {paymentStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </FieldLabel>
        <FieldLabel label="Start Date">
          <input className={inputClasses} type="date" value={draft.startDate} onChange={(event) => update("startDate", event.target.value)} />
        </FieldLabel>
        <FieldLabel label="Renewal Date">
          <input className={inputClasses} type="date" value={draft.renewalDate} onChange={(event) => update("renewalDate", event.target.value)} />
        </FieldLabel>
      </div>
      <FieldLabel label="Notes">
        <textarea className={`${inputClasses} min-h-28 py-3`} value={draft.notes} onChange={(event) => update("notes", event.target.value)} />
      </FieldLabel>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save Client</Button>
      </div>
    </form>
  );
}

function ClientMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <Panel className="p-5">
      <Users className="h-5 w-5 text-accent-dark" />
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl font-bold tracking-tight">{value}</p>
    </Panel>
  );
}
