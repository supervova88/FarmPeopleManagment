import { isAccrualCounted, type BonusPenalty } from "@/entities/bonusPenalty/model";
import type { PeriodCoefficient } from "@/entities/coefficient/model";
import type { TimesheetLine } from "@/entities/timesheet/model";
import { formatCoefficient, formatMoney } from "@/shared/lib/utils";
import type { SchemeLine } from "./applyPayScheme";
import { applyCoefficients, calcPieceworkTotal, coefficientValue, type PieceworkTotals } from "./calcCoefficients";
import { roundKopecks } from "./rounding";

/** Сумма начислений одного типа. Отменённые не учитываются, оспоренные — учитываются. */
export function sumAccruals(items: BonusPenalty[], type: BonusPenalty["type"]): number {
  return roundKopecks(
    items
      .filter((i) => i.type === type && isAccrualCounted(i))
      .reduce((acc, i) => acc + i.amount, 0),
  );
}

/** Итого к выплате = сумма после коэффициентов + премии − штрафы. */
export function calcFinalPayout(
  afterCoefficients: number,
  bonusTotal: number,
  penaltyTotal: number,
): number {
  return roundKopecks(afterCoefficients + bonusTotal - penaltyTotal);
}

export interface PayoutBreakdownInput {
  personId: string;
  entryId: string;
  lines: TimesheetLine[];
  divisionCoefficient: PeriodCoefficient | null;
  personCoefficient: PeriodCoefficient | null;
  accruals: BonusPenalty[];
  /** Строки схем положения (результат, смена, KPI) */
  schemeLines?: SchemeLine[];
  /** Текстовая сводка схем */
  schemeFormula?: string;
}

export interface PayoutBreakdown extends PieceworkTotals {
  personId: string;
  entryId: string;
  lines: TimesheetLine[];
  schemeLines: SchemeLine[];
  schemeTotal: number;
  schemeFormula: string;
  /** Сделка только по позициям СОП */
  sopPieceworkTotal: number;
  divisionCoefficient: PeriodCoefficient | null;
  personCoefficient: PeriodCoefficient | null;
  divisionCoefficientValue: number;
  personCoefficientValue: number;
  afterCoefficients: number;
  bonuses: BonusPenalty[];
  penalties: BonusPenalty[];
  bonusTotal: number;
  penaltyTotal: number;
  finalPayout: number;
  /** Человекочитаемая формула для показа прямо на экране */
  formula: string;
}

/**
 * Полная «расчётная лента» по одному физлицу за период.
 * Сделка = позиции СОП + начисления по схемам положения.
 */
export function buildPayoutBreakdown(input: PayoutBreakdownInput): PayoutBreakdown {
  const sopTotals = calcPieceworkTotal(input.lines);
  const schemeLines = input.schemeLines ?? [];
  const schemeTotal = roundKopecks(
    schemeLines.reduce((acc, l) => acc + (l.amount ?? 0), 0),
  );
  const pieceworkTotal = roundKopecks(sopTotals.pieceworkTotal + schemeTotal);

  const divisionCoefficientValue = coefficientValue(input.divisionCoefficient);
  const personCoefficientValue = coefficientValue(input.personCoefficient);
  const afterCoefficients = applyCoefficients(
    pieceworkTotal,
    input.divisionCoefficient,
    input.personCoefficient,
  );

  const bonuses = input.accruals.filter((a) => a.type === "bonus" && isAccrualCounted(a));
  const penalties = input.accruals.filter((a) => a.type === "penalty" && isAccrualCounted(a));
  const bonusTotal = sumAccruals(input.accruals, "bonus");
  const penaltyTotal = sumAccruals(input.accruals, "penalty");

  const finalPayout = calcFinalPayout(afterCoefficients, bonusTotal, penaltyTotal);
  const schemeFormula = input.schemeFormula ?? "";

  return {
    ...sopTotals,
    pieceworkTotal,
    paidOperationsCount: sopTotals.paidOperationsCount + schemeLines.filter((l) => l.amount !== null && l.amount > 0).length,
    personId: input.personId,
    entryId: input.entryId,
    lines: input.lines,
    schemeLines,
    schemeTotal,
    schemeFormula,
    sopPieceworkTotal: sopTotals.pieceworkTotal,
    divisionCoefficient: input.divisionCoefficient,
    personCoefficient: input.personCoefficient,
    divisionCoefficientValue,
    personCoefficientValue,
    afterCoefficients,
    bonuses,
    penalties,
    bonusTotal,
    penaltyTotal,
    finalPayout,
    formula: buildFormulaText({
      pieceworkTotal,
      sopPieceworkTotal: sopTotals.pieceworkTotal,
      schemeTotal,
      divisionCoefficientValue,
      personCoefficientValue,
      bonusTotal,
      penaltyTotal,
      finalPayout,
    }),
  };
}

interface FormulaInput {
  pieceworkTotal: number;
  sopPieceworkTotal: number;
  schemeTotal: number;
  divisionCoefficientValue: number;
  personCoefficientValue: number;
  bonusTotal: number;
  penaltyTotal: number;
  finalPayout: number;
}

/**
 * Строка вида:
 * «84 500,00 ₽ (сделка) × 1,10 … = …»
 * При наличии схем: «СОП + положение».
 */
export function buildFormulaText(input: FormulaInput): string {
  let dealLabel: string;
  if (input.schemeTotal > 0) {
    dealLabel = `${formatMoney(input.pieceworkTotal)} (сделка: СОП ${formatMoney(input.sopPieceworkTotal)} + положение ${formatMoney(input.schemeTotal)})`;
  } else {
    dealLabel = `${formatMoney(input.pieceworkTotal)} (сделка)`;
  }
  const parts: string[] = [dealLabel];

  if (input.divisionCoefficientValue !== 1) {
    parts.push(`× ${formatCoefficient(input.divisionCoefficientValue)} (коэффициент подразделения)`);
  }
  if (input.personCoefficientValue !== 1) {
    parts.push(`× ${formatCoefficient(input.personCoefficientValue)} (коэффициент сотрудника)`);
  }
  if (input.bonusTotal > 0) {
    parts.push(`+ ${formatMoney(input.bonusTotal)} (премии)`);
  }
  if (input.penaltyTotal > 0) {
    parts.push(`− ${formatMoney(input.penaltyTotal)} (штрафы)`);
  }

  return `${parts.join(" ")} = ${formatMoney(input.finalPayout)}`;
}
