/**
 * ТарифСОП — отдельная от СОП сущность.
 * Ставка задаётся за единицу измерения, выбранную в тарифе
 * (операция, час, голова, домик, секция).
 *
 * CRUD-жизненный цикл статусов (прототип → задел под backend):
 *   create → draft
 *   draft  --approve--> active
 *   draft  --reject-->  (удаление)
 *   active --unapprove--> draft
 *   active --archive--> archived
 *   archived --restore--> draft  (снова через approve)
 * Типовая операция списка: утверждение черновика.
 * Нетиповые (архив / восстановить / снять утверждение) — в карточке тарифа.
 */
export type TariffStatus = "draft" | "active" | "archived";

/** Единица измерения ставки тарифа. */
export type TariffRateUnit = "operation" | "hour" | "head" | "house" | "section";

export interface SopTariff {
  id: string;
  /** Ссылка на СОП уровня L3 */
  sopId: string;
  /** Тариф может отличаться по подразделениям */
  divisionId: string;
  /** Опциональная зависимость тарифа от должности */
  jobTitle: string | null;
  /** Ставка в рублях за 1 единицу rateUnit */
  rate: number;
  /** Единица измерения ставки */
  rateUnit: TariffRateUnit;
  /** Дата начала действия, ISO yyyy-mm-dd */
  validFrom: string;
  /** Дата окончания действия; null = действует бессрочно */
  validTo: string | null;
  status: TariffStatus;
  /** Утвердивший — ссылка на Person; у черновика null */
  approvedByPersonId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const TARIFF_STATUS_LABEL: Record<TariffStatus, string> = {
  draft: "Черновик",
  active: "Действует",
  archived: "Архив",
};

export const TARIFF_RATE_UNIT_LABEL: Record<TariffRateUnit, string> = {
  operation: "операция",
  hour: "час",
  head: "голова",
  house: "домик",
  section: "секция",
};

/** Краткие подписи для таблиц и календаря. */
export const TARIFF_RATE_UNIT_SHORT: Record<TariffRateUnit, string> = {
  operation: "оп.",
  hour: "ч",
  head: "гол.",
  house: "дом.",
  section: "сек.",
};

export const TARIFF_RATE_UNIT_ORDER: TariffRateUnit[] = [
  "operation",
  "hour",
  "head",
  "house",
  "section",
];

/** «за 1 операцию» */
export function formatRateUnitPerOne(unit: TariffRateUnit): string {
  return `за 1 ${TARIFF_RATE_UNIT_LABEL[unit]}`;
}

/** «₽ / голова» */
export function formatRateUnitSlash(unit: TariffRateUnit): string {
  return `₽ / ${TARIFF_RATE_UNIT_LABEL[unit]}`;
}

/** «180,00 ₽ / голова» — rate уже отформатирован через formatMoney */
export function formatRateWithUnit(formattedMoney: string, unit: TariffRateUnit): string {
  return `${formattedMoney} / ${TARIFF_RATE_UNIT_LABEL[unit]}`;
}

/** «12 гол.» */
export function formatQuantityWithUnit(quantity: number, unit: TariffRateUnit | null | undefined): string {
  const short = unit ? TARIFF_RATE_UNIT_SHORT[unit] : "ед.";
  const qty =
    Number.isInteger(quantity) ? String(quantity) : quantity.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
  return `${qty} ${short}`;
}
