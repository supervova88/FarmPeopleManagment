import { enumerateDates, formatDate, shiftDate } from "@/shared/lib/utils";
import type { TimesheetPeriod } from "./model";

/** Гранулярность отображения расчётного периода. */
export type PeriodGranularity = "month" | "week";

/** Клиентский фильтр периода (не хранится в SQLite). */
export interface PeriodViewState {
  granularity: PeriodGranularity;
  /** YYYY-MM */
  monthKey: string;
  /** Понедельник выбранной недели, ISO yyyy-mm-dd */
  weekStart: string;
}

export const DEFAULT_MONTH_KEY = "2026-08";

const MONTHS_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

export function monthKeyFromIso(iso: string): string {
  return iso.slice(0, 7);
}

export function monthKeyFromPeriod(period: TimesheetPeriod): string {
  return monthKeyFromIso(period.dateFrom);
}

/** «2026-10» → «Октябрь 2026». */
export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const monthIdx = Number(m) - 1;
  if (!y || monthIdx < 0 || monthIdx > 11) return monthKey;
  return `${MONTHS_RU[monthIdx]} ${y}`;
}

/** Первый и последний день месяца YYYY-MM. */
export function monthBounds(monthKey: string): { dateFrom: string; dateTo: string } {
  const [yStr, mStr] = monthKey.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return { dateFrom: `${monthKey}-01`, dateTo: `${monthKey}-01` };
  }
  const dateFrom = `${yStr}-${mStr}-01`;
  // День 0 следующего месяца = последний день текущего (UTC)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dateTo = `${yStr}-${mStr}-${String(lastDay).padStart(2, "0")}`;
  return { dateFrom, dateTo };
}

export function periodIdForDivisionMonth(divisionId: string, monthKey: string): string {
  return `tsp-${divisionId}-${monthKey.replace("-", "")}`;
}

export interface MonthOption {
  monthKey: string;
  label: string;
}

/** Уникальные месяцы из существующих периодов, по возрастанию. */
export function listMonthOptions(periods: TimesheetPeriod[]): MonthOption[] {
  const byKey = new Map<string, string>();
  for (const p of periods) {
    const key = monthKeyFromPeriod(p);
    if (!byKey.has(key)) byKey.set(key, p.periodLabel || formatMonthLabel(key));
  }
  return Array.from(byKey.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, label]) => ({ monthKey, label }));
}

export interface WeekOption {
  weekStart: string;
  weekEnd: string;
  label: string;
}

/** Понедельник календарной недели (ISO: пн = 1 … вс = 0→7). */
export function mondayOfWeek(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay(); // 0=вс … 6=сб
  const offset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function sundayOfWeek(weekStart: string): string {
  return shiftDate(weekStart, 6);
}

/** Подпись недели: «03.08–09.08.2026». */
export function weekRangeLabel(weekStart: string): string {
  const weekEnd = sundayOfWeek(weekStart);
  return `${formatDate(weekStart).slice(0, 5)}–${formatDate(weekEnd)}`;
}

/**
 * Недели пн–вс, пересекающиеся с месяцем периода.
 * Label: «03.08–09.08.2026».
 */
export function weeksOverlappingMonth(dateFrom: string, dateTo: string): WeekOption[] {
  const weeks: WeekOption[] = [];
  let cursor = mondayOfWeek(dateFrom);
  const lastMonday = mondayOfWeek(dateTo);

  while (cursor <= lastMonday) {
    const weekEnd = sundayOfWeek(cursor);
    const overlapStart = cursor < dateFrom ? dateFrom : cursor;
    const overlapEnd = weekEnd > dateTo ? dateTo : weekEnd;
    if (overlapStart <= overlapEnd) {
      weeks.push({
        weekStart: cursor,
        weekEnd,
        label: `${formatDate(overlapStart).slice(0, 5)}–${formatDate(overlapEnd)}`,
      });
    }
    cursor = shiftDate(cursor, 7);
  }
  return weeks;
}

/** Диапазон дат для отображения: месяц целиком или пересечение недели с периодом. */
export function viewDateRange(
  period: TimesheetPeriod,
  granularity: PeriodGranularity,
  weekStart: string,
): { from: string; to: string } {
  if (granularity === "month") {
    return { from: period.dateFrom, to: period.dateTo };
  }
  const weekEnd = sundayOfWeek(weekStart);
  const from = weekStart < period.dateFrom ? period.dateFrom : weekStart;
  const to = weekEnd > period.dateTo ? period.dateTo : weekEnd;
  return { from, to };
}

export function viewDates(
  period: TimesheetPeriod,
  granularity: PeriodGranularity,
  weekStart: string,
): string[] {
  const { from, to } = viewDateRange(period, granularity, weekStart);
  if (from > to) return [];
  return enumerateDates(from, to);
}

export function defaultPeriodView(): PeriodViewState {
  const { dateFrom, dateTo } = monthBounds(DEFAULT_MONTH_KEY);
  const weeks = weeksOverlappingMonth(dateFrom, dateTo);
  return {
    granularity: "month",
    monthKey: DEFAULT_MONTH_KEY,
    weekStart: weeks[0]?.weekStart ?? mondayOfWeek(dateFrom),
  };
}

/** Первая неделя месяца (или ближайшая пересекающаяся). */
export function firstWeekStartForMonth(monthKey: string, periods: TimesheetPeriod[]): string {
  const sample = periods.find((p) => monthKeyFromPeriod(p) === monthKey);
  if (sample) {
    return weeksOverlappingMonth(sample.dateFrom, sample.dateTo)[0]?.weekStart ?? sample.dateFrom;
  }
  const { dateFrom, dateTo } = monthBounds(monthKey);
  return weeksOverlappingMonth(dateFrom, dateTo)[0]?.weekStart ?? mondayOfWeek(dateFrom);
}

/** Есть ли у всех подразделений период на месяц. */
export function monthNeedsEnsure(periods: TimesheetPeriod[], divisionIds: string[], monthKey: string): boolean {
  for (const divisionId of divisionIds) {
    const has = periods.some(
      (p) => p.divisionId === divisionId && monthKeyFromPeriod(p) === monthKey,
    );
    if (!has) return true;
  }
  return false;
}
