/**
 * Входы для схем оплаты — отдельно от SopFact.
 * Факт СОП описывает исполнение операции; здесь — результат, смена и KPI периода.
 */

/** Передача / продажа головы (телятник №1, результат). */
export interface AnimalTransfer {
  id: string;
  personId: string;
  divisionId: string;
  siteKey: "calf_barn_1";
  /** Дата события, ISO yyyy-mm-dd */
  eventDate: string;
  animalType: "bull" | "heifer";
  /** Вес при передаче, кг; для бычка может быть null */
  weightKg: number | null;
  objectLabel: string;
}

/** Привес за период (телятники №2, 3, 5). */
export interface WeightGain {
  id: string;
  personId: string;
  divisionId: string;
  siteKey: "calf_barn_2_3_5";
  periodId: string;
  /** Центнеры привеса */
  centners: number;
}

/** Результат пункта чек-листа смены. */
export type ChecklistValue =
  | { kind: "bool"; ok: boolean }
  | { kind: "number"; value: number };

export interface WorkShift {
  id: string;
  personId: string;
  divisionId: string;
  siteKey: "calf_barn_2_3_5" | "calf_barn_6_7" | "bucket_wash" | "night_herdsman";
  /** Дата смены */
  shiftDate: string;
  checklist: Record<string, ChecklistValue>;
}

/** Результат осеменения (оплата только при стельности). */
export interface InseminationResult {
  id: string;
  personId: string;
  divisionId: string;
  siteKey: "ai_technician";
  eventDate: string;
  mode: "sync" | "heat";
  semenType: "sexed" | "traditional";
  /** Порядковый номер осеменения 1…n */
  attemptNumber: number;
  pregnant: boolean;
  objectLabel: string;
}

/** Показатели периода на площадку / человека. */
export interface PeriodKpi {
  id: string;
  periodId: string;
  divisionId: string;
  siteKey: string;
  /** null = показатель на всё подразделение/площадку */
  personId: string | null;
  metrics: Record<string, number | null>;
}

export interface PaySchemeInputs {
  animalTransfers: AnimalTransfer[];
  weightGains: WeightGain[];
  workShifts: WorkShift[];
  inseminations: InseminationResult[];
  periodKpis: PeriodKpi[];
}
