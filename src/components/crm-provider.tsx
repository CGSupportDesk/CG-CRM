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
  ActivityLog,
  CRMState,
  Followup,
  FollowupDraft,
  ImportPreviewRow,
  ImportSummary,
  Lead,
  LeadDraft,
} from "@/lib/types";
import { createId } from "@/lib/utils";

const STORAGE_KEY = "growth-engine-crm-state-v4";

interface CRMContextValue extends CRMState {
  loading: boolean;
  addLead: (lead: LeadDraft) => string;
  updateLead: (id: string, changes: Partial<LeadDraft>) => void;
  archiveLead: (id: string) => void;
  deleteLead: (id: string) => void;
  addFollowup: (followup: FollowupDraft) => string;
  updateFollowup: (id: string, changes: Partial<FollowupDraft>) => void;
  importLegacyRows: (rows: ImportPreviewRow[]) => ImportSummary;
  resetDemoData: () => void;
}

const CRMContext = createContext<CRMContextValue | null>(null);

export function CRMProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CRMState>(() => ({
    leads: [],
    followups: [],
    activityLogs: [],
  }));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialState() {
      let nextState: CRMState = createSeedData();
      const stored = window.localStorage.getItem(STORAGE_KEY);

      if (stored) {
        try {
          nextState = JSON.parse(stored) as CRMState;
        } catch {
          nextState = createSeedData();
        }
      } else {
        try {
          const response = await fetch("/api/seed", { cache: "no-store" });
          if (response.ok) {
            nextState = (await response.json()) as CRMState;
          }
        } catch {
          nextState = createSeedData();
        }
      }

      if (!cancelled) {
        // Local storage must be read after hydration so the server and first client render match.
        setState(nextState);
        setLoading(false);
      }
    }

    void loadInitialState();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [loading, state]);

  const addLead = useCallback((leadDraft: LeadDraft) => {
    const id = createId("lead");
    const now = new Date().toISOString();
    const lead: Lead = {
      ...leadDraft,
      id,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    const log = buildLog(id, "Lead created", "", lead.leadStage);

    setState((current) => ({
      ...current,
      leads: [lead, ...current.leads],
      activityLogs: [log, ...current.activityLogs],
    }));

    return id;
  }, []);

  const updateLead = useCallback((id: string, changes: Partial<LeadDraft>) => {
    setState((current) => {
      const existing = current.leads.find((lead) => lead.id === id);
      if (!existing) return current;

      const updated: Lead = {
        ...existing,
        ...changes,
        updatedAt: new Date().toISOString(),
      };
      const logs = buildChangeLogs(existing, updated);

      return {
        ...current,
        leads: current.leads.map((lead) => (lead.id === id ? updated : lead)),
        activityLogs: [...logs, ...current.activityLogs],
      };
    });
  }, []);

  const archiveLead = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      leads: current.leads.map((lead) =>
        lead.id === id
          ? { ...lead, isArchived: true, updatedAt: new Date().toISOString() }
          : lead,
      ),
      activityLogs: [buildLog(id, "Lead archived", "Active", "Archived"), ...current.activityLogs],
    }));
  }, []);

  const deleteLead = useCallback((id: string) => {
    setState((current) => ({
      leads: current.leads.filter((lead) => lead.id !== id),
      followups: current.followups.filter((followup) => followup.leadId !== id),
      activityLogs: current.activityLogs.filter((log) => log.leadId !== id),
    }));
  }, []);

  const addFollowup = useCallback((draft: FollowupDraft) => {
    const id = createId("followup");
    const followup: Followup = {
      ...draft,
      id,
      createdAt: new Date().toISOString(),
    };

    setState((current) => {
      const existing = current.leads.find((lead) => lead.id === draft.leadId);
      const inferredStage = inferLeadStageFromOutcome(draft.outcome, existing?.leadStage);

      return {
        ...current,
        followups: [followup, ...current.followups],
        leads: current.leads.map((lead) =>
          lead.id === draft.leadId
            ? {
                ...lead,
                nextFollowupDate: draft.nextFollowupDate,
                leadStage: inferredStage,
                updatedAt: new Date().toISOString(),
              }
            : lead,
        ),
        activityLogs: [
          buildLog(draft.leadId, "Follow-up added", "", draft.outcome),
          ...(existing?.leadStage !== inferredStage
            ? [buildLog(draft.leadId, "Stage updated", existing?.leadStage || "", inferredStage)]
            : []),
          ...current.activityLogs,
        ],
      };
    });

    return id;
  }, []);

  const updateFollowup = useCallback((id: string, changes: Partial<FollowupDraft>) => {
    setState((current) => {
      const followup = current.followups.find((item) => item.id === id);
      if (!followup) return current;
      const updated = { ...followup, ...changes };

      return {
        ...current,
        followups: current.followups.map((item) => (item.id === id ? updated : item)),
        leads: current.leads.map((lead) =>
          lead.id === updated.leadId && "nextFollowupDate" in changes
            ? {
                ...lead,
                nextFollowupDate: updated.nextFollowupDate,
                updatedAt: new Date().toISOString(),
              }
            : lead,
        ),
        activityLogs: [
          buildLog(updated.leadId, "Follow-up updated", followup.outcome, updated.outcome),
          ...current.activityLogs,
        ],
      };
    });
  }, []);

  const importLegacyRows = useCallback((rows: ImportPreviewRow[]) => {
    const now = new Date().toISOString();
    const importedLeads: Lead[] = rows.map((row) => ({
      ...row.lead,
      id: createId("lead"),
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    }));

    const leadByRow = new Map(rows.map((row, index) => [row.rowNumber, importedLeads[index]]));
    const importedFollowups: Followup[] = rows.flatMap((row) => {
      const lead = leadByRow.get(row.rowNumber);
      if (!lead) return [];
      return row.followups.map((followup) => ({
        ...followup,
        id: createId("followup"),
        leadId: lead.id,
        createdAt: now,
      }));
    });
    const logs: ActivityLog[] = importedLeads.map((lead) =>
      buildLog(lead.id, "Lead imported from CSV", "", lead.leadStage),
    );

    setState((current) => ({
      ...current,
      leads: [...importedLeads, ...current.leads],
      followups: [...importedFollowups, ...current.followups],
      activityLogs: [...logs, ...current.activityLogs],
    }));

    return {
      leadsImported: importedLeads.length,
      followupsImported: importedFollowups.length,
      skippedRows: Math.max(rows.length - importedLeads.length, 0),
    };
  }, []);

  const resetDemoData = useCallback(() => {
    setState(createSeedData());
  }, []);

  const value = useMemo<CRMContextValue>(
    () => ({
      ...state,
      loading,
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

function buildLog(leadId: string, action: string, oldValue: string, newValue: string): ActivityLog {
  return {
    id: createId("log"),
    leadId,
    action,
    oldValue,
    newValue,
    createdBy: "captain",
    createdAt: new Date().toISOString(),
  };
}

function buildChangeLogs(existing: Lead, updated: Lead) {
  const watched: Array<[keyof Lead, string]> = [
    ["leadStage", "Stage updated"],
    ["leadTemperature", "Temperature updated"],
    ["nextFollowupDate", "Next follow-up updated"],
    ["remarks", "Remarks updated"],
  ];

  return watched
    .filter(([key]) => String(existing[key] || "") !== String(updated[key] || ""))
    .map(([key, action]) =>
      buildLog(
        existing.id,
        action,
        String(existing[key] || ""),
        String(updated[key] || ""),
      ),
    );
}

function inferLeadStageFromOutcome(
  outcome: Followup["outcome"],
  currentStage: Lead["leadStage"] = "Follow-up Needed",
): Lead["leadStage"] {
  if (outcome === "Converted") return "Won";
  if (outcome === "Rejected") return "Rejected";
  if (outcome === "No Response") return "No Response";
  if (outcome === "Details Sent") return "Details Sent";
  if (outcome === "Proposal Requested") return "Proposal Sent";
  if (outcome === "Interested" || outcome === "Call Back Later") return "Follow-up Needed";
  return currentStage;
}
