import "server-only";

export const SESSION_COOKIE = "growth_engine_session";

export function getConfiguredUsername() {
  return process.env.GROWTH_ENGINE_USERNAME || "captain";
}

export function getConfiguredPassword() {
  return process.env.GROWTH_ENGINE_PASSWORD || "";
}

export function getSessionToken() {
  return process.env.GROWTH_ENGINE_SESSION_TOKEN || "growth-engine-phase-1-session";
}

export function isValidSession(value?: string) {
  return Boolean(value && value === getSessionToken());
}
