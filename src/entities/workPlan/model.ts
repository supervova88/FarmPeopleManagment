/**
 * Календарный план работ и шаблоны «день → неделя → назначение».
 * План не создаёт оплату — табельная позиция появляется только после
 * подтверждения исполнения (создание SopFact → TimesheetLine).
 */
export type WorkPlanStatus = "planned" | "in_progress" | "completed" | "skipped";

export type WorkPlanSource = "assigned" | "self_picked";

export type PlanTemplateStatus = "draft" | "active" | "archived";

/** ISO weekday: 1 = понедельник … 7 = воскресенье. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type WeekPlanAssignmentStatus =
  | "assigned"
  | "acknowledged"
  | "rejected"
  | "cancelled";

/** Строка шаблона рабочего дня (операция СОП L3). */
export interface DayPlanLine {
  id: string;
  sopId: string;
  objectLabel: string;
  plannedQuantity: number;
  sortOrder: number;
}

/** Именованный набор операций на один рабочий день. */
export interface DayPlanTemplate {
  id: string;
  name: string;
  divisionId: string;
  createdByPersonId: string;
  status: PlanTemplateStatus;
  lines: DayPlanLine[];
}

/** Слот шаблона недели: день недели → дневной план или выходной. */
export interface WeekPlanSlot {
  weekday: Weekday;
  dayTemplateId: string | null;
}

/** Раскладка Пн–Вс из дневных планов (ещё без человека и дат). */
export interface WeekPlanTemplate {
  id: string;
  name: string;
  divisionId: string;
  createdByPersonId: string;
  status: PlanTemplateStatus;
  slots: WeekPlanSlot[];
}

/** Назначение шаблона недели специалисту на конкретную календарную неделю. */
export interface WeekPlanAssignment {
  id: string;
  weekTemplateId: string;
  personId: string;
  divisionId: string;
  /** Понедельник недели, ISO yyyy-mm-dd */
  weekStart: string;
  status: WeekPlanAssignmentStatus;
  assignedByPersonId: string;
  acknowledgedAt: string | null;
  rejectComment: string | null;
}

export interface WorkPlanItem {
  id: string;
  sopId: string;
  personId: string;
  divisionId: string;
  /** Плановая дата, ISO yyyy-mm-dd */
  plannedDate: string;
  objectLabel: string;
  plannedQuantity: number;
  status: WorkPlanStatus;
  source: WorkPlanSource;
  /** Заполняется при plan/complete */
  factId: string | null;
  createdByPersonId: string;
  /** Связь с назначением недели; null у разовых задач */
  assignmentId: string | null;
}

export const WORK_PLAN_STATUS_LABEL: Record<WorkPlanStatus, string> = {
  planned: "В плане",
  in_progress: "В работе",
  completed: "Выполнено",
  skipped: "Не выполнено",
};

export const WORK_PLAN_SOURCE_LABEL: Record<WorkPlanSource, string> = {
  assigned: "Назначил бригадир",
  self_picked: "Подобрал сам",
};

export const PLAN_TEMPLATE_STATUS_LABEL: Record<PlanTemplateStatus, string> = {
  draft: "Черновик",
  active: "Активный",
  archived: "Архив",
};

export const WEEK_PLAN_ASSIGNMENT_STATUS_LABEL: Record<WeekPlanAssignmentStatus, string> = {
  assigned: "Ожидает подтверждения",
  acknowledged: "Подтверждён",
  rejected: "Отклонён",
  cancelled: "Отменён",
};

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
  7: "Вс",
};

export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];

/** Задачу ещё можно править / брать в работу / исполнять. */
export function isPlanItemOpen(item: Pick<WorkPlanItem, "status">): boolean {
  return item.status === "planned" || item.status === "in_progress";
}

/** Назначение ещё открыто для специалиста (не отменено). */
export function isAssignmentOpen(
  a: Pick<WeekPlanAssignment, "status">,
): boolean {
  return a.status === "assigned" || a.status === "acknowledged" || a.status === "rejected";
}

/** Пустые слоты Пн–Вс. */
export function emptyWeekSlots(): WeekPlanSlot[] {
  return WEEKDAYS.map((weekday) => ({ weekday, dayTemplateId: null }));
}
