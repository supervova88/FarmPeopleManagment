import type { SopTariff } from "@/entities/tariff/model";
import { isDateWithin } from "@/shared/lib/utils";

export interface TariffLookup {
  sopId: string;
  /** Подразделение ИСПОЛНИТЕЛЯ, а не место выполнения операции */
  divisionId: string;
  /** Должность исполнителя; используется, если для неё задан отдельный тариф */
  jobTitle: string | null;
  /** Дата факта, ISO yyyy-mm-dd */
  date: string;
}

/**
 * Правило применения тарифа.
 *
 * Берётся ТарифСОП с тем же sopId и подразделением исполнителя, у которого
 * дата_начала_действия <= дата факта <= дата_окончания_действия (или окончание не задано).
 *
 * Черновик не применяется никогда: тариф, не утверждённый управляющим, денег не приносит.
 * А вот архивный тариф применяется к датам внутри своего окна действия — иначе операции
 * прошлых месяцев «потеряли» бы ставку после выхода новой версии тарифа.
 *
 * Приоритет: тариф, заданный под конкретную должность, важнее общего тарифа
 * подразделения. Если подходящих несколько — берётся с самой поздней датой начала.
 *
 * Возвращает null, если тарифа нет. Именно null, а не ставка 0:
 * «решение ещё не принято» и «операция бесплатна» — разные состояния.
 */
export function findApplicableTariff(lookup: TariffLookup, tariffs: SopTariff[]): SopTariff | null {
  const candidates = tariffs.filter(
    (t) =>
      t.sopId === lookup.sopId &&
      t.divisionId === lookup.divisionId &&
      t.status !== "draft" &&
      isDateWithin(lookup.date, t.validFrom, t.validTo) &&
      (t.jobTitle === null || t.jobTitle === lookup.jobTitle),
  );

  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => {
    const aByJob = a.jobTitle !== null ? 1 : 0;
    const bByJob = b.jobTitle !== null ? 1 : 0;
    if (aByJob !== bByJob) return bByJob - aByJob;
    return b.validFrom.localeCompare(a.validFrom);
  });

  return sorted[0];
}

/**
 * Все версии тарифа по одному СОП и подразделению, отсортированные по дате начала.
 * Используется на timeline версий в экране управления тарифами.
 */
export function getTariffTimeline(
  sopId: string,
  divisionId: string,
  tariffs: SopTariff[],
): SopTariff[] {
  return tariffs
    .filter((t) => t.sopId === sopId && t.divisionId === divisionId)
    .sort((a, b) => a.validFrom.localeCompare(b.validFrom));
}
