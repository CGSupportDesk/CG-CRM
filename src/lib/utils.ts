import type { Lead, LeadStage, LeadTemperature } from "./types";

const APP_TIME_ZONE = "Asia/Kolkata";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function todayIso() {
  return toLocalIsoDate(new Date());
}

export function offsetDate(days: number) {
  const date = new Date(`${todayIso()}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function toLocalIsoDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
  const year = parts.year;
  const month = parts.month;
  const day = parts.day;
  return `${year}-${month}-${day}`;
}

export function dateOnlyText(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateTimeFromOffset(days: number, hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

export function parsePossibleDate(value: string) {
  const raw = value.trim();
  if (!raw) return "";

  const numericDate = parseNumericDate(raw);
  if (numericDate) return numericDate;

  const monthName = raw.match(
    /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,\s*(\d{4}))?/i,
  );
  if (monthName) {
    const months = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ];
    const month = months.indexOf(monthName[1].toLowerCase()) + 1;
    const day = Number(monthName[2]);
    const year = Number(monthName[3] || new Date().getFullYear());

    if (month > 0 && Number.isFinite(day) && Number.isFinite(year)) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return toLocalIsoDate(direct);

  return "";
}

function parseNumericDate(raw: string) {
  const normalized = raw.replace(/\./g, "/").replace(/-/g, "/");
  const parts = normalized.split("/").map((part) => part.trim());
  if (parts.length !== 3 || !parts.every((part) => /^\d{1,4}$/.test(part))) return "";

  const [first, second, third] = parts;
  const firstNumber = Number(first);
  const secondNumber = Number(second);
  const thirdNumber = Number(third.length === 2 ? `20${third}` : third);

  if (
    !Number.isFinite(firstNumber) ||
    !Number.isFinite(secondNumber) ||
    !Number.isFinite(thirdNumber)
  ) {
    return "";
  }

  if (first.length === 4) {
    return toValidIsoDate(firstNumber, secondNumber, thirdNumber);
  }

  const monthFirst = secondNumber > 12;
  const month = monthFirst ? firstNumber : secondNumber;
  const day = monthFirst ? secondNumber : firstNumber;
  return toValidIsoDate(thirdNumber, month, day);
}

function toValidIsoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return "";
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatDate(value: string, fallback = "Not set") {
  if (!value) return fallback;
  const date = new Date(`${value}T12:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function isToday(value: string) {
  return value === todayIso();
}

export function isOverdue(value: string) {
  return Boolean(value && value < todayIso());
}

export function startOfWeekIso() {
  const date = new Date(`${todayIso()}T12:00:00.000Z`);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

export function sortByDateDesc<T>(items: T[], getDate: (item: T) => string) {
  return [...items].sort((a, b) => getDate(b).localeCompare(getDate(a)));
}

export function truncate(value: string, length = 90) {
  if (!value) return "";
  return value.length > length ? `${value.slice(0, length - 1)}...` : value;
}

export function cleanPhone(value: string) {
  const raw = value.trim();
  if (!raw || /^no\s*number$/i.test(raw) || /^n\/?a$/i.test(raw)) return "";

  const digits = raw.replace(/[^\d+]/g, "");
  const digitCount = digits.replace(/\D/g, "").length;
  if (digitCount >= 10 && digitCount <= 13) return digits;

  return raw;
}

export function statusTone(status: LeadStage | LeadTemperature | string) {
  if (status === "Hot") return "hot";
  if (status === "Warm") return "warm";
  if (status === "Cold") return "cold";
  if (status === "Won" || status === "Converted" || status === "Active")
    return "success";
  if (status === "Lost" || status === "Rejected") return "danger";
  if (status === "No Response") return "muted";
  if (status === "Coming Soon") return "soon";
  if (status === "Proposal Sent" || status === "Details Sent") return "info";
  return "neutral";
}

export function getDisplayName(lead: Lead) {
  return lead.businessName || lead.leadName || lead.contactPerson || "Untitled lead";
}
