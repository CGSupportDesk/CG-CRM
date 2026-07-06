import type { CRMState } from "./types";

export function createSeedData(): CRMState {
  return {
    leads: [],
    followups: [],
    activityLogs: [],
  };
}
