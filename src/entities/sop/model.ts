/**
 * СОП — единая иерархическая сущность трёх уровней.
 * Карточка СОП — методическая инструкция и НИКОГДА не содержит денежных полей.
 * Деньги живут в отдельной сущности SopTariff.
 */
export type SopLevel = "L1_division" | "L2_process" | "L3_operation";

export type SopStatus = "draft" | "in_review" | "active" | "archived";

/** Объект операции — только для уровня L3. */
export type SopOperationObject = "animal" | "group" | "housing" | "inventory" | "other";

export interface Sop {
  id: string;
  code: string;
  name: string;
  level: SopLevel;
  /** Родительский СОП верхнего уровня */
  parentId: string | null;
  version: string;
  status: SopStatus;
  /** Владелец/утверждающий — ссылка на Person */
  ownerPersonId: string;
  /** Дата вступления в силу, ISO yyyy-mm-dd */
  effectiveFrom: string;
  /** Краткое методическое описание */
  methodSummary: string;

  // ---- Поля только для level === "L3_operation" ----
  operationObject?: SopOperationObject;
  /**
   * Единица нормирования зафиксирована решением: 1 факт выполнения = 1 оплачиваемая единица.
   * Литеральный тип не даёт ввести литры/килограммы/головы как базу оплаты.
   */
  normUnit?: "operation";
  /**
   * Признак тарифицируемости. Это НЕ то же самое, что «тариф задан»:
   * операция может быть тарифицируемой, но тарифа на дату ещё нет.
   */
  isTariffable?: boolean;
}

export const SOP_LEVEL_LABEL: Record<SopLevel, string> = {
  L1_division: "L1 · Подразделение",
  L2_process: "L2 · Процесс",
  L3_operation: "L3 · Операция",
};

export const SOP_LEVEL_SHORT: Record<SopLevel, string> = {
  L1_division: "L1",
  L2_process: "L2",
  L3_operation: "L3",
};

export const SOP_STATUS_LABEL: Record<SopStatus, string> = {
  draft: "Черновик",
  in_review: "На согласовании",
  active: "Действует",
  archived: "Архив",
};

export const SOP_OPERATION_OBJECT_LABEL: Record<SopOperationObject, string> = {
  animal: "Животное",
  group: "Группа",
  housing: "Место содержания",
  inventory: "Инвентарь",
  other: "Прочее",
};

export function isL3(sop: Sop): boolean {
  return sop.level === "L3_operation";
}
