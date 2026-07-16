"use client";

import { ArrowRight, CalendarDays, Edit3, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useCRM } from "@/components/crm-provider";
import { Badge, Button, EmptyState, FieldLabel, Modal, PageHeader, Panel, inputClasses } from "@/components/ui";
import { designerOptions, posterSlotStatusOptions } from "@/lib/constants";
import type { PosterSlot, PosterSlotDraft, PosterSlotStatus } from "@/lib/types";
import { formatDate, todayIso } from "@/lib/utils";

export function PosterCalendarClient() {
  const {
    clients,
    projects,
    posterSlots,
    loading,
    saving,
    addPosterSlot,
    updatePosterSlot,
    deletePosterSlot,
    generatePosterSlots,
  } = useCRM();
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  const [clientFilter, setClientFilter] = useState("all");
  const [projectId, setProjectId] = useState("");
  const [editingSlot, setEditingSlot] = useState<PosterSlot | null>(null);
  const [addingSlot, setAddingSlot] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState("");

  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const filteredProjects = projects.filter(
    (project) => clientFilter === "all" || project.clientId === clientFilter,
  );
  const posterProjects = filteredProjects.filter((project) => project.projectType === "Poster Package");
  const projectOptions = [
    ...posterProjects,
    ...filteredProjects.filter((project) => project.projectType !== "Poster Package"),
  ];
  const selectedProjectId = projectOptions.some((project) => project.id === projectId)
    ? projectId
    : projectOptions[0]?.id || "";
  const allMonthSlots = posterSlots
    .filter((slot) => slot.slotDate.startsWith(month))
    .sort((a, b) => a.slotDate.localeCompare(b.slotDate));
  const monthSlots = allMonthSlots.filter(
    (slot) => clientFilter === "all" || slot.clientId === clientFilter,
  );
  const workflowColumns = posterSlotStatusOptions.map((status) => ({
    status,
    slots: monthSlots.filter((slot) => slot.status === status),
  }));
  const designerWorkload = designerOptions
    .map((designer) => ({
      designer,
      count: monthSlots.filter((slot) => slot.designer === designer && slot.status !== "Posted").length,
    }))
    .filter((item) => item.count > 0);

  async function generateSlots() {
    if (!selectedProjectId) return;
    const count = await generatePosterSlots(selectedProjectId, month);
    setGeneratedMessage(count ? `${count} poster slots generated for ${month}.` : "Slots already exist for this project and month.");
  }

  async function saveSlot(draft: PosterSlotDraft) {
    if (editingSlot) {
      await updatePosterSlot(editingSlot.id, draft);
      setEditingSlot(null);
    } else {
      await addPosterSlot(draft);
      setAddingSlot(false);
    }
  }

  function removeSlot(slot: PosterSlot) {
    if (window.confirm(`Delete ${slot.title}?`)) void deletePosterSlot(slot.id);
  }

  if (loading) {
    return <EmptyState title="Loading poster calendar" description="Preparing monthly poster slots." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Poster Calendar"
        description="Generate and manage monthly poster slots, designer assignment, approvals, scheduled posts, and posted content."
        action={
          <Button onClick={() => setAddingSlot(true)} disabled={!projects.length}>
            <Plus className="h-4 w-4" />
            Add Slot
          </Button>
        }
      />

      <Panel className="space-y-5">
        <div className="grid gap-3 lg:grid-cols-[180px_240px_1fr_auto_auto] lg:items-end">
          <FieldLabel label="Month">
            <input className={inputClasses} type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </FieldLabel>
          <FieldLabel label="Filter By Client">
            <select className={inputClasses} value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}>
              <option value="all">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.clientName}
                </option>
              ))}
            </select>
          </FieldLabel>
          <FieldLabel label="Generate For Project">
            <select className={inputClasses} value={selectedProjectId} onChange={(event) => setProjectId(event.target.value)}>
              {projectOptions.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.projectName}
                </option>
              ))}
            </select>
          </FieldLabel>
          <Button onClick={generateSlots} disabled={!selectedProjectId || saving}>
            <Sparkles className="h-4 w-4" />
            Generate Slots
          </Button>
          {saving ? <Badge tone="info">Saving...</Badge> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">{monthSlots.length} visible slots</Badge>
          <Badge tone="neutral">{allMonthSlots.length} total this month</Badge>
          {clientFilter !== "all" ? (
            <Button variant="secondary" size="sm" onClick={() => setClientFilter("all")}>
              Clear client filter
            </Button>
          ) : null}
        </div>
        {generatedMessage ? (
          <div className="rounded-2xl border border-[#b8ead6] bg-[#eafaf3] p-4 text-sm font-semibold text-[#0c7c52]">
            {generatedMessage}
          </div>
        ) : null}
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <CalendarMetric label="Slots This Month" value={monthSlots.length} />
        <CalendarMetric label="Designing" value={monthSlots.filter((slot) => slot.status === "Designing").length} />
        <CalendarMetric label="Review" value={monthSlots.filter((slot) => slot.status === "Review").length} />
        <CalendarMetric label="Scheduled" value={monthSlots.filter((slot) => slot.status === "Scheduled").length} />
        <CalendarMetric label="Posted" value={monthSlots.filter((slot) => slot.status === "Posted").length} />
      </div>

      <Panel className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Production workflow</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Move monthly posters through design, review, approval, scheduling, and posting.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {designerWorkload.length ? (
              designerWorkload.map((item) => (
                <Badge key={item.designer} tone="info">
                  {item.designer}: {item.count}
                </Badge>
              ))
            ) : (
              <Badge tone="success">No active workload</Badge>
            )}
          </div>
        </div>

        {monthSlots.length ? (
          <div className="grid gap-3 xl:grid-cols-6">
            {workflowColumns.map(({ status, slots }) => (
              <div key={status} className="rounded-2xl border border-border bg-surface-soft p-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge>{status}</Badge>
                  <span className="font-mono text-sm font-bold text-muted">{slots.length}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {slots.slice(0, 5).map((slot) => {
                    const client = clientById.get(slot.clientId);
                    const nextStatus = getNextPosterStatus(slot.status);
                    return (
                      <div key={slot.id} className="rounded-xl border border-border bg-white p-3">
                        <p className="line-clamp-2 text-sm font-semibold">{slot.title}</p>
                        <p className="mt-1 text-xs text-muted">{client?.clientName || "Unknown client"}</p>
                        <p className="mt-1 text-xs text-muted">
                          {formatDate(slot.slotDate)} - {slot.designer}
                        </p>
                        {nextStatus ? (
                          <Button
                            className="mt-3 w-full"
                            variant="secondary"
                            size="sm"
                            onClick={() => void updatePosterSlot(slot.id, { status: nextStatus })}
                          >
                            Move to {nextStatus}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    );
                  })}
                  {!slots.length ? (
                    <p className="rounded-xl border border-dashed border-border bg-white p-3 text-center text-xs font-semibold text-muted">
                      Empty
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No workflow slots"
            description={clientFilter === "all" ? "Generate this month's poster slots to start production tracking." : "No poster slots match this client filter for the selected month."}
            action={<Button onClick={generateSlots} disabled={!selectedProjectId}>Generate Slots</Button>}
          />
        )}
      </Panel>

      <Panel>
        {monthSlots.length ? (
          <div className="overflow-hidden rounded-[20px] border border-border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="bg-surface-strong text-xs font-bold uppercase tracking-[0.08em] text-[#cad6dc]">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Poster</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Designer</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {monthSlots.map((slot) => {
                    const project = projectById.get(slot.projectId);
                    const client = clientById.get(slot.clientId);
                    return (
                      <tr key={slot.id}>
                        <td className="px-4 py-4 font-semibold">{formatDate(slot.slotDate)}</td>
                        <td className="px-4 py-4">
                          <p className="font-semibold">{slot.title}</p>
                          <p className="mt-1 text-xs text-muted">{slot.notes || (slot.captionRequired ? "Caption required" : "Design only")}</p>
                        </td>
                        <td className="px-4 py-4">{client?.clientName || "Unknown client"}</td>
                        <td className="px-4 py-4">{project?.projectName || "Unknown project"}</td>
                        <td className="px-4 py-4">{slot.designer}</td>
                        <td className="px-4 py-4">
                          <select
                            className={`${inputClasses} min-h-9 rounded-xl text-xs`}
                            value={slot.status}
                            onChange={(event) => void updatePosterSlot(slot.id, { status: event.target.value as PosterSlotStatus })}
                          >
                            {posterSlotStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => setEditingSlot(slot)} title="Edit slot">
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button variant="danger" size="icon" onClick={() => removeSlot(slot)} title="Delete slot">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No poster slots this month"
            description={clientFilter === "all" ? "Generate monthly poster slots from an active poster package project or add a single slot manually." : "Clear the client filter or generate slots for this client."}
            action={<Button onClick={generateSlots} disabled={!selectedProjectId}>Generate Slots</Button>}
          />
        )}
      </Panel>

      {addingSlot || editingSlot ? (
        <Modal
          title={editingSlot ? "Edit poster slot" : "Add poster slot"}
          description="Manage slot date, designer, approval status, caption need, and notes."
          onClose={() => {
            setAddingSlot(false);
            setEditingSlot(null);
          }}
          wide
        >
          <PosterSlotForm
            slot={editingSlot || undefined}
            month={month}
            projects={projects}
            clients={clients}
            onSubmit={saveSlot}
            onCancel={() => {
              setAddingSlot(false);
              setEditingSlot(null);
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}

function PosterSlotForm({
  slot,
  month,
  projects,
  clients,
  onSubmit,
  onCancel,
}: {
  slot?: PosterSlot;
  month: string;
  projects: ReturnType<typeof useCRM>["projects"];
  clients: ReturnType<typeof useCRM>["clients"];
  onSubmit: (draft: PosterSlotDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const initialProject = projects.find((project) => project.id === slot?.projectId) || projects[0];
  const [draft, setDraft] = useState<PosterSlotDraft>(() => ({
    projectId: slot?.projectId || initialProject?.id || "",
    clientId: slot?.clientId || initialProject?.clientId || clients[0]?.id || "",
    title: slot?.title || "Poster slot",
    slotDate: slot?.slotDate || `${month}-01`,
    designer: slot?.designer || initialProject?.designer || "Naveen",
    status: slot?.status || "Planned",
    captionRequired: slot?.captionRequired ?? true,
    notes: slot?.notes || "",
  }));

  function update<K extends keyof PosterSlotDraft>(key: K, value: PosterSlotDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateProject(projectId: string) {
    const project = projects.find((item) => item.id === projectId);
    setDraft((current) => ({
      ...current,
      projectId,
      clientId: project?.clientId || current.clientId,
      designer: project?.designer || current.designer,
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
        <FieldLabel label="Project">
          <select className={inputClasses} value={draft.projectId} onChange={(event) => updateProject(event.target.value)} required>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.projectName}</option>)}
          </select>
        </FieldLabel>
        <FieldLabel label="Client">
          <select className={inputClasses} value={draft.clientId} onChange={(event) => update("clientId", event.target.value)} required>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.clientName}</option>)}
          </select>
        </FieldLabel>
        <FieldLabel label="Slot Date">
          <input className={inputClasses} type="date" value={draft.slotDate} onChange={(event) => update("slotDate", event.target.value)} required />
        </FieldLabel>
        <FieldLabel label="Title">
          <input className={inputClasses} value={draft.title} onChange={(event) => update("title", event.target.value)} required />
        </FieldLabel>
        <FieldLabel label="Designer">
          <select className={inputClasses} value={draft.designer} onChange={(event) => update("designer", event.target.value)}>
            {designerOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </FieldLabel>
        <FieldLabel label="Status">
          <select className={inputClasses} value={draft.status} onChange={(event) => update("status", event.target.value as PosterSlotStatus)}>
            {posterSlotStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </FieldLabel>
        <label className="flex items-center gap-2 self-end rounded-2xl border border-border bg-surface-soft px-3 py-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={draft.captionRequired}
            onChange={(event) => update("captionRequired", event.target.checked)}
          />
          Caption required
        </label>
      </div>
      <FieldLabel label="Notes">
        <textarea className={`${inputClasses} min-h-28 py-3`} value={draft.notes} onChange={(event) => update("notes", event.target.value)} />
      </FieldLabel>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save Slot</Button>
      </div>
    </form>
  );
}

function CalendarMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <Panel className="p-5">
      <CalendarDays className="h-5 w-5 text-accent-dark" />
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl font-bold tracking-tight">{value}</p>
    </Panel>
  );
}

function getNextPosterStatus(status: PosterSlotStatus): PosterSlotStatus | "" {
  const index = posterSlotStatusOptions.indexOf(status);
  return posterSlotStatusOptions[index + 1] || "";
}
