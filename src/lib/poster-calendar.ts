import { todayIso, toLocalIsoDate } from "./utils";

export interface PosterCalendarDay {
  date: string;
  day: number;
  weekday: number;
}

export function normalizePosterMonth(month: string) {
  return /^\d{4}-\d{2}$/.test(month) ? month : todayIso().slice(0, 7);
}

export function getPosterMonthDays(month: string): PosterCalendarDay[] {
  const normalizedMonth = normalizePosterMonth(month);
  const [year, monthNumber] = normalizedMonth.split("-").map(Number);
  const daysInMonth = getDaysInMonth(normalizedMonth);

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return {
      date,
      day,
      weekday: new Date(`${date}T12:00:00.000Z`).getUTCDay(),
    };
  });
}

export function buildPosterSlotDates(
  month: string,
  target: number,
  projectCreatedAt = "",
) {
  const normalizedMonth = normalizePosterMonth(month);
  const [year, monthNumber] = normalizedMonth.split("-").map(Number);
  if (!year || !monthNumber) return [];

  const startDate = getPosterGenerationStartDate(normalizedMonth, projectCreatedAt);
  if (!startDate) return [];

  const daysInMonth = getDaysInMonth(normalizedMonth);
  const startDay = Number(startDate.slice(8, 10));
  const availableDays = Math.max(daysInMonth - startDay + 1, 0);
  const clampedTarget = Math.min(Math.max(target || 30, 1), availableDays);
  const step = availableDays / clampedTarget;
  const used = new Set<number>();

  return Array.from({ length: clampedTarget }, (_, index) => {
    let day = Math.min(daysInMonth, startDay + Math.floor(index * step));
    while (used.has(day) && day < daysInMonth) day += 1;
    used.add(day);
    return `${year}-${String(monthNumber).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  });
}

export function getPosterGenerationStartDate(month: string, projectCreatedAt = "") {
  const normalizedMonth = normalizePosterMonth(month);
  const createdDate = toLocalDateText(projectCreatedAt);
  if (!createdDate) return `${normalizedMonth}-01`;

  const createdMonth = createdDate.slice(0, 7);
  if (createdMonth > normalizedMonth) return "";
  if (createdMonth === normalizedMonth) return createdDate;
  return `${normalizedMonth}-01`;
}

export function getPosterSlotSequenceNumber(slotDate: string, scheduleDates: string[]) {
  const index = scheduleDates.indexOf(slotDate);
  return index >= 0 ? index + 1 : 0;
}

export function formatPosterSequence(sequence: number) {
  return sequence > 0 ? `Poster ${sequence}` : "Poster";
}

function getDaysInMonth(month: string) {
  const [year, monthNumber] = normalizePosterMonth(month).split("-").map(Number);
  if (!year || !monthNumber) return 0;
  return new Date(Date.UTC(year, monthNumber, 0, 12)).getUTCDate();
}

function toLocalDateText(value: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return toLocalIsoDate(date);
}
