import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SYSTEM_NAME = "М-Комплекс";
export const MODULE_NAME = "СОП, тарификация и сдельный расчёт труда";

/** Демо-«сегодня» — последний день расчётного периода «Август 2026». */
export const DEMO_TODAY = "2026-08-31";

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Денежное форматирование: разряды неразрывным пробелом, две копейки, знак ₽.
 * null означает «решение о тарифе ещё не принято» и НИКОГДА не показывается как 0.
 */
export function formatMoney(value: number | null | undefined, options?: { withCurrency?: boolean }): string {
  if (value === null || value === undefined) return "—";
  const withCurrency = options?.withCurrency ?? true;
  const formatted = value.toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withCurrency ? `${formatted} ₽` : formatted;
}

/** Компактная сумма без копеек — для крупных сводных плашек. */
export function formatMoneyShort(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString("ru-RU");
}

/** Коэффициент в русской записи: 1.1 → «1,10». */
export function formatCoefficient(value: number | null | undefined): string {
  if (value === null || value === undefined) return "1,00";
  return value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Отклонение коэффициента от единицы: 1.1 → «+10 %». */
export function formatCoefficientDelta(value: number): string {
  const percent = Math.round((value - 1) * 1000) / 10;
  if (percent === 0) return "без изменения";
  const sign = percent > 0 ? "+" : "−";
  return `${sign}${Math.abs(percent).toLocaleString("ru-RU")} %`;
}

const MONTHS_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "май",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

/** ISO yyyy-mm-dd → «08.09.2026». Работает без Date, чтобы не ловить часовые пояса. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

/** ISO yyyy-mm-dd → «8 сен 2026». */
export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${Number(d)} ${MONTHS_SHORT[Number(m) - 1]} ${y}`;
}

/** Дата на день раньше указанной — для автозакрытия предыдущей версии тарифа. */
export function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function previousDay(iso: string): string {
  return shiftDate(iso, -1);
}

/** Все даты включительно от from до to (ISO yyyy-mm-dd), без часовых поясов. */
export function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  let current = from;
  while (current <= to) {
    dates.push(current);
    current = shiftDate(current, 1);
  }
  return dates;
}

/** «2026-09-12» → «12». */
export function formatDayOfMonth(iso: string): string {
  const d = iso.split("-")[2];
  return d ? String(Number(d)) : iso;
}

/** Сравнение ISO-дат допустимо лексикографически, формат фиксированный. */
export function isDateWithin(date: string, from: string, to: string | null): boolean {
  if (date < from) return false;
  if (to !== null && date > to) return false;
  return true;
}

export function declension(count: number, forms: [string, string, string]): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}
