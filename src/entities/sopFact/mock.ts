import { sopById } from "@/entities/sop/mock";
import type { SopFact, SopFactStatus } from "./model";

/**
 * Производственные факты за август 2026.
 *
 * Телятник — скользящий график 5–2 (факты только в смены):
 *   Петрова   выходные вт–ср · 23 смены
 *   Сидоров   выходные чт–пт · 23 смены
 *   Иванов    выходные сб–вс · 21 смена (совместные факты с Сидоровым и Петровой)
 *   Волкова   выходные сб–вс · 21 смена
 *   Лебедева  выходные вс–пн · 21 смена
 *   Кузнецов  пн–пт (сб–вс) · 21 смена
 *
 * Совместные факты:
 *   Иванов+Сидоров — уборка домика (sop-2-1-1) в отдельные дни
 *   Петрова+Иванов — приём телёнка (sop-1-1-1) в 2–3 дня
 *
 * На смене всегда ≥2 оператора (в воскресенье ровно Петрова+Сидоров; в остальные дни 3).
 * Бригадир в будни — дополнительный человек.
 *
 * Целевые сделки (коэфф. 1,0), ставки ЗЦМ 420 / комбикорм 350 / подстилка 480 / очистка 700:
 *   Кузнецов ~119 440 ₽ (+ премия 560 → 120 000)
 *   Петрова  ~85 000 ₽ сделка (после ручной корректировки и оспоренного штрафа итог ~84 000)
 *   Сидоров  ~78 000 ₽
 *   Волкова  ~69 880 ₽
 *   Лебедева ~61 630 ₽
 */
const PERIOD_YEAR = 2026;
const PERIOD_MONTH = "08";
const DAYS_IN_MONTH = 31;

/** Понедельники августа 2026: 3, 10, 17, 24, 31 */
const MONDAYS = [3, 10, 17, 24, 31];

/**
 * Выходные по скользящему 5–2 (август 2026, 1-е — суббота).
 * У четверых операторов сдвиг пар выходных; бригадир — классические сб–вс.
 */
const OFF_DAYS: Record<string, ReadonlySet<number>> = {
  "per-petrova": new Set([4, 5, 11, 12, 18, 19, 25, 26]),
  "per-sidorov": new Set([6, 7, 13, 14, 20, 21, 27, 28]),
  "per-ivanov": new Set([1, 2, 8, 9, 15, 16, 22, 23, 29, 30]),
  "per-volkova": new Set([1, 2, 8, 9, 15, 16, 22, 23, 29, 30]),
  "per-lebedeva": new Set([2, 3, 9, 10, 16, 17, 23, 24, 30, 31]),
  "per-kuznecov": new Set([1, 2, 8, 9, 15, 16, 22, 23, 29, 30]),
};

function dayToIso(day: number): string {
  return `${PERIOD_YEAR}-${PERIOD_MONTH}-${String(day).padStart(2, "0")}`;
}

function workDays(personId: string): number[] {
  const off = OFF_DAYS[personId] ?? new Set<number>();
  const days: number[] = [];
  for (let d = 1; d <= DAYS_IN_MONTH; d += 1) {
    if (!off.has(d)) days.push(d);
  }
  return days;
}

let factCounter = 1;

function pushFact(
  result: SopFact[],
  sopId: string,
  performers: string | string[],
  day: number,
  objectLabel: string,
  factStatus: SopFactStatus = "done",
  quantity = 1,
): void {
  const sop = sopById.get(sopId);
  const performerPersonIds = Array.isArray(performers) ? performers : [performers];
  result.push({
    id: `fact-${String(factCounter).padStart(3, "0")}`,
    sopId,
    sopVersion: sop?.version ?? "1.0",
    performerPersonIds,
    objectLabel,
    factDate: dayToIso(day),
    factStatus,
    quantity,
  });
  factCounter += 1;
}

/**
 * Распределяет `count` фактов равномерно по рабочим дням человека.
 * Если фактов больше, чем смен — несколько операций в один день.
 */
function spreadAcross(days: number[], count: number): number[] {
  if (count <= 0 || days.length === 0) return [];
  if (count >= days.length) {
    const result: number[] = [];
    for (let i = 0; i < count; i += 1) {
      result.push(days[i % days.length]);
    }
    return result;
  }
  const result: number[] = [];
  for (let i = 0; i < count; i += 1) {
    result.push(days[Math.floor((i * days.length) / count)]);
  }
  return result;
}

/**
 * Дни замены подстилки: понедельники, если человек в смене;
 * иначе ближайший следующий рабочий день (для Лебедевой вс–пн).
 */
function beddingDaysFor(personId: string, count: number): number[] {
  const off = OFF_DAYS[personId] ?? new Set<number>();
  const picked: number[] = [];
  for (const monday of MONDAYS) {
    if (picked.length >= count) break;
    if (!off.has(monday)) {
      picked.push(monday);
      continue;
    }
    let d = monday + 1;
    while (d <= DAYS_IN_MONTH && off.has(d)) d += 1;
    if (d <= DAYS_IN_MONTH) picked.push(d);
  }
  return picked.slice(0, count);
}

interface CalfWorkload {
  personId: string;
  milk: number;
  feed: number;
  bedding: number;
  clean: number;
  milkGroups: string[];
  feedGroups: string[];
  houseBase: number;
}

/**
 * Объёмы (те же суммы, упакованы в смены 5–2):
 * Petrova  64×420 + 63×350 + 5×480 + 50×700 = 86 330
 *   (в seed одна позиция обнулена вручную ≈ −420…700 → сделка ≈ 85 600;
 *    оспоренный штраф −1 200 → итог ≈ 84 400)
 * Sidorov  61×420 + 56×350 + 5×480 + 44×700 = 78 420
 *   (в seed одна позиция отклонена → сделка ≈ 78 000)
 * Volkova  54×420 + 50×350 + 5×480 + 39×700 = 69 880
 * Lebedeva 48×420 + 45×350 + 4×480 + 34×700 = 61 630
 * Kuznecov 82×420 + 76×350 + 5×480 + 80×700 = 119 440 (+ премия 560 → 120 000)
 */
const calfWorkloads: CalfWorkload[] = [
  {
    personId: "per-petrova",
    milk: 64,
    feed: 63,
    bedding: 5,
    clean: 50,
    milkGroups: ["Группа Г-1 (16 гол.)", "Группа Г-2 (18 гол.)"],
    feedGroups: ["Группа Г-1 (16 гол.)", "Группа Г-2 (18 гол.)"],
    houseBase: 1,
  },
  {
    personId: "per-sidorov",
    milk: 61,
    feed: 56,
    bedding: 5,
    clean: 44,
    milkGroups: ["Группа Г-3 (14 гол.)", "Группа Г-4 (15 гол.)"],
    feedGroups: ["Группа Г-3 (14 гол.)", "Группа Г-4 (15 гол.)"],
    houseBase: 20,
  },
  {
    personId: "per-volkova",
    milk: 54,
    feed: 50,
    bedding: 5,
    clean: 39,
    milkGroups: ["Группа Г-5 (12 гол.)", "Группа Г-2 (18 гол.)"],
    feedGroups: ["Группа Г-5 (12 гол.)"],
    houseBase: 40,
  },
  {
    personId: "per-lebedeva",
    milk: 48,
    feed: 45,
    bedding: 4,
    clean: 34,
    milkGroups: ["Группа Г-6 (11 гол.)"],
    feedGroups: ["Группа Г-6 (11 гол.)", "Группа Г-1 (16 гол.)"],
    houseBase: 60,
  },
  {
    personId: "per-kuznecov",
    milk: 82,
    feed: 76,
    bedding: 5,
    clean: 80,
    milkGroups: ["Группа Г-1 (16 гол.)", "Группа Г-3 (14 гол.)", "Группа Г-5 (12 гол.)"],
    feedGroups: ["Группа Г-2 (18 гол.)", "Группа Г-4 (15 гол.)"],
    houseBase: 80,
  },
];

function buildCalfFacts(): SopFact[] {
  const result: SopFact[] = [];

  for (const w of calfWorkloads) {
    const days = workDays(w.personId);

    const milkDays = spreadAcross(days, w.milk);
    milkDays.forEach((day, i) => {
      const status: SopFactStatus =
        w.personId === "per-sidorov" && i === 7 ? "done_with_deviations" : "done";
      // Единица тарифа ЗЦМ — голова; на части фактов qty > 1 для демо
      const qty = i % 12 === 0 ? 2 : 1;
      pushFact(
        result,
        "sop-1-2-2",
        w.personId,
        day,
        w.milkGroups[i % w.milkGroups.length],
        status,
        qty,
      );
    });

    const feedDays = spreadAcross(days, w.feed);
    feedDays.forEach((day, i) => {
      pushFact(result, "sop-1-2-3", w.personId, day, w.feedGroups[i % w.feedGroups.length]);
    });

    beddingDaysFor(w.personId, w.bedding).forEach((day, i) => {
      const houseNo = w.houseBase + (i % 8);
      // Единица тарифа подстилки — домик
      pushFact(
        result,
        "sop-2-1-2",
        w.personId,
        day,
        `Домик Д-${String(houseNo).padStart(2, "0")}`,
        "done",
        i === 0 ? 2 : 1,
      );
    });

    const cleanDays = spreadAcross(days, w.clean);
    cleanDays.forEach((day, i) => {
      const houseNo = w.houseBase + (i % 18);
      // Единица тарифа очистки — секция
      pushFact(
        result,
        "sop-2-1-1",
        w.personId,
        day,
        `Домик Д-${String(houseNo).padStart(2, "0")}`,
        "done",
        i % 15 === 0 ? 2 : 1,
      );
    });
  }

  // Кейс «тариф не задан»: контрольные взвешивания у Петровой (только в её смены)
  pushFact(result, "sop-1-3-3", "per-petrova", 13, "Телёнок №4712");
  pushFact(result, "sop-1-3-3", "per-petrova", 21, "Телёнок №4718");
  pushFact(result, "sop-1-3-3", "per-petrova", 27, "Телёнок №4725");

  // Совместная уборка: Иванов + Сидоров (оба в смене: пн/ср)
  for (const day of [3, 10, 17, 24]) {
    pushFact(
      result,
      "sop-2-1-1",
      ["per-ivanov", "per-sidorov"],
      day,
      `Домик Д-${String(10 + (day % 5)).padStart(2, "0")}`,
    );
  }

  // Совместный приём телёнка: Петрова + Иванов (оба в смене: пн/чт)
  for (const day of [3, 14, 28]) {
    pushFact(
      result,
      "sop-1-1-1",
      ["per-petrova", "per-ivanov"],
      day,
      `Телёнок №48${20 + day} (совместный приём)`,
    );
  }

  // Неоплачиваемые статусы (не порождают табельную позицию) — в рабочие дни
  pushFact(result, "sop-1-2-2", "per-lebedeva", 15, "Группа Г-6 (11 гол.)", "partially_done");
  pushFact(result, "sop-1-2-3", "per-volkova", 21, "Группа Г-5 (12 гол.)", "not_done");

  return result;
}

function buildOtherFacts(): SopFact[] {
  const result: SopFact[] = [];

  // Родильное
  for (const day of [2, 5, 8, 11, 14, 18, 22, 26, 29]) {
    pushFact(result, "sop-1-1-1", "per-fedorov", day, `Телёнок №47${40 + (day % 10)} (новорожд.)`);
    pushFact(result, "sop-1-1-2", "per-fedorov", day, `Телёнок №47${40 + (day % 10)} (новорожд.)`);
  }
  for (const day of [4, 12, 19, 27]) {
    pushFact(result, "sop-1-1-1", "per-smirnova", day, "Родильный бокс Р-1");
    pushFact(result, "sop-2-1-1", "per-smirnova", day, "Родильный бокс Р-3");
  }
  for (const day of [3, 7, 10, 15, 21, 25, 30]) {
    pushFact(result, "sop-1-3-1", "per-ivanova", day, "Телёнок №4690");
    pushFact(result, "sop-1-3-2", "per-ivanova", day, "Телёнок №4701");
  }

  // Доильный блок
  for (const day of [1, 6, 10, 15, 20, 25, 30]) {
    pushFact(result, "sop-2-1-2", "per-gavrilov", day, "Секция доильного зала С-2");
    // Единица тарифа мойки — час
    pushFact(result, "sop-2-2-1", "per-gavrilov", day, "Молокопровод к-т 2", "done", day % 2 === 0 ? 2 : 1);
  }
  for (const day of [2, 5, 9, 13, 17, 21, 24, 28]) {
    pushFact(result, "sop-2-1-2", "per-noskova", day, "Секция доильного зала С-1");
    pushFact(result, "sop-2-2-1", "per-noskova", day, "Молокопровод к-т 1", "done", day % 3 === 0 ? 1.5 : 1);
  }

  return result;
}

function buildFacts(): SopFact[] {
  factCounter = 1;
  const all = [...buildCalfFacts(), ...buildOtherFacts()];
  return all.sort((a, b) =>
    a.factDate === b.factDate ? a.id.localeCompare(b.id) : a.factDate.localeCompare(b.factDate),
  );
}

export const sopFacts: SopFact[] = buildFacts();

export const sopFactById = new Map(sopFacts.map((f) => [f.id, f]));
