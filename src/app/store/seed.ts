import { bonusPenalties } from "@/entities/bonusPenalty/mock";
import type { BonusPenalty } from "@/entities/bonusPenalty/model";
import { periodCoefficients } from "@/entities/coefficient/mock";
import type { PeriodCoefficient } from "@/entities/coefficient/model";
import { divisions as seedDivisions } from "@/entities/division/mock";
import type { Division } from "@/entities/division/model";
import type {
  AnimalTransfer,
  InseminationResult,
  PeriodKpi,
  WeightGain,
  WorkShift,
} from "@/entities/payScheme/inputs";
import {
  animalTransfers,
  inseminations,
  paySchemes as seedPaySchemes,
  periodKpis,
  weightGains,
  workShifts,
} from "@/entities/payScheme/mock";
import type { PayScheme } from "@/entities/payScheme/model";
import { persons as seedPersons } from "@/entities/person/mock";
import type { Person } from "@/entities/person/model";
import { sopById, sops as seedSops } from "@/entities/sop/mock";
import type { Sop } from "@/entities/sop/model";
import { sopFacts } from "@/entities/sopFact/mock";
import { factPerformers, type SopFact } from "@/entities/sopFact/model";
import { tariffs } from "@/entities/tariff/mock";
import type { SopTariff } from "@/entities/tariff/model";
import { timesheetPeriods } from "@/entities/timesheet/mock";
import type {
  TimesheetEntry,
  TimesheetLine,
  TimesheetPeriod,
} from "@/entities/timesheet/model";
import {
  dayPlanTemplates,
  weekPlanAssignments,
  weekPlanTemplates,
  workPlanItems,
} from "@/entities/workPlan/mock";
import type {
  DayPlanTemplate,
  WeekPlanAssignment,
  WeekPlanTemplate,
  WorkPlanItem,
} from "@/entities/workPlan/model";
import { buildLineFromFact } from "@/features/payroll/buildTimesheet";

export interface AppData {
  /** Справочник сотрудников (редактирует администратор) */
  persons: Person[];
  /** Справочник подразделений (редактирует администратор) */
  divisions: Division[];
  /** Дерево СОП L1 → L2 → L3 (редактируется методологом / управляющим) */
  sops: Sop[];
  /** Производственные факты — источник автогенерации табельных позиций */
  facts: SopFact[];
  /** Календарный план работ (ожидаемые задачи; оплата только после исполнения) */
  planItems: WorkPlanItem[];
  /** Шаблоны рабочего дня (набор СОП) */
  dayPlanTemplates: DayPlanTemplate[];
  /** Шаблоны рабочей недели (раскладка дневных планов) */
  weekPlanTemplates: WeekPlanTemplate[];
  /** Назначения шаблона недели специалисту */
  weekPlanAssignments: WeekPlanAssignment[];
  tariffs: SopTariff[];
  /** Схемы оплаты по положению */
  paySchemes: PayScheme[];
  animalTransfers: AnimalTransfer[];
  weightGains: WeightGain[];
  workShifts: WorkShift[];
  inseminations: InseminationResult[];
  periodKpis: PeriodKpi[];
  periods: TimesheetPeriod[];
  entries: TimesheetEntry[];
  lines: TimesheetLine[];
  coefficients: PeriodCoefficient[];
  accruals: BonusPenalty[];
}

export function makeEntryId(periodId: string, personId: string): string {
  return `tse-${periodId}-${personId}`;
}

/**
 * Сборка исходного состояния демо.
 *
 * Табельные записи и позиции НЕ лежат в mock-файлах: они порождаются
 * из производственных фактов теми же функциями, что работают в рантайме.
 * Так демо-данные не могут разойтись с бизнес-правилами.
 */
export function buildInitialData(): AppData {
  const persons = seedPersons.map((p) => ({ ...p }));
  const divisions = seedDivisions.map((d) => ({ ...d }));
  const entries: TimesheetEntry[] = [];
  const lines: TimesheetLine[] = [];

  // Табельная запись заводится тем, у кого есть факты или план в периоде
  const performerIds = new Set([
    ...sopFacts.flatMap((f) => factPerformers(f)),
    ...workPlanItems.map((p) => p.personId),
  ]);

  for (const person of persons) {
    if (!performerIds.has(person.id)) continue;

    // Периоды, где у сотрудника есть факты или план
    const relevantPeriods = timesheetPeriods.filter((period) => {
      if (period.divisionId !== person.divisionId) return false;
      const hasFact = sopFacts.some(
        (f) =>
          factPerformers(f).includes(person.id) &&
          f.factDate >= period.dateFrom &&
          f.factDate <= period.dateTo,
      );
      const hasPlan = workPlanItems.some(
        (p) =>
          p.personId === person.id &&
          p.plannedDate >= period.dateFrom &&
          p.plannedDate <= period.dateTo,
      );
      return hasFact || hasPlan;
    });

    for (const period of relevantPeriods) {
      const entryId = makeEntryId(period.id, person.id);
      if (entries.some((e) => e.id === entryId)) continue;

      const divisionCoefficient = periodCoefficients.find(
        (c) => c.scope === "division" && c.targetId === person.divisionId && c.periodId === period.id,
      );
      const personCoefficient = periodCoefficients.find(
        (c) => c.scope === "person" && c.targetId === person.id && c.periodId === period.id,
      );

      entries.push({
        id: entryId,
        periodId: period.id,
        personId: person.id,
        status: "draft",
        divisionCoefficientId: divisionCoefficient?.id ?? null,
        personCoefficientId: personCoefficient?.id ?? null,
      });

      for (const fact of sopFacts) {
        if (!factPerformers(fact).includes(person.id)) continue;
        if (fact.factDate < period.dateFrom || fact.factDate > period.dateTo) continue;
        const sop = sopById.get(fact.sopId);
        if (!sop) continue;

        const line = buildLineFromFact({ fact, sop, performer: person, tariffs, entryId });
        if (line) lines.push(line);
      }
    }
  }

  const data: AppData = {
    persons,
    divisions,
    sops: seedSops.map((s) => ({ ...s })),
    facts: [...sopFacts],
    planItems: workPlanItems.map((p) => ({ ...p })),
    dayPlanTemplates: dayPlanTemplates.map((t) => ({
      ...t,
      lines: t.lines.map((l) => ({ ...l })),
    })),
    weekPlanTemplates: weekPlanTemplates.map((t) => ({
      ...t,
      slots: t.slots.map((s) => ({ ...s })),
    })),
    weekPlanAssignments: weekPlanAssignments.map((a) => ({ ...a })),
    tariffs: [...tariffs],
    paySchemes: seedPaySchemes.map((s) => ({
      ...s,
      components: s.components.map((c) => ({ ...c })),
    })),
    animalTransfers: animalTransfers.map((t) => ({ ...t })),
    weightGains: weightGains.map((g) => ({ ...g })),
    workShifts: workShifts.map((s) => ({
      ...s,
      checklist: { ...s.checklist },
    })),
    inseminations: inseminations.map((i) => ({ ...i })),
    periodKpis: periodKpis.map((k) => ({
      ...k,
      metrics: { ...k.metrics },
    })),
    periods: [...timesheetPeriods],
    entries,
    lines,
    coefficients: [...periodCoefficients],
    accruals: [...bonusPenalties],
  };

  applyDemoOverrides(data);
  return data;
}

/**
 * Точечные «ручные» правки поверх автогенерации, чтобы в демо сразу были видны
 * все состояния табельной позиции, а не только «Сформировано автоматически».
 */
function applyDemoOverrides(data: AppData): void {
  const petrovaEntryId = makeEntryId("tsp-calf-2026-08", "per-petrova");
  const sidorovEntryId = makeEntryId("tsp-calf-2026-08", "per-sidorov");

  // Часть позиций Петровой бригадир уже подтвердил
  const petrovaLines = data.lines.filter(
    (l) => l.entryId === petrovaEntryId && l.status === "auto_generated",
  );
  petrovaLines.slice(0, 8).forEach((line) => {
    line.status = "confirmed";
  });

  // Ручная корректировка — редкое исключение, обязателен комментарий причины
  const adjusted = petrovaLines[8];
  if (adjusted) {
    adjusted.status = "manually_adjusted";
    adjusted.adjustmentComment =
      "Факт задвоился при сбое синхронизации терминала 14.08: вторая запись снята с оплаты, сумма обнулена по решению бригадира";
    adjusted.appliedRate = 0;
    adjusted.amount = 0;
  }

  // Отклонённая позиция — тоже с обязательным комментарием
  const rejected = data.lines.find(
    (l) => l.entryId === sidorovEntryId && l.status === "auto_generated",
  );
  if (rejected) {
    rejected.status = "rejected";
    rejected.adjustmentComment =
      "Операция выполнена не в свою смену и уже оплачена другому исполнителю";
  }

  // Доильный блок бригадир проверил полностью: все позиции обработаны,
  // записи подтверждены, период ушёл на утверждение управляющему
  const milkingEntries = data.entries.filter((e) => e.periodId === "tsp-milking-2026-08");
  for (const entry of milkingEntries) {
    entry.status = "confirmed";
    data.lines
      .filter((l) => l.entryId === entry.id && l.status === "auto_generated")
      .forEach((line) => {
        line.status = "confirmed";
      });
  }
}