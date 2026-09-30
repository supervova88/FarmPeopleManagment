import type {
  AnimalTransfer,
  ChecklistValue,
  InseminationResult,
  PaySchemeInputs,
  PeriodKpi,
  WeightGain,
  WorkShift,
} from "@/entities/payScheme/inputs";
import type {
  BandFixedComponent,
  BracketComponent,
  BracketStep,
  FlatComponent,
  PayComponent,
  PayScheme,
  PercentOfBaseComponent,
  PercentStep,
} from "@/entities/payScheme/model";
import { formatMoney } from "@/shared/lib/utils";
import { roundKopecks } from "./rounding";

export interface SchemeLine {
  id: string;
  schemeId: string;
  schemeName: string;
  componentId: string;
  componentCode: string;
  title: string;
  amount: number | null;
  formula: string;
}

export interface ApplyPaySchemeInput {
  schemes: PayScheme[];
  inputs: PaySchemeInputs;
  personId: string;
  divisionId: string;
  jobTitle: string;
  periodId: string;
  dateFrom: string;
  dateTo: string;
}

export interface ApplyPaySchemeResult {
  lines: SchemeLine[];
  total: number;
  /** Сводка формул по схемам */
  formula: string;
}

function inRange(value: number, min: number | null, max: number | null): boolean {
  if (min !== null && value < min) return false;
  if (max !== null && value > max) return false;
  return true;
}

function findBracketRate(steps: BracketStep[], value: number): number | null {
  const step = steps.find((s) => inRange(value, s.min, s.max));
  return step ? step.rate : null;
}

function findBandAmount(
  steps: BandFixedComponent["steps"],
  value: number,
): number | null {
  const step = steps.find((s) => inRange(value, s.min, s.max));
  return step ? step.amount : null;
}

function checklistOk(value: ChecklistValue | undefined): boolean {
  if (!value) return false;
  if (value.kind === "bool") return value.ok;
  return false;
}

function filterTransfers(
  all: AnimalTransfer[],
  personId: string,
  siteKey: string,
  dateFrom: string,
  dateTo: string,
  animalType: "bull" | "heifer",
): AnimalTransfer[] {
  return all.filter(
    (t) =>
      t.personId === personId &&
      t.siteKey === siteKey &&
      t.animalType === animalType &&
      t.eventDate >= dateFrom &&
      t.eventDate <= dateTo,
  );
}

function filterShifts(
  all: WorkShift[],
  personId: string,
  siteKey: string,
  dateFrom: string,
  dateTo: string,
): WorkShift[] {
  return all.filter(
    (s) =>
      s.personId === personId &&
      s.siteKey === siteKey &&
      s.shiftDate >= dateFrom &&
      s.shiftDate <= dateTo,
  );
}

function findKpi(
  kpis: PeriodKpi[],
  periodId: string,
  siteKey: string,
  personId: string,
): PeriodKpi | null {
  return (
    kpis.find(
      (k) => k.periodId === periodId && k.siteKey === siteKey && k.personId === personId,
    ) ??
    kpis.find(
      (k) => k.periodId === periodId && k.siteKey === siteKey && k.personId === null,
    ) ??
    null
  );
}

function matchScheme(scheme: PayScheme, divisionId: string, jobTitle: string): boolean {
  if (scheme.status !== "active") return false;
  if (scheme.divisionId !== divisionId) return false;
  if (scheme.jobTitle !== null && scheme.jobTitle !== jobTitle) return false;
  return true;
}

function calcFlat(
  component: FlatComponent,
  ctx: {
    scheme: PayScheme;
    personId: string;
    dateFrom: string;
    dateTo: string;
    periodId: string;
    inputs: PaySchemeInputs;
  },
): { amount: number | null; formula: string } {
  const { scheme, personId, dateFrom, dateTo, periodId, inputs } = ctx;
  const rate = component.rate;

  if (component.input.source === "animal_transfer") {
    const rows = filterTransfers(
      inputs.animalTransfers,
      personId,
      scheme.siteKey,
      dateFrom,
      dateTo,
      component.input.animalType,
    );
    const qty = rows.length;
    const amount = roundKopecks(qty * rate);
    return {
      amount,
      formula: `${component.title}: ${qty} × ${formatMoney(rate)} = ${formatMoney(amount)}`,
    };
  }

  if (component.input.source === "weight_gain") {
    const gains = inputs.weightGains.filter(
      (g: WeightGain) =>
        g.personId === personId &&
        g.siteKey === scheme.siteKey &&
        g.periodId === periodId,
    );
    const qty = gains.reduce((acc, g) => acc + g.centners, 0);
    const amount = roundKopecks(qty * rate);
    return {
      amount,
      formula: `${component.title}: ${qty} ц × ${formatMoney(rate)} = ${formatMoney(amount)}`,
    };
  }

  if (component.input.source === "work_shift") {
    const shifts = filterShifts(
      inputs.workShifts,
      personId,
      scheme.siteKey,
      dateFrom,
      dateTo,
    );
    const qty = shifts.length;
    const amount = roundKopecks(qty * rate);
    return {
      amount,
      formula: `${component.title}: ${qty} см. × ${formatMoney(rate)} = ${formatMoney(amount)}`,
    };
  }

  if (component.input.source === "checklist") {
    const itemKey = component.input.itemKey;
    const shifts = filterShifts(
      inputs.workShifts,
      personId,
      scheme.siteKey,
      dateFrom,
      dateTo,
    );
    const qty = shifts.filter((s) => checklistOk(s.checklist[itemKey])).length;
    const amount = roundKopecks(qty * rate);
    return {
      amount,
      formula: `${component.title}: ${qty} × ${formatMoney(rate)} = ${formatMoney(amount)}`,
    };
  }

  // period_flat: metric 1 → одна выплата за месяц, иначе 0
  const kpi = findKpi(inputs.periodKpis, periodId, scheme.siteKey, personId);
  const metricKey = component.input.metricKey;
  const raw = kpi?.metrics[metricKey];
  const ok = raw !== null && raw !== undefined && raw > 0;
  const amount = ok ? rate : 0;
  return {
    amount,
    formula: ok
      ? `${component.title}: ${formatMoney(rate)} (месяц)`
      : `${component.title}: не начислено`,
  };
}

function calcBracket(
  component: BracketComponent,
  ctx: {
    scheme: PayScheme;
    personId: string;
    dateFrom: string;
    dateTo: string;
    inputs: PaySchemeInputs;
  },
): { amount: number | null; formula: string } {
  const { scheme, personId, dateFrom, dateTo, inputs } = ctx;

  if (component.input.source === "animal_transfer") {
    const rows = filterTransfers(
      inputs.animalTransfers,
      personId,
      scheme.siteKey,
      dateFrom,
      dateTo,
      component.input.animalType,
    );
    const parts: string[] = [];
    let total = 0;
    let anyMissing = false;
    for (const row of rows) {
      const weight = row.weightKg;
      if (weight === null || weight === undefined) {
        anyMissing = true;
        parts.push(`${row.objectLabel}: вес не задан → —`);
        continue;
      }
      const stepRate = findBracketRate(component.steps, weight);
      if (stepRate === null) {
        anyMissing = true;
        parts.push(`${weight} кг → —`);
        continue;
      }
      total += stepRate;
      parts.push(`${weight} кг → ${formatMoney(stepRate)}`);
    }
    if (rows.length === 0) {
      return { amount: 0, formula: `${component.title}: нет передач` };
    }
    const amount = anyMissing && total === 0 ? null : roundKopecks(total);
    return {
      amount,
      formula: `${component.title}: ${parts.join(", ")} = ${formatMoney(amount)}`,
    };
  }

  // insemination
  const { mode, semenType } = component.input;
  const rows = inputs.inseminations.filter(
    (r: InseminationResult) =>
      r.personId === personId &&
      r.siteKey === scheme.siteKey &&
      r.pregnant &&
      r.mode === mode &&
      r.semenType === semenType &&
      r.eventDate >= dateFrom &&
      r.eventDate <= dateTo,
  );
  const parts: string[] = [];
  let total = 0;
  let anyMissing = false;
  for (const row of rows) {
    const stepRate = findBracketRate(component.steps, row.attemptNumber);
    if (stepRate === null) {
      anyMissing = true;
      parts.push(`№${row.attemptNumber} → —`);
      continue;
    }
    total += stepRate;
    parts.push(`№${row.attemptNumber} → ${formatMoney(stepRate)}`);
  }
  if (rows.length === 0) {
    return { amount: 0, formula: `${component.title}: нет стельностей` };
  }
  const amount = anyMissing && total === 0 ? null : roundKopecks(total);
  return {
    amount,
    formula: `${component.title}: ${parts.join(", ")} = ${formatMoney(amount)}`,
  };
}

function pickPercentSteps(steps: PercentStep[], metrics: Record<string, number | null>): PercentStep[] {
  const byMetric = new Map<string, PercentStep[]>();
  for (const step of steps) {
    const list = byMetric.get(step.metricKey) ?? [];
    list.push(step);
    byMetric.set(step.metricKey, list);
  }
  const chosen: PercentStep[] = [];
  for (const [metricKey, metricSteps] of byMetric) {
    const raw = metrics[metricKey];
    if (raw === null || raw === undefined) {
      // skipIfMissing на любой ступени метрики → 0 для этой метрики
      continue;
    }
    const match = metricSteps.find((s) => inRange(raw, s.min, s.max));
    if (match) chosen.push(match);
  }
  return chosen;
}

function calcPercentOfBase(
  component: PercentOfBaseComponent,
  baseByCode: Map<string, number>,
  kpi: PeriodKpi | null,
): { amount: number | null; formula: string } {
  let base = 0;
  for (const code of component.baseComponentCodes) {
    base += baseByCode.get(code) ?? 0;
  }
  const metrics = kpi?.metrics ?? {};
  const chosen = pickPercentSteps(component.steps, metrics);

  // Метрики со skipIfMissing и отсутствующим значением уже отфильтрованы.
  // Если у метрики skipIfMissing=false и значения нет — для прототипа тоже 0.
  let percentSum = 0;
  const parts: string[] = [];
  for (const step of chosen) {
    percentSum += step.percentOfBase;
    const label =
      step.metricKey === "survival_0_6_pct"
        ? `сохранность ${metrics[step.metricKey]}% → ${Math.round(step.percentOfBase * 100)}%`
        : step.metricKey === "auditor_grade"
          ? `аудит ${metrics[step.metricKey]} → ${Math.round(step.percentOfBase * 100)}%`
          : `${step.metricKey} → ${Math.round(step.percentOfBase * 100)}%`;
    parts.push(label);
  }

  // Явно отметим пропущенный аудит
  const auditorMissing =
    component.steps.some((s) => s.metricKey === "auditor_grade" && s.skipIfMissing) &&
    (metrics.auditor_grade === null || metrics.auditor_grade === undefined);
  if (auditorMissing) {
    parts.push("аудит не проводился → 0%");
  }

  const amount = roundKopecks(base * percentSum);
  return {
    amount,
    formula:
      parts.length === 0
        ? `${component.title}: база ${formatMoney(base)}, показатели не заданы → ${formatMoney(0)}`
        : `${component.title}: ${parts.join(" и ")} от базы тёлок ${formatMoney(base)} = ${Math.round(percentSum * 100)}% × ${formatMoney(base)} = ${formatMoney(amount)}`,
  };
}

function calcBandFixed(
  component: BandFixedComponent,
  kpi: PeriodKpi | null,
): { amount: number | null; formula: string } {
  const raw = kpi?.metrics[component.metricKey];
  if (raw === null || raw === undefined) {
    return {
      amount: 0,
      formula: `${component.title}: показатель не задан → ${formatMoney(0)}`,
    };
  }
  const amount = findBandAmount(component.steps, raw);
  if (amount === null) {
    return {
      amount: 0,
      formula: `${component.title}: ${raw} вне шкалы → ${formatMoney(0)}`,
    };
  }
  return {
    amount,
    formula: `${component.title}: ${raw}% → ${formatMoney(amount)}`,
  };
}

function calcComponent(
  component: PayComponent,
  ctx: {
    scheme: PayScheme;
    personId: string;
    dateFrom: string;
    dateTo: string;
    periodId: string;
    inputs: PaySchemeInputs;
    baseByCode: Map<string, number>;
    kpi: PeriodKpi | null;
  },
): { amount: number | null; formula: string } {
  switch (component.kind) {
    case "flat":
      return calcFlat(component, ctx);
    case "bracket":
      return calcBracket(component, ctx);
    case "percentOfBase":
      return calcPercentOfBase(component, ctx.baseByCode, ctx.kpi);
    case "bandFixed":
      return calcBandFixed(component, ctx.kpi);
  }
}

/**
 * Чистый расчёт схем оплаты за период по человеку.
 * Порядок: сначала flat/bracket/bandFixed, затем percentOfBase (нужна база).
 */
export function applyPayScheme(input: ApplyPaySchemeInput): ApplyPaySchemeResult {
  const matched = input.schemes.filter((s) =>
    matchScheme(s, input.divisionId, input.jobTitle),
  );

  const lines: SchemeLine[] = [];
  const schemeFormulas: string[] = [];

  for (const scheme of matched) {
    const kpi = findKpi(input.inputs.periodKpis, input.periodId, scheme.siteKey, input.personId);
    const baseByCode = new Map<string, number>();
    const deferred: PercentOfBaseComponent[] = [];
    const localLines: SchemeLine[] = [];

    const pushLine = (
      component: PayComponent,
      amount: number | null,
      formula: string,
    ) => {
      localLines.push({
        id: `${scheme.id}:${component.id}`,
        schemeId: scheme.id,
        schemeName: scheme.name,
        componentId: component.id,
        componentCode: component.code,
        title: component.title,
        amount,
        formula,
      });
      if (amount !== null && amount !== 0) {
        baseByCode.set(component.code, (baseByCode.get(component.code) ?? 0) + amount);
      } else if (amount === 0) {
        baseByCode.set(component.code, baseByCode.get(component.code) ?? 0);
      }
    };

    for (const component of scheme.components) {
      if (component.kind === "percentOfBase") {
        deferred.push(component);
        continue;
      }
      const result = calcComponent(component, {
        scheme,
        personId: input.personId,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        periodId: input.periodId,
        inputs: input.inputs,
        baseByCode,
        kpi,
      });
      pushLine(component, result.amount, result.formula);
    }

    for (const component of deferred) {
      const result = calcPercentOfBase(component, baseByCode, kpi);
      pushLine(component, result.amount, result.formula);
    }

    // В ленту попадают только компоненты с ненулевой/null суммой смысла:
    // показываем все, где есть активность (amount !== 0) или null.
    const meaningful = localLines.filter((l) => l.amount === null || l.amount !== 0);
    // Если схема сработала хоть чем-то — оставляем meaningful; иначе пусто.
    lines.push(...(meaningful.length > 0 ? meaningful : []));

    if (meaningful.length > 0) {
      const subtotal = roundKopecks(
        meaningful.reduce((acc, l) => acc + (l.amount ?? 0), 0),
      );
      schemeFormulas.push(
        `${scheme.regulationRef}: ${meaningful.map((l) => l.formula).join("; ")}; итого ${formatMoney(subtotal)}`,
      );
    }
  }

  const total = roundKopecks(lines.reduce((acc, l) => acc + (l.amount ?? 0), 0));
  return {
    lines,
    total,
    formula: schemeFormulas.join(" · ") || "Схемы положения: начислений нет",
  };
}

/** Ожидаемый демо-расчёт телятника №1 для регрессии. */
export function expectedCalfBarn1Demo(): {
  bulls: number;
  heifers: number;
  bonus: number;
  total: number;
} {
  // 2 × 500 + (96→500 + 112→950 + 90→300) + 100% × 1750
  const bulls = 1000;
  const heifers = 500 + 950 + 300;
  const bonus = heifers; // 50% + 50%
  return { bulls, heifers, bonus, total: bulls + heifers + bonus };
}
