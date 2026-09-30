import type { BonusPenalty, DeviationRef } from "./model";

/** Демо-справочник производственных отклонений и задач для опциональной ссылки. */
export const deviationRefs: DeviationRef[] = [
  { id: "dev-198", label: "ОТКЛ-198 · Просрочка первой выпойки молозивом, телёнок №4712" },
  { id: "dev-204", label: "ОТКЛ-204 · Нарушение концентрации дезраствора, к-т 1" },
  { id: "dev-211", label: "ОТКЛ-211 · Домик Д-09 заселён без паспорта готовности" },
  { id: "task-77", label: "ЗАДАЧА-77 · Внеплановая обработка группы Г-2" },
];

export const deviationRefById = new Map(deviationRefs.map((d) => [d.id, d]));

/**
 * Премии и штрафы. Лимитов и дополнительного согласования нет.
 * Премия бригадиру 560 ₽ добивает сделку 119 440 до ровных 120 000.
 */
export const bonusPenalties: BonusPenalty[] = [
  {
    id: "bp-001",
    personId: "per-kuznecov",
    entryId: "tse-tsp-calf-2026-08-per-kuznecov",
    type: "bonus",
    amount: 560,
    reason: "Доплата за координацию ночных выпоек при пике отъёма 18–22.08",
    linkedDeviationId: null,
    appliedByPersonId: "per-morozov",
    decidedAt: "2026-08-28",
    status: "accrued",
  },
  {
    id: "bp-003",
    personId: "per-fedorov",
    entryId: "tse-tsp-maternity-2026-08-per-fedorov",
    type: "bonus",
    amount: 3500,
    reason: "Подмена коллеги на больничном: четыре смены сверх графика",
    linkedDeviationId: null,
    appliedByPersonId: "per-smirnova",
    decidedAt: "2026-08-22",
    status: "accrued",
  },
  {
    id: "bp-004",
    personId: "per-petrova",
    entryId: "tse-tsp-calf-2026-08-per-petrova",
    type: "penalty",
    amount: 1200,
    reason: "Домик Д-09 заселён без оформленного паспорта готовности",
    linkedDeviationId: "dev-211",
    appliedByPersonId: "per-kuznecov",
    decidedAt: "2026-08-24",
    status: "disputed",
  },
];
