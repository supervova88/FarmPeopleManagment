import type { PeriodCoefficient } from "@/entities/coefficient/model";
import { isLineCountedInPayout, type TimesheetLine } from "@/entities/timesheet/model";
import { roundKopecks } from "./rounding";

export interface PieceworkTotals {
  /** Сумма по сделке: сложены только позиции с ненулевой суммой */
  pieceworkTotal: number;
  /** Всего позиций в записи */
  operationsCount: number;
  /** Позиции, учтённые в расчёте (все, кроме отклонённых) */
  countedOperationsCount: number;
  /** Позиции с рассчитанной суммой */
  paidOperationsCount: number;
  /** Позиции со статусом «Тариф не задан» — управленческий сигнал */
  missingTariffCount: number;
  /** Отклонённые позиции */
  rejectedCount: number;
  /** Позиции, по которым бригадир ещё не принял решение */
  pendingCount: number;
}

/**
 * Сумма по сделке = сумма всех табельных позиций, где сумма не null.
 * Отклонённые позиции не учитываются вовсе.
 * Позиции без тарифа не добавляют 0 — они попадают в отдельный счётчик.
 */
export function calcPieceworkTotal(lines: TimesheetLine[]): PieceworkTotals {
  let pieceworkTotal = 0;
  let countedOperationsCount = 0;
  let paidOperationsCount = 0;
  let missingTariffCount = 0;
  let rejectedCount = 0;
  let pendingCount = 0;

  for (const line of lines) {
    if (!isLineCountedInPayout(line)) {
      rejectedCount += 1;
      continue;
    }
    countedOperationsCount += 1;
    if (line.status === "tariff_missing") missingTariffCount += 1;
    if (line.status === "auto_generated") pendingCount += 1;
    if (line.amount !== null) {
      pieceworkTotal += line.amount;
      paidOperationsCount += 1;
    }
  }

  return {
    pieceworkTotal: roundKopecks(pieceworkTotal),
    operationsCount: lines.length,
    countedOperationsCount,
    paidOperationsCount,
    missingTariffCount,
    rejectedCount,
    pendingCount,
  };
}

/** Значение коэффициента; если коэффициент не задан или архивный — множитель 1.0. */
export function coefficientValue(coefficient: PeriodCoefficient | null | undefined): number {
  if (!coefficient) return 1;
  if (coefficient.status !== "active") return 1;
  return coefficient.value;
}

/**
 * Сумма после коэффициентов.
 * Коэффициент применяется целиком на весь расчётный период, а не на отдельную операцию.
 */
export function applyCoefficients(
  pieceworkTotal: number,
  divisionCoefficient: PeriodCoefficient | null | undefined,
  personCoefficient: PeriodCoefficient | null | undefined,
): number {
  const divisionValue = coefficientValue(divisionCoefficient);
  const personValue = coefficientValue(personCoefficient);
  return roundKopecks(pieceworkTotal * divisionValue * personValue);
}
