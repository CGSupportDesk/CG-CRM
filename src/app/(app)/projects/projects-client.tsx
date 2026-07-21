"use client";

import { CalendarClock, Edit3, FolderKanban, Plus, Trash2, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useCRM } from "@/components/crm-provider";
import { Badge, Button, EmptyState, FieldLabel, Modal, PageHeader, Panel, inputClasses } from "@/components/ui";
import { designerOptions, projectStatusOptions, projectTypeOptions } from "@/lib/constants";
import type { ProjectStatus, ProjectType, StudioProject, StudioProjectDraft } from "@/lib/types";
import { formatDate, isOverdue, isToday } from "@/lib/utils";

export function ProjectsClient() {
  const { clients, projects, posterSlots, loading, saving, addProject, updateProject, deleteProject } = useCRM();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "all">("all");
  const [type, setType] = useState<ProjectType | "all">("all");
  const [editingProject, setEditingProject] = useState<StudioProject | null>(null);
  const [addingProject, setAddingProject] = useState(false);

  const clientById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const slotsByProject = useMemo(
    () =>
      posterSlots.reduce<Record<string, number>>((acc, slot) => {
        acc[slot.projectId] = (acc[slot.projectId] || 0) + 1;
        return acc;
      }, {}),
    [posterSlots],
  );
  const activeProjects = projects.filter((project) => !["Delivered", "On Hold"].includes(project.status));
  const dueProjects = activeProjects.filter(
    (project) => project.dueDate && (isToday(project.dueDate) || isOverdue(project.dueDate)),
  );
  const designerLoad = projects.reduce<Record<string, number>>((acc, project) => {
    if (!["Delivered", "On Hold"].includes(project.status)) {
      acc[project.designer || "Unassigned"] = (acc[project.designer || "Unassigned"] || 0) + 1;
    }
    return acc;
  }, {});
  const filteredProjects = useMemo(() => {
    const text = query.trim().toLowerCase();
    return projects
      .filter((project) => status === "all" || project.status === status)
      .filter((project) => type === "all" || project.projectType === type)
      .filter((project) => {
        const client = clientById.get(project.clientId);
        const haystack = [project.projectName, project.projectType, project.designer, client?.clientName]
          .join(" ")
          .toLowerCase();
        return !text || haystack.includes(text);
      });
  }, [clientById, projects, query, status, type]);

  async function saveProject(draft: StudioProjectDraft) {
    if (editingProject) {
      await updateProject(editingProject.id, draft);
      setEditingProject(null);
    } else {
      await addProject(draft);
      setAddingProject(false);
    }
  }

  function removeProject(project: StudioProject) {
    if (window.confirm(`Delete project ${project.projectName}? Poster slots for this project will also be deleted.`)) {
      void deleteProject(project.id);
    }
  }

  if (loading) {
    return <EmptyState title="Loading projects" description="Preparing CG Studio projects." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description="Track poster packages, branding work, one-time creatives, maintenance, delivery status, and designer ownership."
        action={
          <Button onClick={() => setAddingProject(true)} disabled={!clients.length}>
            <Plus className="h-4 w-4" />
            Add Project
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ProjectMetric label="Total Projects" value={projects.length} />
        <ProjectMetric label="In Progress" value={projects.filter((project) => project.status === "In Progress").length} />
        <ProjectMetric label="In Review" value={projects.filter((project) => project.status === "In Review").length} />
        <ProjectMetric label="Delivered" value={projects.filter((project) => project.status === "Delivered").length} />
      </div>

      <Panel dark className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Project operations board</h2>
            <p className="mt-1 text-sm leading-6 text-[#cad6dc]">
              Production health for poster packages, creatives, due dates, and designer ownership.
            </p>
          </div>
          <Badge tone={dueProjects.length ? "danger" : "success"}>
            {dueProjects.length ? `${dueProjects.length} due` : "On track"}
          </Badge>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <ProjectOpsCard icon={FolderKanban} label="Active projects" value={activeProjects.length} detail="Not delivered or on hold" />
          <ProjectOpsCard icon={CalendarClock} label="Due attention" value={dueProjects.length} detail="Due today or overdue" danger={dueProjects.length > 0} />
          <ProjectOpsCard icon={UserRound} label="Assigned designers" value={Object.keys(designerLoad).length} detail="With active project load" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(designerLoad).map(([designer, count]) => (
            <Badge key={designer} tone="info">
              {designer}: {count}
            </Badge>
          ))}
        </div>
      </Panel>

      <Panel className="space-y-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px_220px_auto] md:items-end">
          <FieldLabel label="Search">
            <input className={inputClasses} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Project, client, designer" />
          </FieldLabel>
          <FieldLabel label="Type">
            <select className={inputClasses} value={type} onChange={(event) => setType(event.target.value as ProjectType | "all")}>
              <option value="all">All</option>
              {projectTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </FieldLabel>
          <FieldLabel label="Status">
            <select className={inputClasses} value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus | "all")}>
              <option value="all">All</option>
              {projectStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </FieldLabel>
          {saving ? <Badge tone="info">Saving...</Badge> : null}
        </div>

        {filteredProjects.length ? (
          <div className="space-y-3">
            <div className="grid gap-3 lg:hidden">
              {filteredProjects.map((project) => (
                <ProjectMobileCard
                  key={project.id}
                  project={project}
                  clientName={clientById.get(project.clientId)?.clientName || "Unknown client"}
                  slotCount={slotsByProject[project.id] || 0}
                  onEdit={() => setEditingProject(project)}
                  onDelete={() => removeProject(project)}
                />
              ))}
            </div>
            <div className="hidden overflow-hidden rounded-[20px] border border-border lg:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="bg-surface-strong text-xs font-bold uppercase tracking-[0.08em] text-[#cad6dc]">
                  <tr>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3">Designer</th>
                    <th className="px-4 py-3">Posters</th>
                    <th className="px-4 py-3">Due</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-white">
                  {filteredProjects.map((project) => (
                    <tr key={project.id}>
                      <td className="px-4 py-4">
                        <p className="font-semibold">{project.projectName}</p>
                        <p className="mt-1 text-xs text-muted">{project.projectType}</p>
                      </td>
                      <td className="px-4 py-4">{clientById.get(project.clientId)?.clientName || "Unknown client"}</td>
                      <td className="px-4 py-4">{project.designer || "Unassigned"}</td>
                      <td className="px-4 py-4">
                        <p className="font-mono font-bold">{project.postersCompleted}/{project.monthlyPosterTarget || slotsByProject[project.id] || 0}</p>
                        <p className="text-xs text-muted">{slotsByProject[project.id] || 0} calendar slots</p>
                      </td>
                      <td className="px-4 py-4">{formatDate(project.dueDate)}</td>
                      <td className="px-4 py-4"><Badge>{project.status}</Badge></td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => setEditingProject(project)} title="Edit project">
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button variant="danger" size="icon" onClick={() => removeProject(project)} title="Delete project">
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
            title={clients.length ? "No projects yet" : "No clients yet"}
            description={clients.length ? "Add a project for a client or mark a lead as Won to create a starter project." : "Create a client first. Won leads become clients automatically."}
            action={clients.length ? <Button onClick={() => setAddingProject(true)}>Add Project</Button> : null}
          />
        )}
      </Panel>

      {addingProject || editingProject ? (
        <Modal
          title={editingProject ? "Edit project" : "Add project"}
          description="Track poster packages, branding work, one-time creatives, and maintenance."
          onClose={() => {
            setAddingProject(false);
            setEditingProject(null);
          }}
          wide
        >
          <ProjectForm
            project={editingProject || undefined}
            clients={clients}
            onSubmit={saveProject}
            onCancel={() => {
              setAddingProject(false);
              setEditingProject(null);
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}

function ProjectMobileCard({
  project,
  clientName,
  slotCount,
  onEdit,
  onDelete,
}: {
  project: StudioProject;
  clientName: string;
  slotCount: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const target = project.monthlyPosterTarget || slotCount || 0;
  const completed = Math.min(project.postersCompleted || 0, target || 0);
  const progress = target ? Math.round((completed / target) * 100) : 0;
  const dueRisk = project.dueDate && project.status !== "Delivered" && (isToday(project.dueDate) || isOverdue(project.dueDate));

  return (
    <article className="w-full min-w-0 overflow-hidden rounded-[20px] border border-border bg-white p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-bold">{project.projectName}</p>
          <p className="mt-1 truncate text-xs text-muted">{clientName} - {project.projectType}</p>
        </div>
        <Badge>{project.status}</Badge>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-muted">
          <span>Poster progress</span>
          <span>{completed}/{target || 0}</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#e8f0f4]">
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(progress, target ? 8 : 0)}%` }} />
        </div>
      </div>
      <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
        <MiniProjectCell label="Designer" value={project.designer || "Unassigned"} />
        <MiniProjectCell label="Due" value={formatDate(project.dueDate)} danger={Boolean(dueRisk)} />
        <MiniProjectCell label="Slots" value={slotCount} />
        <MiniProjectCell label="Target" value={target || 0} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="ghost" size="icon" onClick={onEdit} title="Edit project">
          <Edit3 className="h-4 w-4" />
        </Button>
        <Button variant="danger" size="icon" onClick={onDelete} title="Delete project">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </article>
  );
}

function MiniProjectCell({
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

function ProjectOpsCard({
  icon: Icon,
  label,
  value,
  detail,
  danger = false,
}: {
  icon: typeof FolderKanban;
  label: string;
  value: number;
  detail: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
      <div className="flex items-center justify-between gap-3">
        <Icon className="h-5 w-5 text-accent" />
        <Badge tone={danger ? "danger" : "info"}>{value}</Badge>
      </div>
      <p className="mt-4 text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 text-xs leading-5 text-[#cad6dc]">{detail}</p>
    </div>
  );
}

function ProjectForm({
  project,
  clients,
  onSubmit,
  onCancel,
}: {
  project?: StudioProject;
  clients: ReturnType<typeof useCRM>["clients"];
  onSubmit: (draft: StudioProjectDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<StudioProjectDraft>(() => ({
    clientId: project?.clientId || clients[0]?.id || "",
    projectName: project?.projectName || "",
    projectType: project?.projectType || "Poster Package",
    status: project?.status || "Planning",
    designer: project?.designer || "Naveen",
    monthlyPosterTarget: project?.monthlyPosterTarget || 30,
    postersCompleted: project?.postersCompleted || 0,
    dueDate: project?.dueDate || "",
    notes: project?.notes || "",
  }));

  function update<K extends keyof StudioProjectDraft>(key: K, value: StudioProjectDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
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
        <FieldLabel label="Client">
          <select className={inputClasses} value={draft.clientId} onChange={(event) => update("clientId", event.target.value)} required>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.clientName}</option>)}
          </select>
        </FieldLabel>
        <FieldLabel label="Project Name">
          <input className={inputClasses} value={draft.projectName} onChange={(event) => update("projectName", event.target.value)} required />
        </FieldLabel>
        <FieldLabel label="Type">
          <select className={inputClasses} value={draft.projectType} onChange={(event) => update("projectType", event.target.value as ProjectType)}>
            {projectTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </FieldLabel>
        <FieldLabel label="Status">
          <select className={inputClasses} value={draft.status} onChange={(event) => update("status", event.target.value as ProjectStatus)}>
            {projectStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </FieldLabel>
        <FieldLabel label="Designer">
          <select className={inputClasses} value={draft.designer} onChange={(event) => update("designer", event.target.value)}>
            {designerOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </FieldLabel>
        <FieldLabel label="Due Date">
          <input className={inputClasses} type="date" value={draft.dueDate} onChange={(event) => update("dueDate", event.target.value)} />
        </FieldLabel>
        <FieldLabel label="Monthly Poster Target">
          <input className={inputClasses} type="number" min={0} value={draft.monthlyPosterTarget} onChange={(event) => update("monthlyPosterTarget", Number(event.target.value))} />
        </FieldLabel>
        <FieldLabel label="Posters Completed">
          <input className={inputClasses} type="number" min={0} value={draft.postersCompleted} onChange={(event) => update("postersCompleted", Number(event.target.value))} />
        </FieldLabel>
      </div>
      <FieldLabel label="Notes">
        <textarea className={`${inputClasses} min-h-28 py-3`} value={draft.notes} onChange={(event) => update("notes", event.target.value)} />
      </FieldLabel>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save Project</Button>
      </div>
    </form>
  );
}

function ProjectMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <Panel className="p-5">
      <FolderKanban className="h-5 w-5 text-accent-dark" />
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.08em] text-muted">{label}</p>
      <p className="mt-2 font-mono text-3xl font-bold tracking-tight">{value}</p>
    </Panel>
  );
}
