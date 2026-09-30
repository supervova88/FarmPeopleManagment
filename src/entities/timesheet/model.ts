import type { TariffRateUnit } from "@/entities/tariff/model";

/**
 * Табель: период → запись по сотруднику → табельные позиции.
 * Расчётные суммы здесь НЕ хранятся — они вычисляются чистыми функциями
 * в src/features/payroll.
 */
export type TimesheetPeriodStatus = "open" | "in_review" | "approved" | "closed";

export interface TimesheetPeriod {
  id: string;
  divisionId: string;
  /** Например «Сентябрь 2026» */
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  status: TimesheetPeriodStatus;
  checkedByPersonId: string | null;
  approvedByPersonId: string | null;
}

export type TimesheetEntryStatus = "draft" | "confirmed" | "approved";

export interface TimesheetEntry {
  id: string;
  periodId: string;
  personId: string;
  status: TimesheetEntryStatus;
  /** Ссылка на PeriodCoefficient со scope === "division" */
  divisionCoefficientId: string | null;
  /** Ссылка на PeriodCoefficient со scope === "person" */
  personCoefficientId: string | null;
}

export type TimesheetLineStatus =
  | "auto_generated"
  | "confirmed"
  | "rejected"
  | "manually_adjusted"
  | "tariff_missing";

export interface TimesheetLine {
  id: string;
  entryId: string;
  /**
   * Ссылка на производственный факт ОБЯЗАТЕЛЬНА: позиция — результат автогенерации.
   * null допустим только для явной ручной корректировки с заполненным комментарием.
   */
  factId: string | null;
  // Денормализовано на момент создания позиции — история не должна «поплыть»
  // при последующем изменении карточки СОП.
  sopId: string;
  sopName: string;
  sopVersion: string;
  factDate: string;
  /** Количество из факта в единицах тарифа */
  quantity: number;
  /** Ставка, найденная на дату факта; null = тариф не задан */
  appliedRate: number | null;
  /** Единица ставки с применённого тарифа; null = тариф не задан */
  appliedUnit: TariffRateUnit | null;
  /** quantity * appliedRate; null (а не 0), если тариф не задан */
  amount: number | null;
  status: TimesheetLineStatus;
  /** Обязателен при статусах manually_adjusted и rejected */
  adjustmentComment?: string;
}

export const TIMESHEET_PERIOD_STATUS_LABEL: Record<TimesheetPeriodStatus, string> = {
  open: "Открыт",
  in_review: "На проверке",
  approved: "Утверждён",
  closed: "Закрыт",
};

export const TIMESHEET_ENTRY_STATUS_LABEL: Record<TimesheetEntryStatus, string> = {
  draft: "Черновик",
  confirmed: "Подтверждено",
  approved: "Утверждено",
};

export const TIMESHEET_LINE_STATUS_LABEL: Record<TimesheetLineStatus, string> = {
  auto_generated: "Сформировано автоматически",
  confirmed: "Подтверждено",
  rejected: "Отклонено",
  manually_adjusted: "Скорректировано вручную",
  tariff_missing: "Тариф не задан",
};

/** Позиции в этих статусах ещё ждут решения бригадира. */
export function isLinePendingDecision(line: TimesheetLine): boolean {
  return line.status === "auto_generated";
}

/** Отклонённая позиция в сумму по сделке не попадает. */
export function isLineCountedInPayout(line: TimesheetLine): boolean {
  return line.status !== "rejected";
}
