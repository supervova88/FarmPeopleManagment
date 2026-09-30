import { sopFacts } from "@/entities/sopFact/mock";
import { isFactPerformer } from "@/entities/sopFact/model";
import type {
  DayPlanTemplate,
  WeekPlanAssignment,
  WeekPlanTemplate,
  WorkPlanItem,
} from "./model";
import { emptyWeekSlots } from "./model";

/**
 * Демо-план телятника вокруг DEMO_TODAY (2026-08-31) и первые дни сентября.
 * Часть задач на сегодня ещё открыта — специалист может взять и закрыть.
 * Часть прошлых/сегодняшних уже связана с существующими фактами.
 *
 * Шаблоны дня/недели и назначение Петровой на неделю 31.08–06.09 —
 * для сценария «подтвердить план недели».
 */

function findFactId(personId: string, date: string, sopId: string): string | null {
  const fact = sopFacts.find(
    (f) => f.factDate === date && f.sopId === sopId && isFactPerformer(f, personId),
  );
  return fact?.id ?? null;
}

let planCounter = 1;

function item(
  partial: Omit<WorkPlanItem, "id" | "assignmentId"> & {
    id?: string;
    assignmentId?: string | null;
  },
): WorkPlanItem {
  const id = partial.id ?? `plan-${String(planCounter).padStart(3, "0")}`;
  planCounter += 1;
  return { ...partial, id, assignmentId: partial.assignmentId ?? null };
}

/** Назначение Петровой на неделю DEMO_TODAY (пн 31.08.2026). */
export const DEMO_WEEK_ASSIGNMENT_ID = "wpa-petrova-2026-08-31";

export const dayPlanTemplates: DayPlanTemplate[] = [
  {
    id: "dpt-feeding",
    name: "Выпойка и кормление",
    divisionId: "div-calf",
    createdByPersonId: "per-kuznecov",
    status: "active",
    lines: [
      {
        id: "dpl-feed-1",
        sopId: "sop-1-2-2",
        objectLabel: "Группа Г-1 (16 гол.)",
        plannedQuantity: 2,
        sortOrder: 1,
      },
      {
        id: "dpl-feed-2",
        sopId: "sop-1-2-3",
        objectLabel: "Группа Г-2 (18 гол.)",
        plannedQuantity: 1,
        sortOrder: 2,
      },
    ],
  },
  {
    id: "dpt-housing",
    name: "Санитария домиков",
    divisionId: "div-calf",
    createdByPersonId: "per-kuznecov",
    status: "active",
    lines: [
      {
        id: "dpl-house-1",
        sopId: "sop-2-1-1",
        objectLabel: "Домик Д-05",
        plannedQuantity: 1,
        sortOrder: 1,
      },
      {
        id: "dpl-house-2",
        sopId: "sop-2-1-2",
        objectLabel: "Домик Д-03",
        plannedQuantity: 1,
        sortOrder: 2,
      },
    ],
  },
];

export const weekPlanTemplates: WeekPlanTemplate[] = [
  {
    id: "wpt-calf-5-2",
    name: "Стандарт 5/2 · телятник",
    divisionId: "div-calf",
    createdByPersonId: "per-kuznecov",
    status: "active",
    slots: emptyWeekSlots().map((slot) => {
      if (slot.weekday >= 1 && slot.weekday <= 4) {
        return { ...slot, dayTemplateId: "dpt-feeding" };
      }
      if (slot.weekday === 5) {
        return { ...slot, dayTemplateId: "dpt-housing" };
      }
      return slot;
    }),
  },
];

export const weekPlanAssignments: WeekPlanAssignment[] = [
  {
    id: DEMO_WEEK_ASSIGNMENT_ID,
    weekTemplateId: "wpt-calf-5-2",
    personId: "per-petrova",
    divisionId: "div-calf",
    weekStart: "2026-08-31",
    status: "assigned",
    assignedByPersonId: "per-kuznecov",
    acknowledgedAt: null,
    rejectComment: null,
  },
];

export const workPlanItems: WorkPlanItem[] = [
  // ── Неделя до сегодня: выполненные (с фактами) ──
  item({
    sopId: "sop-1-2-2",
    personId: "per-petrova",
    divisionId: "div-calf",
    plannedDate: "2026-08-27",
    objectLabel: "Группа Г-1 (16 гол.)",
    plannedQuantity: 1,
    status: "completed",
    source: "assigned",
    factId: findFactId("per-petrova", "2026-08-27", "sop-1-2-2"),
    createdByPersonId: "per-kuznecov",
  }),
  item({
    sopId: "sop-1-2-3",
    personId: "per-petrova",
    divisionId: "div-calf",
    plannedDate: "2026-08-28",
    objectLabel: "Группа Г-2 (18 гол.)",
    plannedQuantity: 1,
    status: "completed",
    source: "assigned",
    factId: findFactId("per-petrova", "2026-08-28", "sop-1-2-3"),
    createdByPersonId: "per-kuznecov",
  }),
  item({
    sopId: "sop-2-1-1",
    personId: "per-sidorov",
    divisionId: "div-calf",
    plannedDate: "2026-08-29",
    objectLabel: "Домик Д-22",
    plannedQuantity: 1,
    status: "completed",
    source: "assigned",
    factId: findFactId("per-sidorov", "2026-08-29", "sop-2-1-1"),
    createdByPersonId: "per-kuznecov",
  }),

  // ── Сегодня 31.08 — Петрова: задачи из назначения недели ──
  item({
    sopId: "sop-1-2-2",
    personId: "per-petrova",
    divisionId: "div-calf",
    plannedDate: "2026-08-31",
    objectLabel: "Группа Г-1 (16 гол.)",
    plannedQuantity: 2,
    status: "in_progress",
    source: "assigned",
    factId: null,
    createdByPersonId: "per-kuznecov",
    assignmentId: DEMO_WEEK_ASSIGNMENT_ID,
  }),
  item({
    sopId: "sop-1-2-3",
    personId: "per-petrova",
    divisionId: "div-calf",
    plannedDate: "2026-08-31",
    objectLabel: "Группа Г-2 (18 гол.)",
    plannedQuantity: 1,
    status: "planned",
    source: "assigned",
    factId: null,
    createdByPersonId: "per-kuznecov",
    assignmentId: DEMO_WEEK_ASSIGNMENT_ID,
  }),
  item({
    sopId: "sop-2-1-2",
    personId: "per-petrova",
    divisionId: "div-calf",
    plannedDate: "2026-08-31",
    objectLabel: "Домик Д-03",
    plannedQuantity: 1,
    status: "planned",
    source: "assigned",
    factId: null,
    createdByPersonId: "per-kuznecov",
    assignmentId: DEMO_WEEK_ASSIGNMENT_ID,
  }),
  item({
    sopId: "sop-2-1-1",
    personId: "per-petrova",
    divisionId: "div-calf",
    plannedDate: "2026-08-31",
    objectLabel: "Домик Д-05",
    plannedQuantity: 1,
    status: "completed",
    source: "assigned",
    factId: findFactId("per-petrova", "2026-08-31", "sop-2-1-1"),
    createdByPersonId: "per-kuznecov",
    assignmentId: DEMO_WEEK_ASSIGNMENT_ID,
  }),

  // ── Сегодня — Сидоров / Иванов ──
  item({
    sopId: "sop-1-2-2",
    personId: "per-sidorov",
    divisionId: "div-calf",
    plannedDate: "2026-08-31",
    objectLabel: "Группа Г-3 (14 гол.)",
    plannedQuantity: 1,
    status: "planned",
    source: "assigned",
    factId: null,
    createdByPersonId: "per-kuznecov",
  }),
  item({
    sopId: "sop-1-2-3",
    personId: "per-ivanov",
    divisionId: "div-calf",
    plannedDate: "2026-08-31",
    objectLabel: "Группа Г-4 (15 гол.)",
    plannedQuantity: 1,
    status: "in_progress",
    source: "assigned",
    factId: null,
    createdByPersonId: "per-kuznecov",
  }),

  // ── Сентябрь — Петрова (продолжение назначения) ──
  item({
    sopId: "sop-1-2-2",
    personId: "per-petrova",
    divisionId: "div-calf",
    plannedDate: "2026-09-01",
    objectLabel: "Группа Г-1 (16 гол.)",
    plannedQuantity: 2,
    status: "planned",
    source: "assigned",
    factId: null,
    createdByPersonId: "per-kuznecov",
    assignmentId: DEMO_WEEK_ASSIGNMENT_ID,
  }),
  item({
    sopId: "sop-1-2-3",
    personId: "per-petrova",
    divisionId: "div-calf",
    plannedDate: "2026-09-01",
    objectLabel: "Группа Г-2 (18 гол.)",
    plannedQuantity: 1,
    status: "planned",
    source: "assigned",
    factId: null,
    createdByPersonId: "per-kuznecov",
    assignmentId: DEMO_WEEK_ASSIGNMENT_ID,
  }),
  item({
    sopId: "sop-2-1-1",
    personId: "per-sidorov",
    divisionId: "div-calf",
    plannedDate: "2026-09-01",
    objectLabel: "Домик Д-21",
    plannedQuantity: 1,
    status: "planned",
    source: "assigned",
    factId: null,
    createdByPersonId: "per-kuznecov",
  }),
  item({
    sopId: "sop-1-2-2",
    personId: "per-volkova",
    divisionId: "div-calf",
    plannedDate: "2026-09-02",
    objectLabel: "Группа Г-5 (12 гол.)",
    plannedQuantity: 1,
    status: "planned",
    source: "assigned",
    factId: null,
    createdByPersonId: "per-kuznecov",
  }),
  item({
    sopId: "sop-2-1-2",
    personId: "per-ivanov",
    divisionId: "div-calf",
    plannedDate: "2026-09-02",
    objectLabel: "Домик Д-41",
    plannedQuantity: 1,
    status: "planned",
    source: "assigned",
    factId: null,
    createdByPersonId: "per-kuznecov",
  }),
  item({
    sopId: "sop-1-2-2",
    personId: "per-petrova",
    divisionId: "div-calf",
    plannedDate: "2026-09-03",
    objectLabel: "Группа Г-1 (16 гол.)",
    plannedQuantity: 1,
    status: "planned",
    source: "assigned",
    factId: null,
    createdByPersonId: "per-kuznecov",
    assignmentId: DEMO_WEEK_ASSIGNMENT_ID,
  }),
  item({
    sopId: "sop-1-2-3",
    personId: "per-sidorov",
    divisionId: "div-calf",
    plannedDate: "2026-09-03",
    objectLabel: "Группа Г-3 (14 гол.)",
    plannedQuantity: 1,
    status: "planned",
    source: "assigned",
    factId: null,
    createdByPersonId: "per-kuznecov",
  }),
];
