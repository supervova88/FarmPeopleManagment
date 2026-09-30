import type { Person } from "@/entities/person/model";
import type { Sop } from "@/entities/sop/model";
import { isPayableFact, type SopFact } from "@/entities/sopFact/model";
import type { SopTariff } from "@/entities/tariff/model";
import type { TimesheetLine } from "@/entities/timesheet/model";
import { findApplicableTariff } from "./applyTariff";
import { roundKopecks } from "./rounding";

export interface BuildLineInput {
  fact: SopFact;
  sop: Sop;
  performer: Person;
  tariffs: SopTariff[];
  entryId: string;
}

/**
 * Автогенерация табельной позиции из производственного факта для одного исполнителя.
 *
 * Возвращает null, если факт не порождает оплачиваемую позицию:
 * статусы «Частично выполнено» и «Не выполнено» табельную позицию НЕ создают.
 *
 * Сумма = quantity × ставка тарифа этого исполнителя (без деления при совместной работе).
 */
export function buildLineFromFact(input: BuildLineInput): TimesheetLine | null {
  const { fact, sop, performer, tariffs, entryId } = input;

  if (!isPayableFact(fact)) return null;

  const tariff = findApplicableTariff(
    {
      sopId: fact.sopId,
      divisionId: performer.divisionId,
      jobTitle: performer.jobTitle,
      date: fact.factDate,
    },
    tariffs,
  );

  const appliedRate = tariff ? tariff.rate : null;
  const appliedUnit = tariff ? tariff.rateUnit : null;

  return {
    id: `tsl-${fact.id}-${performer.id}`,
    entryId,
    factId: fact.id,
    sopId: sop.id,
    sopName: sop.name,
    sopVersion: fact.sopVersion,
    factDate: fact.factDate,
    quantity: fact.quantity,
    appliedRate,
    appliedUnit,
    // null, а не 0: тариф не задан означает «решение ещё не принято»
    amount: appliedRate === null ? null : roundKopecks(fact.quantity * appliedRate),
    status: appliedRate === null ? "tariff_missing" : "auto_generated",
  };
}

/**
 * Пересчёт существующей позиции после того, как тариф был задан или изменён задним числом.
 * Ручные корректировки и отклонения не трогаем — их сумму определил человек.
 */
export function recalcLineWithTariffs(
  line: TimesheetLine,
  performer: Person,
  tariffs: SopTariff[],
): TimesheetLine {
  if (line.status === "manually_adjusted" || line.status === "rejected") return line;

  const tariff = findApplicableTariff(
    {
      sopId: line.sopId,
      divisionId: performer.divisionId,
      jobTitle: performer.jobTitle,
      date: line.factDate,
    },
    tariffs,
  );

  if (!tariff) {
    return { ...line, appliedRate: null, appliedUnit: null, amount: null, status: "tariff_missing" };
  }

  const nextStatus = line.status === "confirmed" ? "confirmed" : "auto_generated";
  return {
    ...line,
    appliedRate: tariff.rate,
    appliedUnit: tariff.rateUnit,
    amount: roundKopecks(line.quantity * tariff.rate),
    status: nextStatus,
  };
}
