"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createSeedData } from "@/lib/seed-data";
import type {
  CRMState,
  FollowupDraft,
  ImportPreviewRow,
  ImportSummary,
  LeadDraft,
  PosterSlotDraft,
  StudioClientDraft,
  StudioProjectDraft,
  StudioSettingDraft,
} from "@/lib/types";

interface CRMContextValue extends CRMState {
  loading: boolean;
  saving: boolean;
  addLead: (lead: LeadDraft) => Promise<string>;
  updateLead: (id: string, changes: Partial<LeadDraft>) => Promise<void>;
  archiveLead: (id: string) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  logLeadActivity: (leadId: string, action: string, newValue?: string) => Promise<void>;
  addFollowup: (followup: FollowupDraft) => Promise<string>;
  updateFollowup: (id: string, changes: Partial<FollowupDraft>) => Promise<void>;
  importLegacyRows: (rows: ImportPreviewRow[]) => Promise<ImportSummary>;
  addClient: (client: StudioClientDraft) => Promise<string>;
  updateClient: (id: string, changes: Partial<StudioClientDraft>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  addProject: (project: StudioProjectDraft) => Promise<string>;
  updateProject: (id: string, changes: Partial<StudioProjectDraft>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addPosterSlot: (posterSlot: PosterSlotDraft) => Promise<string>;
  updatePosterSlot: (id: string, changes: Partial<PosterSlotDraft>) => Promise<void>;
  deletePosterSlot: (id: string) => Promise<void>;
  generatePosterSlots: (projectId: string, month: string) => Promise<number>;
  addStudioSetting: (setting: StudioSettingDraft) => Promise<string>;
  updateStudioSetting: (id: string, changes: Partial<StudioSettingDraft>) => Promise<void>;
  deleteStudioSetting: (id: string) => Promise<void>;
  resetDemoData: () => Promise<void>;
}

type CrmMutationResponse = {
  id?: string;
  state?: CRMState;
  summary?: ImportSummary;
  generated?: number;
};

const CRMContext = createContext<CRMContextValue | null>(null);

export function CRMProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CRMState>(() => ({
    leads: [],
    followups: [],
    activityLogs: [],
    clients: [],
    projects: [],
    posterSlots: [],
    settings: [],
  }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialState() {
      const nextState = await fetchInitialState();

      if (!cancelled) {
        setState(nextState);
        setLoading(false);
      }
    }

    void loadInitialState();

    return () => {
      cancelled = true;
    };
  }, []);

  const mutate = useCallback(async (payload: Record<string, unknown>) => {
    setSaving(true);

    try {
      const response = await fetch("/api/crm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`CRM request failed with ${response.status}`);
      }

      const result = (await response.json()) as CrmMutationResponse;
      if (result.state) setState(result.state);
      return result;
    } finally {
      setSaving(false);
    }
  }, []);

  const addLead = useCallback(
    async (leadDraft: LeadDraft) => {
      const result = await mutate({ action: "addLead", lead: leadDraft });
      return result.id || "";
    },
    [mutate],
  );

  const updateLead = useCallback(
    async (id: string, changes: Partial<LeadDraft>) => {
      await mutate({ action: "updateLead", id, changes });
    },
    [mutate],
  );

  const archiveLead = useCallback(
    async (id: string) => {
      await mutate({ action: "archiveLead", id });
    },
    [mutate],
  );

  const deleteLead = useCallback(
    async (id: string) => {
      await mutate({ action: "deleteLead", id });
    },
    [mutate],
  );

  const logLeadActivity = useCallback(
    async (leadId: string, action: string, newValue = "") => {
      await mutate({ action: "logLeadActivity", leadId, logAction: action, newValue });
    },
    [mutate],
  );

  const addFollowup = useCallback(
    async (followup: FollowupDraft) => {
      const result = await mutate({ action: "addFollowup", followup });
      return result.id || "";
    },
    [mutate],
  );

  const updateFollowup = useCallback(
    async (id: string, changes: Partial<FollowupDraft>) => {
      await mutate({ action: "updateFollowup", id, changes });
    },
    [mutate],
  );

  const importLegacyRows = useCallback(
    async (rows: ImportPreviewRow[]) => {
      const result = await mutate({ action: "importLegacyRows", rows });
      return (
        result.summary || {
          leadsImported: 0,
          followupsImported: 0,
          skippedRows: rows.length,
        }
      );
    },
    [mutate],
  );

  const addClient = useCallback(
    async (client: StudioClientDraft) => {
      const result = await mutate({ action: "addClient", client });
      return result.id || "";
    },
    [mutate],
  );

  const updateClient = useCallback(
    async (id: string, changes: Partial<StudioClientDraft>) => {
      await mutate({ action: "updateClient", id, changes });
    },
    [mutate],
  );

  const deleteClient = useCallback(
    async (id: string) => {
      await mutate({ action: "deleteClient", id });
    },
    [mutate],
  );

  const addProject = useCallback(
    async (project: StudioProjectDraft) => {
      const result = await mutate({ action: "addProject", project });
      return result.id || "";
    },
    [mutate],
  );

  const updateProject = useCallback(
    async (id: string, changes: Partial<StudioProjectDraft>) => {
      await mutate({ action: "updateProject", id, changes });
    },
    [mutate],
  );

  const deleteProject = useCallback(
    async (id: string) => {
      await mutate({ action: "deleteProject", id });
    },
    [mutate],
  );

  const addPosterSlot = useCallback(
    async (posterSlot: PosterSlotDraft) => {
      const result = await mutate({ action: "addPosterSlot", posterSlot });
      return result.id || "";
    },
    [mutate],
  );

  const updatePosterSlot = useCallback(
    async (id: string, changes: Partial<PosterSlotDraft>) => {
      await mutate({ action: "updatePosterSlot", id, changes });
    },
    [mutate],
  );

  const deletePosterSlot = useCallback(
    async (id: string) => {
      await mutate({ action: "deletePosterSlot", id });
    },
    [mutate],
  );

  const generatePosterSlots = useCallback(
    async (projectId: string, month: string) => {
      const result = await mutate({ action: "generatePosterSlots", projectId, month });
      return result.generated || 0;
    },
    [mutate],
  );

  const addStudioSetting = useCallback(
    async (setting: StudioSettingDraft) => {
      const result = await mutate({ action: "addStudioSetting", setting });
      return result.id || "";
    },
    [mutate],
  );

  const updateStudioSetting = useCallback(
    async (id: string, changes: Partial<StudioSettingDraft>) => {
      await mutate({ action: "updateStudioSetting", id, changes });
    },
    [mutate],
  );

  const deleteStudioSetting = useCallback(
    async (id: string) => {
      await mutate({ action: "deleteStudioSetting", id });
    },
    [mutate],
  );

  const resetDemoData = useCallback(async () => {
    await mutate({ action: "resetData" });
  }, [mutate]);

  const value = useMemo<CRMContextValue>(
    () => ({
      ...state,
      loading,
      saving,
      addLead,
      updateLead,
      archiveLead,
      deleteLead,
      logLeadActivity,
      addFollowup,
      updateFollowup,
      importLegacyRows,
      addClient,
      updateClient,
      deleteClient,
      addProject,
      updateProject,
      deleteProject,
      addPosterSlot,
      updatePosterSlot,
      deletePosterSlot,
      generatePosterSlots,
      addStudioSetting,
      updateStudioSetting,
      deleteStudioSetting,
      resetDemoData,
    }),
    [
      addClient,
      addFollowup,
      addLead,
      addPosterSlot,
      addProject,
      addStudioSetting,
      archiveLead,
      deleteClient,
      deleteLead,
      logLeadActivity,
      deletePosterSlot,
      deleteProject,
      deleteStudioSetting,
      generatePosterSlots,
      importLegacyRows,
      loading,
      resetDemoData,
      saving,
      state,
      updateClient,
      updateFollowup,
      updateLead,
      updatePosterSlot,
      updateProject,
      updateStudioSetting,
    ],
  );

  return <CRMContext.Provider value={value}>{children}</CRMContext.Provider>;
}

export function useCRM() {
  const context = useContext(CRMContext);
  if (!context) throw new Error("useCRM must be used inside CRMProvider");
  return context;
}

async function fetchInitialState() {
  try {
    const response = await fetch("/api/crm", { cache: "no-store" });
    if (response.ok) return (await response.json()) as CRMState;
  } catch {
    // Fall back below so the UI can still open if the database is temporarily unavailable.
  }

  try {
    const response = await fetch("/api/seed", { cache: "no-store" });
    if (response.ok) return (await response.json()) as CRMState;
  } catch {
    // Last-resort empty state keeps the app renderable.
  }

  return createSeedData();
}
