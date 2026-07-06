"use client";

import { Edit3, FolderKanban, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useCRM } from "@/components/crm-provider";
import { Badge, Button, EmptyState, FieldLabel, Modal, PageHeader, Panel, inputClasses } from "@/components/ui";
import { designerOptions, projectStatusOptions, projectTypeOptions } from "@/lib/constants";
import type { ProjectStatus, ProjectType, StudioProject, StudioProjectDraft } from "@/lib/types";
import { formatDate } from "@/lib/utils";

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
          <div className="overflow-hidden rounded-[20px] border border-border">
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
