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
} from "@/lib/types";

interface CRMContextValue extends CRMState {
  loading: boolean;
  saving: boolean;
  addLead: (lead: LeadDraft) => Promise<string>;
  updateLead: (id: string, changes: Partial<LeadDraft>) => Promise<void>;
  archiveLead: (id: string) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  addFollowup: (followup: FollowupDraft) => Promise<string>;
  updateFollowup: (id: string, changes: Partial<FollowupDraft>) => Promise<void>;
  importLegacyRows: (rows: ImportPreviewRow[]) => Promise<ImportSummary>;
  resetDemoData: () => Promise<void>;
}

type CrmMutationResponse = {
  id?: string;
  state?: CRMState;
  summary?: ImportSummary;
};

const CRMContext = createContext<CRMContextValue | null>(null);

export function CRMProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CRMState>(() => ({
    leads: [],
    followups: [],
    activityLogs: [],
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
      addFollowup,
      updateFollowup,
      importLegacyRows,
      resetDemoData,
    }),
    [
      addFollowup,
      addLead,
      archiveLead,
      deleteLead,
      importLegacyRows,
      loading,
      resetDemoData,
      saving,
      state,
      updateFollowup,
      updateLead,
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
