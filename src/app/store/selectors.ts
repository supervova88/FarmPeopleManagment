import {
  isLineCountedInPayout,
  type TimesheetEntry,
  type TimesheetLine,
  type TimesheetPeriod,
} from "@/entities/timesheet/model";
import {
  monthKeyFromPeriod,
  type PeriodGranularity,
  viewDates,
} from "@/entities/timesheet/periodView";
import {
  isPlanItemOpen,
  type DayPlanTemplate,
  type WeekPlanAssignment,
  type WeekPlanTemplate,
  type WorkPlanItem,
} from "@/entities/workPlan/model";
import { applyPayScheme } from "@/features/payroll/applyPayScheme";
import { calcPieceworkTotal } from "@/features/payroll/calcCoefficients";
import { buildPayoutBreakdown, type PayoutBreakdown } from "@/features/payroll/calcFinalPayout";
import { roundKopecks } from "@/features/payroll/rounding";
import { DEMO_TODAY, enumerateDates } from "@/shared/lib/utils";
import type { AppState } from "./reducer";
import type { PayScheme } from "@/entities/payScheme/model";
import type { PaySchemeInputs } from "@/entities/payScheme/inputs";

function personName(state: AppState, personId: string): string {
  return state.persons.find((p) => p.id === personId)?.fullName ?? personId;
}

function selectPaySchemeInputs(state: AppState): PaySchemeInputs {
  return {
    animalTransfers: state.animalTransfers ?? [],
    weightGains: state.weightGains ?? [],
    workShifts: state.workShifts ?? [],
    inseminations: state.inseminations ?? [],
    periodKpis: state.periodKpis ?? [],
  };
}

export function selectPaySchemes(state: AppState, activeOnly = false): PayScheme[] {
  const list = state.paySchemes ?? [];
  return activeOnly ? list.filter((s) => s.status === "active") : list;
}

/** Все позиции одной табельной записи, отсортированные по дате факта. */
export function selectLinesByEntry(state: AppState, entryId: string): TimesheetLine[] {
  return state.lines
    .filter((l) => l.entryId === entryId)
    .sort((a, b) =>
      a.factDate === b.factDate ? a.sopName.localeCompare(b.sopName) : a.factDate.localeCompare(b.factDate),
    );
}

/** Позиции записи в видимом диапазоне дат (неделя / месяц). */
export function selectLinesByEntryInRange(
  state: AppState,
  entryId: string,
  dateFrom: string,
  dateTo: string,
): TimesheetLine[] {
  return selectLinesByEntry(state, entryId).filter(
    (l) => l.factDate >= dateFrom && l.factDate <= dateTo,
  );
}

export function selectEntry(state: AppState, entryId: string): TimesheetEntry | undefined {
  return state.entries.find((e) => e.id === entryId);
}

/** Табельная запись сотрудника за выбранный месяц (YYYY-MM). */
export function selectEntryForPerson(
  state: AppState,
  personId: string,
  monthKey?: string,
): TimesheetEntry | undefined {
  if (!monthKey) {
    return state.entries.find((e) => e.personId === personId);
  }
  return state.entries.find((e) => {
    if (e.personId !== personId) return false;
    const period = selectPeriod(state, e.periodId);
    return period ? monthKeyFromPeriod(period) === monthKey : false;
  });
}

export function selectPeriod(state: AppState, periodId: string): TimesheetPeriod | undefined {
  return state.periods.find((p) => p.id === periodId);
}

/** Период подразделения за месяц (dateFrom начинается с YYYY-MM). */
export function selectPeriodByDivision(
  state: AppState,
  divisionId: string,
  monthKey?: string,
): TimesheetPeriod | undefined {
  if (!monthKey) {
    return state.periods.find((p) => p.divisionId === divisionId);
  }
  return state.periods.find(
    (p) => p.divisionId === divisionId && monthKeyFromPeriod(p) === monthKey,
  );
}

/** Период подразделения, в окно которого попадает дата факта. */
export function selectPeriodForFactDate(
  state: AppState,
  divisionId: string,
  factDate: string,
): TimesheetPeriod | undefined {
  return state.periods.find(
    (p) =>
      p.divisionId === divisionId && p.dateFrom <= factDate && factDate <= p.dateTo,
  );
}

export function selectEntriesByPeriod(state: AppState, periodId: string): TimesheetEntry[] {
  return state.entries
    .filter((e) => e.periodId === periodId)
    .sort((a, b) => personName(state, a.personId).localeCompare(personName(state, b.personId), "ru"));
}

/** Полная расчётная лента по одной табельной записи. */
export function selectPayoutBreakdown(state: AppState, entryId: string): PayoutBreakdown | null {
  const entry = selectEntry(state, entryId);
  if (!entry) return null;

  const person = state.persons.find((p) => p.id === entry.personId);
  const period = selectPeriod(state, entry.periodId);

  const divisionCoefficient =
    state.coefficients.find((c) => c.id === entry.divisionCoefficientId) ?? null;
  const personCoefficient =
    state.coefficients.find((c) => c.id === entry.personCoefficientId) ?? null;

  let schemeLines = undefined as ReturnType<typeof applyPayScheme>["lines"] | undefined;
  let schemeFormula = undefined as string | undefined;
  if (person && period) {
    const schemeResult = applyPayScheme({
      schemes: selectPaySchemes(state),
      inputs: selectPaySchemeInputs(state),
      personId: person.id,
      divisionId: person.divisionId,
      jobTitle: person.jobTitle,
      periodId: period.id,
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
    });
    schemeLines = schemeResult.lines;
    schemeFormula = schemeResult.formula;
  }

  return buildPayoutBreakdown({
    personId: entry.personId,
    entryId: entry.id,
    lines: selectLinesByEntry(state, entryId),
    divisionCoefficient,
    personCoefficient,
    accruals: state.accruals.filter((a) => a.entryId === entryId),
    schemeLines,
    schemeFormula,
  });
}

export interface DivisionSummary {
  divisionId: string;
  divisionName: string;
  period: TimesheetPeriod | undefined;
  employeesCount: number;
  operationsCount: number;
  pieceworkTotal: number;
  divisionCoefficientValue: number;
  bonusTotal: number;
  penaltyTotal: number;
  finalPayout: number;
  missingTariffCount: number;
  pendingCount: number;
  allEntriesConfirmed: boolean;
}

/** Сводка по подразделению за выбранный месяц — для экрана утверждения. */
export function selectDivisionSummary(
  state: AppState,
  divisionId: string,
  monthKey?: string,
): DivisionSummary {
  const division = state.divisions.find((d) => d.id === divisionId);
  const period = selectPeriodByDivision(state, divisionId, monthKey);
  const entries = period ? selectEntriesByPeriod(state, period.id) : [];
  const breakdowns = entries
    .map((e) => selectPayoutBreakdown(state, e.id))
    .filter((b): b is PayoutBreakdown => b !== null);

  const divisionCoefficient = period
    ? state.coefficients.find(
        (c) => c.scope === "division" && c.targetId === divisionId && c.periodId === period.id && c.status === "active",
      )
    : undefined;

  return {
    divisionId,
    divisionName: division?.name ?? divisionId,
    period,
    employeesCount: entries.length,
    operationsCount: breakdowns.reduce((acc, b) => acc + b.countedOperationsCount, 0),
    pieceworkTotal: roundKopecks(breakdowns.reduce((acc, b) => acc + b.pieceworkTotal, 0)),
    divisionCoefficientValue: divisionCoefficient?.value ?? 1,
    bonusTotal: roundKopecks(breakdowns.reduce((acc, b) => acc + b.bonusTotal, 0)),
    penaltyTotal: roundKopecks(breakdowns.reduce((acc, b) => acc + b.penaltyTotal, 0)),
    finalPayout: roundKopecks(breakdowns.reduce((acc, b) => acc + b.finalPayout, 0)),
    missingTariffCount: breakdowns.reduce((acc, b) => acc + b.missingTariffCount, 0),
    pendingCount: breakdowns.reduce((acc, b) => acc + b.pendingCount, 0),
    allEntriesConfirmed:
      entries.length > 0 && entries.every((e) => e.status === "confirmed" || e.status === "approved"),
  };
}

export function selectAllDivisionSummaries(state: AppState, monthKey?: string): DivisionSummary[] {
  return state.divisions.map((d) => selectDivisionSummary(state, d.id, monthKey));
}

export interface FarmTotals {
  finalPayout: number;
  pieceworkTotal: number;
  operationsCount: number;
  missingTariffCount: number;
  employeesCount: number;
  allDivisionsConfirmed: boolean;
  allDivisionsApproved: boolean;
}

/** Итог по всей ферме за выбранный месяц. */
export function selectFarmTotals(state: AppState, monthKey?: string): FarmTotals {
  const summaries = selectAllDivisionSummaries(state, monthKey);
  return {
    finalPayout: roundKopecks(summaries.reduce((acc, s) => acc + s.finalPayout, 0)),
    pieceworkTotal: roundKopecks(summaries.reduce((acc, s) => acc + s.pieceworkTotal, 0)),
    operationsCount: summaries.reduce((acc, s) => acc + s.operationsCount, 0),
    missingTariffCount: summaries.reduce((acc, s) => acc + s.missingTariffCount, 0),
    employeesCount: summaries.reduce((acc, s) => acc + s.employeesCount, 0),
    allDivisionsConfirmed: summaries.every((s) => s.allEntriesConfirmed),
    allDivisionsApproved: summaries.every((s) => s.period?.status === "approved"),
  };
}

/** Тарифы конкретного СОП по всем подразделениям. */
export function selectTariffsBySop(state: AppState, sopId: string) {
  return state.tariffs
    .filter((t) => t.sopId === sopId)
    .sort((a, b) =>
      a.divisionId === b.divisionId
        ? a.validFrom.localeCompare(b.validFrom)
        : a.divisionId.localeCompare(b.divisionId),
    );
}

/** Период заблокирован от правок после утверждения. */
export function isPeriodLocked(period: TimesheetPeriod | undefined): boolean {
  if (!period) return false;
  return period.status === "approved" || period.status === "closed";
}

export type CalendarCellTone = "empty" | "ok" | "warning" | "danger" | "plan";

export interface CalendarCell {
  date: string;
  lines: TimesheetLine[];
  /** Число неотклонённых операций */
  opsCount: number;
  /** Сумма сделки за день; null если нет рассчитанных сумм (все без тарифа или пусто) */
  dayTotal: number | null;
  missingTariffCount: number;
  rejectedCount: number;
  tone: CalendarCellTone;
  /** Элементы календарного плана на этот день */
  planItems: WorkPlanItem[];
  /** Открытые задачи плана без факта */
  openPlanCount: number;
}

export interface CalendarRow {
  entry: TimesheetEntry;
  personId: string;
  personName: string;
  jobTitle: string;
  cells: CalendarCell[];
  /** Итого по сделке за период (без коэффициентов и премий) */
  rowTotal: number;
  rowOpsCount: number;
  rowMissingTariffCount: number;
}

export interface CalendarMatrix {
  period: TimesheetPeriod;
  dates: string[];
  rows: CalendarRow[];
  /** Сумма сделки по каждому дню (по всем сотрудникам) */
  columnTotals: Array<{ date: string; total: number; opsCount: number }>;
  grandTotal: number;
  grandOpsCount: number;
}

function buildCell(date: string, lines: TimesheetLine[], planItems: WorkPlanItem[]): CalendarCell {
  const dayLines = lines.filter((l) => l.factDate === date);
  const dayPlan = planItems.filter((p) => p.plannedDate === date);
  const openPlanCount = dayPlan.filter((p) => isPlanItemOpen(p)).length;
  const totals = calcPieceworkTotal(dayLines);
  const hasPaid = totals.paidOperationsCount > 0;

  let tone: CalendarCellTone = "empty";
  if (dayLines.length > 0) {
    if (totals.rejectedCount > 0 && totals.countedOperationsCount === 0) tone = "danger";
    else if (totals.missingTariffCount > 0) tone = "warning";
    else if (totals.rejectedCount > 0) tone = "danger";
    else tone = "ok";
  } else if (openPlanCount > 0) {
    tone = "plan";
  } else if (dayPlan.length > 0) {
    tone = "plan";
  }

  return {
    date,
    lines: dayLines,
    opsCount: totals.countedOperationsCount,
    dayTotal: hasPaid ? totals.pieceworkTotal : null,
    missingTariffCount: totals.missingTariffCount,
    rejectedCount: totals.rejectedCount,
    tone,
    planItems: dayPlan,
    openPlanCount,
  };
}

/**
 * Матрица календарного табеля: сотрудники × даты периода.
 * Итоги — только сделка; коэффициенты и премии на этот экран не разносятся.
 * Опционально сужает колонки до недели (granularity + weekStart).
 */
export function selectCalendarMatrix(
  state: AppState,
  periodId: string,
  view?: { granularity: PeriodGranularity; weekStart: string },
): CalendarMatrix | null {
  const period = selectPeriod(state, periodId);
  if (!period) return null;

  const dates = view
    ? viewDates(period, view.granularity, view.weekStart)
    : enumerateDates(period.dateFrom, period.dateTo);
  const dateFrom = dates[0] ?? period.dateFrom;
  const dateTo = dates[dates.length - 1] ?? period.dateTo;
  const entries = selectEntriesByPeriod(state, periodId);

  const rows: CalendarRow[] = entries.map((entry) => {
    const person = state.persons.find((p) => p.id === entry.personId);
    const allLines = selectLinesByEntry(state, entry.id);
    const personPlan = (state.planItems ?? []).filter(
      (p) =>
        p.personId === entry.personId &&
        p.plannedDate >= period.dateFrom &&
        p.plannedDate <= period.dateTo,
    );
    const lines =
      view?.granularity === "week"
        ? allLines.filter((l) => l.factDate >= dateFrom && l.factDate <= dateTo)
        : allLines;
    const cells = dates.map((date) => buildCell(date, allLines, personPlan));
    const periodTotals = calcPieceworkTotal(lines);

    return {
      entry,
      personId: entry.personId,
      personName: person?.fullName ?? entry.personId,
      jobTitle: person?.jobTitle ?? "",
      cells,
      rowTotal: periodTotals.pieceworkTotal,
      rowOpsCount: periodTotals.countedOperationsCount,
      rowMissingTariffCount: periodTotals.missingTariffCount,
    };
  });

  const columnTotals = dates.map((date) => {
    let total = 0;
    let opsCount = 0;
    for (const row of rows) {
      const cell = row.cells.find((c) => c.date === date);
      if (!cell) continue;
      opsCount += cell.opsCount;
      if (cell.dayTotal !== null) total += cell.dayTotal;
    }
    return { date, total: roundKopecks(total), opsCount };
  });

  return {
    period,
    dates,
    rows,
    columnTotals,
    grandTotal: roundKopecks(rows.reduce((acc, r) => acc + r.rowTotal, 0)),
    grandOpsCount: rows.reduce((acc, r) => acc + r.rowOpsCount, 0),
  };
}

/** Задачи плана текущего сотрудника на указанную дату (по умолчанию DEMO_TODAY). */
export function selectPlanItemsForPersonDay(
  state: AppState,
  personId: string,
  date: string = DEMO_TODAY,
): WorkPlanItem[] {
  return (state.planItems ?? [])
    .filter((p) => p.personId === personId && p.plannedDate === date)
    .sort((a, b) => a.sopId.localeCompare(b.sopId) || a.id.localeCompare(b.id));
}

/** Задачи плана сотрудника в диапазоне дат включительно. */
export function selectPlanItemsForPersonRange(
  state: AppState,
  personId: string,
  dateFrom: string,
  dateTo: string,
): WorkPlanItem[] {
  return (state.planItems ?? [])
    .filter(
      (p) =>
        p.personId === personId && p.plannedDate >= dateFrom && p.plannedDate <= dateTo,
    )
    .sort(
      (a, b) =>
        a.plannedDate.localeCompare(b.plannedDate) ||
        a.sopId.localeCompare(b.sopId) ||
        a.id.localeCompare(b.id),
    );
}

/** Шаблоны дня подразделения (без архива, если onlyActive). */
export function selectDayTemplates(
  state: AppState,
  divisionId: string,
  onlyActive = false,
): DayPlanTemplate[] {
  return (state.dayPlanTemplates ?? [])
    .filter(
      (t) =>
        t.divisionId === divisionId &&
        t.status !== "archived" &&
        (!onlyActive || t.status === "active"),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "ru") || a.id.localeCompare(b.id));
}

/** Шаблоны недели подразделения. */
export function selectWeekTemplates(
  state: AppState,
  divisionId: string,
  onlyActive = false,
): WeekPlanTemplate[] {
  return (state.weekPlanTemplates ?? [])
    .filter(
      (t) =>
        t.divisionId === divisionId &&
        t.status !== "archived" &&
        (!onlyActive || t.status === "active"),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "ru") || a.id.localeCompare(b.id));
}

/** Назначения недели для сотрудника (новые сверху). */
export function selectAssignmentsForPerson(
  state: AppState,
  personId: string,
): WeekPlanAssignment[] {
  return (state.weekPlanAssignments ?? [])
    .filter((a) => a.personId === personId && a.status !== "cancelled")
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.id.localeCompare(b.id));
}

/** Назначения подразделения. */
export function selectAssignmentsForDivision(
  state: AppState,
  divisionId: string,
): WeekPlanAssignment[] {
  return (state.weekPlanAssignments ?? [])
    .filter((a) => a.divisionId === divisionId)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart) || a.id.localeCompare(b.id));
}

/** Открытые задачи плана подразделения в диапазоне дат (план без факта). */
export function selectOpenPlanGaps(
  state: AppState,
  divisionId: string,
  dateFrom: string,
  dateTo: string,
): WorkPlanItem[] {
  return (state.planItems ?? []).filter(
    (p) =>
      p.divisionId === divisionId &&
      p.plannedDate >= dateFrom &&
      p.plannedDate <= dateTo &&
      isPlanItemOpen(p),
  );
}

export interface CalendarSopPayout {
  sopId: string;
  sopName: string;
  /** Неотклонённые факты этой операции за период */
  opsCount: number;
  /** Сумма сделки за месяц; без позиций без тарифа */
  monthTotal: number;
  /** monthTotal / число дней периода — сопоставимо между СОП */
  avgPerDay: number;
  missingTariffCount: number;
}

/**
 * Сколько платим по каждой операции СОП за период: месяц и среднее за календарный день.
 * Отклонённые позиции не входят; пустые СОП без фактов не возвращаются.
 * Опционально сужает выборку до видимого диапазона (неделя).
 */
export function selectCalendarSopPayouts(
  state: AppState,
  periodId: string,
  view?: { granularity: PeriodGranularity; weekStart: string },
): CalendarSopPayout[] {
  const period = selectPeriod(state, periodId);
  if (!period) return [];

  const dates = view
    ? viewDates(period, view.granularity, view.weekStart)
    : enumerateDates(period.dateFrom, period.dateTo);
  const dayCount = dates.length;
  if (dayCount === 0) return [];
  const dateFrom = dates[0]!;
  const dateTo = dates[dates.length - 1]!;

  const entryIds = new Set(selectEntriesByPeriod(state, periodId).map((e) => e.id));
  const bySop = new Map<string, CalendarSopPayout>();

  for (const line of state.lines) {
    if (!entryIds.has(line.entryId)) continue;
    if (!isLineCountedInPayout(line)) continue;
    if (line.factDate < dateFrom || line.factDate > dateTo) continue;

    let row = bySop.get(line.sopId);
    if (!row) {
      row = {
        sopId: line.sopId,
        sopName: line.sopName,
        opsCount: 0,
        monthTotal: 0,
        avgPerDay: 0,
        missingTariffCount: 0,
      };
      bySop.set(line.sopId, row);
    }

    row.opsCount += 1;
    if (line.status === "tariff_missing") row.missingTariffCount += 1;
    if (line.amount !== null) row.monthTotal += line.amount;
  }

  return [...bySop.values()]
    .filter((row) => row.opsCount > 0)
    .map((row) => {
      const monthTotal = roundKopecks(row.monthTotal);
      return {
        ...row,
        monthTotal,
        avgPerDay: roundKopecks(monthTotal / dayCount),
      };
    })
    .sort((a, b) => b.monthTotal - a.monthTotal || a.sopName.localeCompare(b.sopName, "ru"));
}

export function selectFactById(state: AppState, factId: string | null | undefined) {
  if (!factId) return undefined;
  return state.facts.find((f) => f.id === factId);
}

export function selectFactMap(state: AppState): Map<string, (typeof state.facts)[number]> {
  return new Map(state.facts.map((f) => [f.id, f]));
}
