/**
 * Схема оплаты по положению о труде.
 * Отдельный слой рядом с тарифом СОП: считает результат, смену и качество,
 * а не «факт операции × плоская ставка».
 */

export type PaySchemeStatus = "draft" | "active" | "archived";

/** Единица количества в компоненте схемы. */
export type PayQuantityUnit =
  | "head"
  | "shift"
  | "centner"
  | "month"
  | "checklist_item"
  | "operation";

export type PayComponentKind = "flat" | "bracket" | "percentOfBase" | "bandFixed";

/** Площадка / роль в положении (не оргструктура). */
export type PaySiteKey =
  | "calf_barn_1"
  | "calf_barn_2_3_5"
  | "calf_barn_6_7"
  | "bucket_wash"
  | "night_herdsman"
  | "ai_technician";

export interface FlatComponent {
  kind: "flat";
  id: string;
  code: string;
  title: string;
  rate: number;
  unit: PayQuantityUnit;
  /** Фильтр входа: какой источник количества */
  input: FlatInputRef;
}

export type FlatInputRef =
  | { source: "animal_transfer"; animalType: "bull" | "heifer" }
  | { source: "weight_gain" }
  | { source: "work_shift" }
  | { source: "checklist"; itemKey: string }
  | { source: "period_flat"; metricKey: string };

export interface BracketStep {
  /** Нижняя граница включительно; null = −∞ */
  min: number | null;
  /** Верхняя граница включительно; null = +∞ */
  max: number | null;
  rate: number;
}

export interface BracketComponent {
  kind: "bracket";
  id: string;
  code: string;
  title: string;
  unit: PayQuantityUnit;
  input: BracketInputRef;
  steps: BracketStep[];
}

export type BracketInputRef =
  | { source: "animal_transfer"; animalType: "heifer"; measure: "weightKg" }
  | {
      source: "insemination";
      mode: "sync" | "heat";
      semenType: "sexed" | "traditional";
      measure: "attemptNumber";
    };

export interface PercentStep {
  /** Показатель: сохранность % или оценка аудитора */
  metricKey: string;
  min: number | null;
  max: number | null;
  /** Доля фонда, 0…1 (0.5 = 50%) */
  percentOfBase: number;
  /** Если показателя нет — ступень даёт 0 */
  skipIfMissing: boolean;
}

export interface PercentOfBaseComponent {
  kind: "percentOfBase";
  id: string;
  code: string;
  title: string;
  /** Коды базовых компонентов, сумма которых = фонд */
  baseComponentCodes: string[];
  steps: PercentStep[];
}

export interface BandFixedStep {
  min: number | null;
  max: number | null;
  amount: number;
}

export interface BandFixedComponent {
  kind: "bandFixed";
  id: string;
  code: string;
  title: string;
  metricKey: string;
  steps: BandFixedStep[];
}

export type PayComponent =
  | FlatComponent
  | BracketComponent
  | PercentOfBaseComponent
  | BandFixedComponent;

export interface PayScheme {
  id: string;
  name: string;
  /** Ссылка на раздел положения, для подписи в UI */
  regulationRef: string;
  divisionId: string;
  siteKey: PaySiteKey;
  /** null = любая должность подразделения на этой площадке */
  jobTitle: string | null;
  status: PaySchemeStatus;
  components: PayComponent[];
  approvedByPersonId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const PAY_SCHEME_STATUS_LABEL: Record<PaySchemeStatus, string> = {
  draft: "Черновик",
  active: "Действует",
  archived: "Архив",
};

export const PAY_SITE_LABEL: Record<PaySiteKey, string> = {
  calf_barn_1: "Телятник №1 (0–1 нед.)",
  calf_barn_2_3_5: "Телятники №2, 3, 5",
  calf_barn_6_7: "Телятники №6, 7",
  bucket_wash: "Мойка вёдер / молокоприготовление",
  night_herdsman: "Ночной скотник",
  ai_technician: "Техник искусственного осеменения",
};

export const PAY_QUANTITY_UNIT_LABEL: Record<PayQuantityUnit, string> = {
  head: "голова",
  shift: "смена",
  centner: "ц",
  month: "месяц",
  checklist_item: "пункт чек-листа",
  operation: "операция",
};

export const PAY_COMPONENT_KIND_LABEL: Record<PayComponentKind, string> = {
  flat: "Ставка × количество",
  bracket: "Шкала",
  percentOfBase: "% от базы",
  bandFixed: "Фикс по диапазону",
};
