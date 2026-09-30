import type { BonusPenalty } from "@/entities/bonusPenalty/model";
import type { PeriodCoefficient } from "@/entities/coefficient/model";
import { personById } from "@/entities/person/mock";
import { sopById } from "@/entities/sop/mock";
import type { SopFact } from "@/entities/sopFact/model";
import { tariffs } from "@/entities/tariff/mock";
import type { TimesheetLine } from "@/entities/timesheet/model";
import { formatMoney } from "@/shared/lib/utils";
import {
  animalTransfers,
  paySchemes,
  periodKpis,
  workShifts,
} from "@/entities/payScheme/mock";
import { findApplicableTariff } from "./applyTariff";
import { applyPayScheme, expectedCalfBarn1Demo } from "./applyPayScheme";
import { buildLineFromFact } from "./buildTimesheet";
import { applyCoefficients, calcPieceworkTotal } from "./calcCoefficients";
import { buildPayoutBreakdown } from "./calcFinalPayout";

/**
 * Демонстрационная самопроверка расчётных функций.
 * Выполняется при старте приложения (вывод в консоль) и отображается
 * на странице «Проверка расчёта» (/calc-check).
 */
export interface CalcCase {
  id: string;
  title: string;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  rule: string;
}

function makeFact(
  overrides: Partial<Omit<SopFact, "sopId" | "factDate" | "performerPersonIds">> & {
    sopId: string;
    factDate: string;
    performerPersonIds?: string[];
    performerPersonId?: string;
  },
): SopFact {
  const ids =
    overrides.performerPersonIds ??
    (overrides.performerPersonId ? [overrides.performerPersonId] : []);
  return {
    id: overrides.id ?? "fact-demo",
    sopId: overrides.sopId,
    sopVersion: overrides.sopVersion ?? sopById.get(overrides.sopId)?.version ?? "1.0",
    performerPersonIds: ids,
    objectLabel: overrides.objectLabel ?? "Телёнок №0000",
    factDate: overrides.factDate,
    factStatus: overrides.factStatus ?? "done",
    quantity: overrides.quantity ?? 1,
  };
}

function makeLine(amount: number | null, status: TimesheetLine["status"], id: string): TimesheetLine {
  return {
    id,
    entryId: "tse-demo",
    factId: `fact-${id}`,
    sopId: "sop-demo",
    sopName: "Демонстрационная операция",
    sopVersion: "1.0",
    factDate: "2026-08-10",
    quantity: 1,
    appliedRate: amount,
    appliedUnit: amount === null ? null : "operation",
    amount,
    status,
  };
}

export function getCalcCases(): CalcCase[] {
  const cases: CalcCase[] = [];

  // ── 1. Тариф действующей версии на дату внутри периода ──
  const t1 = findApplicableTariff(
    { sopId: "sop-1-2-2", divisionId: "div-calf", jobTitle: null, date: "2026-08-05" },
    tariffs,
  );
  cases.push({
    id: "tariff-current-version",
    title: "Действующая версия тарифа на дату факта",
    input: "СОП «Выпойка ЗЦМ», Телятник, 05.08.2026",
    expected: "420,00 ₽",
    actual: t1 ? formatMoney(t1.rate) : "тариф не найден",
    passed: t1?.rate === 420,
    rule: "Берётся версия, чьё окно действия накрывает дату факта",
  });

  // ── 2. Тариф прошлой версии на дату до её закрытия ──
  const t2 = findApplicableTariff(
    { sopId: "sop-1-2-2", divisionId: "div-calf", jobTitle: null, date: "2026-07-20" },
    tariffs,
  );
  cases.push({
    id: "tariff-archived-version",
    title: "Архивная версия применяется к дате внутри своего окна",
    input: "СОП «Выпойка ЗЦМ», Телятник, 20.07.2026",
    expected: "80,00 ₽",
    actual: t2 ? formatMoney(t2.rate) : "тариф не найден",
    passed: t2?.rate === 80,
    rule: "Архив не обнуляет историю: операции июля сохраняют старую ставку",
  });

  // ── 3. Черновик тарифа не применяется ──
  const t3 = findApplicableTariff(
    { sopId: "sop-1-2-2", divisionId: "div-calf", jobTitle: null, date: "2026-09-05" },
    tariffs,
  );
  cases.push({
    id: "tariff-draft-ignored",
    title: "Черновик тарифа не даёт суммы до утверждения",
    input: "СОП «Выпойка ЗЦМ», Телятник, 05.09.2026 (есть черновик 450 ₽)",
    expected: "тариф не найден",
    actual: t3 ? formatMoney(t3.rate) : "тариф не найден",
    passed: t3 === null,
    rule: "Двухшаговое согласование: пока управляющий не утвердил — ставки нет",
  });

  // ── 4. Приоритет должностного тарифа над общим ──
  const t4general = findApplicableTariff(
    {
      sopId: "sop-1-3-1",
      divisionId: "div-maternity",
      jobTitle: "Оператор родильного отделения",
      date: "2026-08-10",
    },
    tariffs,
  );
  const t4vet = findApplicableTariff(
    {
      sopId: "sop-1-3-1",
      divisionId: "div-maternity",
      jobTitle: "Ветеринарный фельдшер",
      date: "2026-08-10",
    },
    tariffs,
  );
  cases.push({
    id: "tariff-job-title-priority",
    title: "Тариф по должности важнее общего тарифа подразделения",
    input: "СОП «Ежедневный клинический осмотр»: оператор и ветфельдшер (родильное)",
    expected: "оператор 60,00 ₽ / ветфельдшер 75,00 ₽",
    actual: `оператор ${t4general ? formatMoney(t4general.rate) : "—"} / ветфельдшер ${
      t4vet ? formatMoney(t4vet.rate) : "—"
    }`,
    passed: t4general?.rate === 60 && t4vet?.rate === 75,
    rule: "Совпадение по должности приоритетнее общего тарифа",
  });

  // ── 5. Операция без тарифа: сумма null, а не 0 ──
  const petrova = personById.get("per-petrova")!;
  const weighingSop = sopById.get("sop-1-3-3")!;
  const line5 = buildLineFromFact({
    fact: makeFact({ sopId: "sop-1-3-3", performerPersonId: petrova.id, factDate: "2026-08-12" }),
    sop: weighingSop,
    performer: petrova,
    tariffs,
    entryId: "tse-demo",
  });
  cases.push({
    id: "line-tariff-missing",
    title: "Операция без тарифа фиксируется, но не оплачивается",
    input: "СОП «Контрольное взвешивание телёнка», тариф не установлен",
    expected: "статус «Тариф не задан», сумма null",
    actual: line5
      ? `статус «${line5.status === "tariff_missing" ? "Тариф не задан" : line5.status}», сумма ${
          line5.amount === null ? "null" : formatMoney(line5.amount)
        }`
      : "позиция не создана",
    passed: line5?.status === "tariff_missing" && line5.amount === null,
    rule: "null = «решение не принято», 0 означал бы «операция бесплатна»",
  });

  // ── 6. Частично выполненный факт не создаёт табельную позицию ──
  const line6 = buildLineFromFact({
    fact: makeFact({
      sopId: "sop-1-1-1",
      performerPersonId: petrova.id,
      factDate: "2026-08-12",
      factStatus: "partially_done",
    }),
    sop: sopById.get("sop-1-1-1")!,
    performer: petrova,
    tariffs,
    entryId: "tse-demo",
  });
  cases.push({
    id: "fact-partially-done",
    title: "«Частично выполнено» не порождает табельную позицию",
    input: "Факт СОП «Приём новорождённого телёнка», статус «Частично выполнено»",
    expected: "позиция не создана",
    actual: line6 === null ? "позиция не создана" : "позиция создана",
    passed: line6 === null,
    rule: "Оплачиваются только «Выполнено» и «Выполнено с отклонениями»",
  });

  // ── 7. Количество × ставка (единица из тарифа) ──
  const line7 = buildLineFromFact({
    fact: makeFact({
      sopId: "sop-1-1-1",
      performerPersonId: petrova.id,
      factDate: "2026-08-12",
      quantity: 12,
    }),
    sop: sopById.get("sop-1-1-1")!,
    performer: petrova,
    tariffs,
    entryId: "tse-demo",
  });
  cases.push({
    id: "quantity-times-rate",
    title: "Сумма = количество × ставка тарифа",
    input: "Приём новорождённого, 12 ед. × 180 ₽ (единица тарифа — операция)",
    expected: "количество 12, сумма 2 160,00 ₽",
    actual: line7 ? `количество ${line7.quantity}, сумма ${formatMoney(line7.amount)}` : "позиция не создана",
    passed: line7?.quantity === 12 && line7.amount === 2160 && line7.appliedUnit === "operation",
    rule: "Единица измерения задаётся в тарифе; количество факта умножает ставку",
  });

  // ── 7b. Два исполнителя — каждому полная ставка ──
  const sidorov = personById.get("per-sidorov")!;
  const ivanov = personById.get("per-ivanov")!;
  const jointFact = makeFact({
    id: "fact-joint-demo",
    sopId: "sop-2-1-1",
    performerPersonIds: [ivanov.id, sidorov.id],
    factDate: "2026-08-10",
    objectLabel: "Домик Д-14",
    quantity: 1,
  });
  const jointSop = sopById.get("sop-2-1-1")!;
  const lineIvanov = buildLineFromFact({
    fact: jointFact,
    sop: jointSop,
    performer: ivanov,
    tariffs,
    entryId: "tse-ivanov",
  });
  const lineSidorov = buildLineFromFact({
    fact: jointFact,
    sop: jointSop,
    performer: sidorov,
    tariffs,
    entryId: "tse-sidorov",
  });
  cases.push({
    id: "joint-performers-full-rate",
    title: "Совместная работа: каждому полная ставка",
    input: "Уборка домика, Иванов + Сидоров, ставка 700 ₽ / секция",
    expected: "2 позиции, каждая 700,00 ₽, разные id",
    actual:
      lineIvanov && lineSidorov
        ? `${formatMoney(lineIvanov.amount)} + ${formatMoney(lineSidorov.amount)}, id ${
            lineIvanov.id === lineSidorov.id ? "совпали" : "разные"
          }`
        : "позиции не созданы",
    passed:
      lineIvanov?.amount === 700 &&
      lineSidorov?.amount === 700 &&
      lineIvanov.id !== lineSidorov.id &&
      lineIvanov.id.includes(ivanov.id) &&
      lineSidorov.id.includes(sidorov.id),
    rule: "Один факт — две позиции; сумма не делится пополам",
  });

  // ── 8. Отклонённая позиция выпадает из суммы по сделке ──
  const totals8 = calcPieceworkTotal([
    makeLine(180, "confirmed", "l1"),
    makeLine(140, "confirmed", "l2"),
    makeLine(95, "rejected", "l3"),
    makeLine(null, "tariff_missing", "l4"),
  ]);
  cases.push({
    id: "piecework-total",
    title: "Сумма по сделке: без отклонённых и без позиций без тарифа",
    input: "180 ₽ + 140 ₽ + отклонённая 95 ₽ + позиция без тарифа",
    expected: "320,00 ₽, без тарифа 1, отклонено 1",
    actual: `${formatMoney(totals8.pieceworkTotal)}, без тарифа ${totals8.missingTariffCount}, отклонено ${
      totals8.rejectedCount
    }`,
    passed:
      totals8.pieceworkTotal === 320 &&
      totals8.missingTariffCount === 1 &&
      totals8.rejectedCount === 1,
    rule: "Позиция без тарифа не добавляет 0 в сумму — она попадает в отдельный счётчик",
  });

  // ── 9. Незаданный коэффициент = множитель 1.0 ──
  const after9 = applyCoefficients(10_000, null, null);
  cases.push({
    id: "coefficient-default",
    title: "Незаданный коэффициент — множитель 1,00",
    input: "Сделка 10 000 ₽, коэффициенты не заданы",
    expected: "10 000,00 ₽",
    actual: formatMoney(after9),
    passed: after9 === 10_000,
    rule: "Отсутствие коэффициента не должно обнулять или менять сумму",
  });

  // ── 10. Полная расчётная лента по формуле из ТЗ ──
  const divisionCoef: PeriodCoefficient = {
    id: "coef-demo-div",
    scope: "division",
    targetId: "div-calf",
    periodId: "tsp-demo",
    value: 1.1,
    reason: "Демонстрационный коэффициент подразделения",
    setByPersonId: "per-kuznecov",
    status: "active",
  };
  const personCoef: PeriodCoefficient = {
    ...divisionCoef,
    id: "coef-demo-per",
    scope: "person",
    targetId: "per-petrova",
    value: 1.05,
    reason: "Демонстрационный коэффициент сотрудника",
  };
  const accruals: BonusPenalty[] = [
    {
      id: "bp-demo-1",
      personId: "per-petrova",
      entryId: "tse-demo",
      type: "bonus",
      amount: 5000,
      reason: "Демонстрационная премия",
      linkedDeviationId: null,
      appliedByPersonId: "per-kuznecov",
      decidedAt: "2026-08-20",
      status: "accrued",
    },
    {
      id: "bp-demo-2",
      personId: "per-petrova",
      entryId: "tse-demo",
      type: "penalty",
      amount: 2000,
      reason: "Демонстрационный штраф",
      linkedDeviationId: null,
      appliedByPersonId: "per-kuznecov",
      decidedAt: "2026-08-20",
      status: "accrued",
    },
  ];
  const breakdown = buildPayoutBreakdown({
    personId: "per-petrova",
    entryId: "tse-demo",
    lines: [
      makeLine(30_000, "confirmed", "d1"),
      makeLine(30_000, "confirmed", "d2"),
      makeLine(24_500, "confirmed", "d3"),
    ],
    divisionCoefficient: divisionCoef,
    personCoefficient: personCoef,
    accruals,
  });
  cases.push({
    id: "final-payout",
    title: "Итого к выплате по полной формуле",
    input: "84 500 ₽ сделка × 1,10 × 1,05 + 5 000 ₽ премия − 2 000 ₽ штраф",
    expected: "100 597,50 ₽",
    actual: formatMoney(breakdown.finalPayout),
    passed: breakdown.finalPayout === 100_597.5,
    rule: "84 500 × 1,10 = 92 950; × 1,05 = 97 597,50; + 5 000 − 2 000 = 100 597,50",
  });

  // ── 11. Отменённое начисление в итог не входит ──
  const breakdown11 = buildPayoutBreakdown({
    personId: "per-petrova",
    entryId: "tse-demo",
    lines: [makeLine(1000, "confirmed", "e1")],
    divisionCoefficient: null,
    personCoefficient: null,
    accruals: [
      { ...accruals[0], id: "bp-demo-3", amount: 700, status: "cancelled" },
      { ...accruals[1], id: "bp-demo-4", amount: 300, status: "disputed" },
    ],
  });
  cases.push({
    id: "cancelled-accrual",
    title: "Отменённая премия не считается, оспоренный штраф — считается",
    input: "Сделка 1 000 ₽, премия 700 ₽ (отменена), штраф 300 ₽ (оспорен)",
    expected: "700,00 ₽",
    actual: formatMoney(breakdown11.finalPayout),
    passed: breakdown11.finalPayout === 700,
    rule: "Оспаривание не приостанавливает начисление — его снимает только отмена",
  });

  // ── 12. Схема положения: телятник №1 ──
  const demo = expectedCalfBarn1Demo();
  const schemeResult = applyPayScheme({
    schemes: paySchemes,
    inputs: {
      animalTransfers,
      weightGains: [],
      workShifts: [],
      inseminations: [],
      periodKpis,
    },
    personId: "per-petrova",
    divisionId: "div-calf",
    jobTitle: "Оператор по уходу за телятами",
    periodId: "tsp-calf-2026-08",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-31",
  });
  cases.push({
    id: "pay-scheme-calf-1",
    title: "Схема телятника №1: бычки + тёлки + премиальный фонд",
    input: "2 бычка, тёлки 96/112/90 кг, сохранность 100%, аудит 5",
    expected: formatMoney(demo.total),
    actual: formatMoney(schemeResult.total),
    passed: schemeResult.total === demo.total,
    rule: `бычки ${demo.bulls} + тёлки ${demo.heifers} + премия ${demo.bonus} = ${demo.total}`,
  });

  // ── 13. Мойка вёдер: смена + бонус чистоты ──
  const washResult = applyPayScheme({
    schemes: paySchemes,
    inputs: {
      animalTransfers: [],
      weightGains: [],
      workShifts,
      inseminations: [],
      periodKpis: [],
    },
    personId: "per-ivanov",
    divisionId: "div-calf",
    jobTitle: "Оператор мойки инвентаря",
    periodId: "tsp-calf-2026-08",
    dateFrom: "2026-08-01",
    dateTo: "2026-08-31",
  });
  cases.push({
    id: "pay-scheme-bucket-wash",
    title: "Мойка вёдер: смена 1 200 ₽ + чистота 200 ₽",
    input: "1 смена, бак. обсеменённость < 1",
    expected: "1 400,00 ₽",
    actual: formatMoney(washResult.total),
    passed: washResult.total === 1400,
    rule: "1200 (смена) + 200 (чек-лист) = 1400",
  });

  return cases;
}

let hasLogged = false;

/** Печатает результаты самопроверки в консоль ровно один раз за загрузку страницы. */
export function runCalcSelfCheck(): CalcCase[] {
  const cases = getCalcCases();
  if (hasLogged) return cases;
  hasLogged = true;

  const failed = cases.filter((c) => !c.passed);
  /* eslint-disable no-console */
  console.groupCollapsed(
    `М-Комплекс · проверка расчётных функций: ${cases.length - failed.length}/${cases.length} ОК`,
  );
  console.table(
    cases.map((c) => ({
      Проверка: c.title,
      Ожидание: c.expected,
      Факт: c.actual,
      Результат: c.passed ? "OK" : "ОШИБКА",
    })),
  );
  if (failed.length > 0) {
    console.warn("Не сошлись:", failed);
  }
  console.groupEnd();
  /* eslint-enable no-console */

  return cases;
}
