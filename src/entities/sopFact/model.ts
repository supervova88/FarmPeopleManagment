/**
 * ПроизводственныйФактСОП — вход из уже существующего производственного контура.
 * В этом модуле факт только читается: UI его регистрации здесь не проектируется.
 *
 * Один факт = одно событие. Исполнителей может быть 1 или 2 (совместная работа);
 * каждому создаётся своя табельная позиция с полной ставкой.
 */
export type SopFactStatus = "done" | "done_with_deviations" | "partially_done" | "not_done";

export interface SopFact {
  id: string;
  /** Ссылка на СОП уровня L3 */
  sopId: string;
  /** Версия СОП на момент выполнения */
  sopVersion: string;
  /**
   * Исполнители — 1 или 2 уникальных Person.id.
   * Совместная работа: уборка домика вдвоём, приём телёнка вдвоём.
   */
  performerPersonIds: string[];
  /** Объект: животное/группа/место содержания — текстовое описание для контекста */
  objectLabel: string;
  /** Дата факта, ISO yyyy-mm-dd */
  factDate: string;
  factStatus: SopFactStatus;
  /**
   * Количество в единицах тарифа (операции, часы, головы, домики, секции).
   * Умножается на ставку при расчёте суммы позиции (каждому исполнителю полностью).
   */
  quantity: number;
}

export const SOP_FACT_STATUS_LABEL: Record<SopFactStatus, string> = {
  done: "Выполнено",
  done_with_deviations: "Выполнено с отклонениями",
  partially_done: "Частично выполнено",
  not_done: "Не выполнено",
};

/** Только эти два статуса формируют табельную позицию. */
export const PAYABLE_FACT_STATUSES: readonly SopFactStatus[] = ["done", "done_with_deviations"];

export function isPayableFact(fact: SopFact): boolean {
  return PAYABLE_FACT_STATUSES.includes(fact.factStatus);
}

/** Нормализованный список исполнителей (уникальные, 1–2). */
export function factPerformers(fact: Pick<SopFact, "performerPersonIds">): string[] {
  const unique = Array.from(new Set(fact.performerPersonIds.filter(Boolean)));
  return unique.slice(0, 2);
}

export function isFactPerformer(
  fact: Pick<SopFact, "performerPersonIds">,
  personId: string,
): boolean {
  return factPerformers(fact).includes(personId);
}

/** Коллеги по факту относительно текущего исполнителя. */
export function coPerformerIds(
  fact: Pick<SopFact, "performerPersonIds">,
  personId: string,
): string[] {
  return factPerformers(fact).filter((id) => id !== personId);
}
