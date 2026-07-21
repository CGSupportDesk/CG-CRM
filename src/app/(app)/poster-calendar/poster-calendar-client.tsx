"use client";

import { ArrowRight, CalendarDays, Edit3, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useCRM } from "@/components/crm-provider";
import { Badge, Button, EmptyState, FieldLabel, Modal, PageHeader, Panel, inputClasses } from "@/components/ui";
import { designerOptions, posterSlotStatusOptions } from "@/lib/constants";
import {
  buildPosterSlotDates,
  formatPosterSequence,
  getPosterMonthDays,
  getPosterSlotSequenceNumber,
} from "@/lib/poster-calendar";
import type { PosterSlot, PosterSlotDraft, PosterSlotStatus, StudioProject } from "@/lib/types";
import { cn, formatDate, todayIso } from "@/lib/utils";

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
  const filteredProjects = useMemo(
    () =>
      projects.filter(
        (project) => clientFilter === "all" || project.clientId === clientFilter,
      ),
    [clientFilter, projects],
  );
  const projectOptions = useMemo(() => {
    const posterProjects = filteredProjects.filter(
      (project) => project.projectType === "Poster Package",
    );
    return [
      ...posterProjects,
      ...filteredProjects.filter((project) => project.projectType !== "Poster Package"),
    ];
  }, [filteredProjects]);
  const selectedProjectId = projectOptions.some((project) => project.id === projectId)
    ? projectId
    : projectOptions[0]?.id || "";
  const selectedProject = projectOptions.find((project) => project.id === selectedProjectId) || null;
  const allMonthSlots = useMemo(
    () =>
      posterSlots
        .filter((slot) => slot.slotDate.startsWith(month))
        .sort((a, b) => a.slotDate.localeCompare(b.slotDate)),
    [month, posterSlots],
  );
  const monthSlots = useMemo(
    () =>
      allMonthSlots.filter(
        (slot) => clientFilter === "all" || slot.clientId === clientFilter,
      ),
    [allMonthSlots, clientFilter],
  );
  const workflowColumns = useMemo(
    () =>
      posterSlotStatusOptions.map((status) => ({
        status,
        slots: monthSlots.filter((slot) => slot.status === status),
      })),
    [monthSlots],
  );
  const designerWorkload = useMemo(
    () =>
      designerOptions
        .map((designer) => ({
          designer,
          count: monthSlots.filter((slot) => slot.designer === designer && slot.status !== "Posted").length,
        }))
        .filter((item) => item.count > 0),
    [monthSlots],
  );
  const calendarDays = useMemo(() => getPosterMonthDays(month), [month]);
  const calendarStartOffset = calendarDays[0]?.weekday || 0;
  const slotsByDate = useMemo(
    () =>
      monthSlots.reduce<Record<string, PosterSlot[]>>((acc, slot) => {
        acc[slot.slotDate] ||= [];
        acc[slot.slotDate].push(slot);
        return acc;
      }, {}),
    [monthSlots],
  );
  const slotSequenceById = useMemo(
    () => buildSlotSequenceMap(month, monthSlots, projectById),
    [month, monthSlots, projectById],
  );

  async function generateSlots() {
    if (!selectedProjectId) return;
    const count = await generatePosterSlots(selectedProjectId, month);
    const scheduledDates = selectedProject
      ? buildPosterSlotDates(
          month,
          selectedProject.monthlyPosterTarget || 30,
          selectedProject.createdAt,
        )
      : [];
    setGeneratedMessage(
      count
        ? `${count} poster slots generated for ${month}.`
        : scheduledDates.length
          ? "Slots already exist for this project and month."
          : "No slots generated because this project starts after the selected month.",
    );
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
        <div className="grid gap-3 lg:grid-cols-[180px_220px_1fr_auto_auto_auto] lg:items-end">
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
          <Button variant="secondary" onClick={() => setMonth(todayIso().slice(0, 7))}>
            This Month
          </Button>
          <Button onClick={generateSlots} disabled={!selectedProjectId || saving}>
            <Sparkles className="h-4 w-4" />
            Generate Slots
          </Button>
          {saving ? <Badge tone="info">Saving...</Badge> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">{monthSlots.length} visible slots</Badge>
          <Badge tone="neutral">{allMonthSlots.length} total this month</Badge>
          <Badge tone="neutral">{calendarDays.length} calendar days</Badge>
          {selectedProject ? (
            <Badge tone="info">Project starts {formatDate(selectedProject.createdAt.slice(0, 10))}</Badge>
          ) : null}
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
            <h2 className="text-xl font-semibold">Calendar view</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Full month view with every date visible, including empty 31st days.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CalendarLegend label="Posted" className="border-[#b8ead6] bg-[#eafaf3]" />
            <CalendarLegend label="Missed" className="border-[#f7c7c7] bg-[#fff0f0]" />
            <CalendarLegend label="Today" className="border-[#b8ead6] bg-[#f4fcf8]" />
            <Badge tone="neutral">{formatCalendarMonth(month)}</Badge>
          </div>
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[760px] sm:min-w-[920px]">
            <div className="grid grid-cols-7 gap-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="rounded-xl bg-surface-strong px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.08em] text-[#cad6dc]">
                  {day}
                </div>
              ))}
              {Array.from({ length: calendarStartOffset }, (_, index) => (
                <div key={`blank-${index}`} className="min-h-32 rounded-2xl border border-dashed border-border bg-surface-soft/60" />
              ))}
              {calendarDays.map((day) => {
                const daySlots = slotsByDate[day.date] || [];
                const isCurrentDay = day.date === todayIso();
                const hasMissedDeadline = daySlots.some(isMissedPosterDeadline);
                const allPosted = daySlots.length > 0 && daySlots.every((slot) => slot.status === "Posted");

                return (
                  <div
                    key={day.date}
                    className={cn(
                      "min-h-32 rounded-2xl border p-2",
                      hasMissedDeadline
                        ? "border-[#f7c7c7] bg-[#fff7f7]"
                        : allPosted
                          ? "border-[#b8ead6] bg-[#f4fcf8]"
                          : isCurrentDay
                        ? "border-[#b8ead6] bg-[#f4fcf8]"
                        : "border-border bg-surface-soft",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-xs font-bold">
                        {day.day}
                      </span>
                      <Badge tone={hasMissedDeadline ? "danger" : allPosted ? "success" : daySlots.length ? "info" : "muted"}>
                        {daySlots.length}
                      </Badge>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {daySlots.length ? (
                        daySlots.map((slot) => (
                          <button
                            key={slot.id}
                            type="button"
                            className={cn(
                              "block w-full rounded-xl border px-2 py-2 text-left transition hover:border-[#c2d1d8]",
                              getCalendarSlotClass(slot),
                            )}
                            onClick={() => setEditingSlot(slot)}
                            title="Edit poster slot"
                          >
                            <span className="block truncate text-[11px] font-bold">
                              {getDisplayPosterTitle(slot, slotSequenceById.get(slot.id) || 0)}
                            </span>
                            <span className="mt-1 flex items-center justify-between gap-2 text-[10px] font-semibold text-muted">
                              <span className="truncate">{clientById.get(slot.clientId)?.clientName || "Unknown client"}</span>
                              <span className={cn(
                                slot.status === "Posted" && "text-[#0c7c52]",
                                isMissedPosterDeadline(slot) && "text-[#bd2727]",
                              )}>
                                {isMissedPosterDeadline(slot) ? "Missed" : slot.status}
                              </span>
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className="rounded-xl border border-dashed border-border bg-white/70 px-2 py-3 text-center text-[11px] font-semibold text-muted">
                          No poster
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Panel>

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
                <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto pr-1">
                  {slots.map((slot) => {
                    const client = clientById.get(slot.clientId);
                    const nextStatus = getNextPosterStatus(slot.status);
                    return (
                      <div key={slot.id} className="rounded-xl border border-border bg-white p-3">
                        <p className="line-clamp-2 text-sm font-semibold">
                          {getDisplayPosterTitle(slot, slotSequenceById.get(slot.id) || 0)}
                        </p>
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
                          <p className="font-semibold">
                            {getDisplayPosterTitle(slot, slotSequenceById.get(slot.id) || 0)}
                          </p>
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

function CalendarLegend({ label, className }: { label: string; className: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted">
      <span className={cn("h-3 w-3 rounded-full border", className)} />
      {label}
    </span>
  );
}

function getNextPosterStatus(status: PosterSlotStatus): PosterSlotStatus | "" {
  const index = posterSlotStatusOptions.indexOf(status);
  return posterSlotStatusOptions[index + 1] || "";
}

function buildSlotSequenceMap(
  month: string,
  slots: PosterSlot[],
  projectById: Map<string, StudioProject>,
) {
  const slotsByProject = slots.reduce<Map<string, PosterSlot[]>>((acc, slot) => {
    const projectSlots = acc.get(slot.projectId) || [];
    projectSlots.push(slot);
    acc.set(slot.projectId, projectSlots);
    return acc;
  }, new Map());
  const sequenceById = new Map<string, number>();

  slotsByProject.forEach((projectSlots, projectId) => {
    const project = projectById.get(projectId);
    const sortedSlots = [...projectSlots].sort((a, b) => a.slotDate.localeCompare(b.slotDate));
    const scheduleDates = buildPosterSlotDates(
      month,
      project?.monthlyPosterTarget || sortedSlots.length || 30,
      project?.createdAt || "",
    );

    sortedSlots.forEach((slot, index) => {
      sequenceById.set(
        slot.id,
        getPosterSlotSequenceNumber(slot.slotDate, scheduleDates) || index + 1,
      );
    });
  });

  return sequenceById;
}

function getDisplayPosterTitle(slot: PosterSlot, sequence: number) {
  if (!sequence) return slot.title || "Poster";

  const sequenceLabel = formatPosterSequence(sequence);
  if (!slot.title.trim()) return sequenceLabel;
  if (/poster\s+\d+/i.test(slot.title)) {
    return slot.title.replace(/poster\s+\d+/i, sequenceLabel);
  }

  return `${sequenceLabel} - ${slot.title}`;
}

function formatCalendarMonth(month: string) {
  const date = new Date(`${month}-01T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return month;

  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function isMissedPosterDeadline(slot: PosterSlot) {
  return slot.slotDate < todayIso() && slot.status !== "Posted";
}

function getCalendarSlotClass(slot: PosterSlot) {
  if (slot.status === "Posted") {
    return "border-[#b8ead6] bg-[#eafaf3] text-[#0c7c52]";
  }

  if (isMissedPosterDeadline(slot)) {
    return "border-[#f7c7c7] bg-[#fff0f0] text-[#bd2727]";
  }

  return "border-border bg-white text-foreground";
}
