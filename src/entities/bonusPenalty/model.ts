/**
 * НачислениеПремияШтраф — фиксированная сумма, не процент.
 * По принятому решению верхних границ и дополнительного согласования нет.
 */
export type BonusPenaltyType = "bonus" | "penalty";

export type BonusPenaltyStatus = "accrued" | "disputed" | "cancelled";

export interface BonusPenalty {
  id: string;
  personId: string;
  /** Ссылка на TimesheetEntry — начисление привязано к периоду сотрудника */
  entryId: string;
  type: BonusPenaltyType;
  /** Фиксированная величина в рублях. Лимитов нет. */
  amount: number;
  /** Основание — ОБЯЗАТЕЛЬНОЕ поле, заполняется руководителем вручную */
  reason: string;
  /** Опциональная ссылка на производственное отклонение или задачу */
  linkedDeviationId: string | null;
  appliedByPersonId: string;
  decidedAt: string;
  status: BonusPenaltyStatus;
}

export const BONUS_PENALTY_TYPE_LABEL: Record<BonusPenaltyType, string> = {
  bonus: "Премия",
  penalty: "Штраф",
};

export const BONUS_PENALTY_STATUS_LABEL: Record<BonusPenaltyStatus, string> = {
  accrued: "Начислено",
  disputed: "Оспорено",
  cancelled: "Отменено",
};

/** Отменённые начисления в итог не входят. */
export function isAccrualCounted(item: BonusPenalty): boolean {
  return item.status !== "cancelled";
}

/** Демо-справочник производственных отклонений/задач для опциональной ссылки. */
export interface DeviationRef {
  id: string;
  label: string;
}
