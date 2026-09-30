import type { TimesheetPeriod } from "./model";

/** Расчётный период — один на подразделение за месяц. Демо: август + сентябрь 2026. */
export const PERIOD_LABEL = "Август 2026";
export const PERIOD_DATE_FROM = "2026-08-01";
export const PERIOD_DATE_TO = "2026-08-31";

export const PERIOD_LABEL_SEP = "Сентябрь 2026";
export const PERIOD_DATE_FROM_SEP = "2026-09-01";
export const PERIOD_DATE_TO_SEP = "2026-09-30";

export const timesheetPeriods: TimesheetPeriod[] = [
  {
    id: "tsp-calf-2026-08",
    divisionId: "div-calf",
    periodLabel: PERIOD_LABEL,
    dateFrom: PERIOD_DATE_FROM,
    dateTo: PERIOD_DATE_TO,
    status: "open",
    checkedByPersonId: null,
    approvedByPersonId: null,
  },
  {
    id: "tsp-maternity-2026-08",
    divisionId: "div-maternity",
    periodLabel: PERIOD_LABEL,
    dateFrom: PERIOD_DATE_FROM,
    dateTo: PERIOD_DATE_TO,
    status: "open",
    checkedByPersonId: null,
    approvedByPersonId: null,
  },
  {
    id: "tsp-milking-2026-08",
    divisionId: "div-milking",
    periodLabel: PERIOD_LABEL,
    dateFrom: PERIOD_DATE_FROM,
    dateTo: PERIOD_DATE_TO,
    // Доильный блок бригадир уже проверил — период ушёл на утверждение
    status: "in_review",
    checkedByPersonId: "per-gavrilov",
    approvedByPersonId: null,
  },
  // Сентябрь 2026 — открытые пустые периоды (переключение месяца в блоке «Расчёт»)
  {
    id: "tsp-calf-2026-09",
    divisionId: "div-calf",
    periodLabel: PERIOD_LABEL_SEP,
    dateFrom: PERIOD_DATE_FROM_SEP,
    dateTo: PERIOD_DATE_TO_SEP,
    status: "open",
    checkedByPersonId: null,
    approvedByPersonId: null,
  },
  {
    id: "tsp-maternity-2026-09",
    divisionId: "div-maternity",
    periodLabel: PERIOD_LABEL_SEP,
    dateFrom: PERIOD_DATE_FROM_SEP,
    dateTo: PERIOD_DATE_TO_SEP,
    status: "open",
    checkedByPersonId: null,
    approvedByPersonId: null,
  },
  {
    id: "tsp-milking-2026-09",
    divisionId: "div-milking",
    periodLabel: PERIOD_LABEL_SEP,
    dateFrom: PERIOD_DATE_FROM_SEP,
    dateTo: PERIOD_DATE_TO_SEP,
    status: "open",
    checkedByPersonId: null,
    approvedByPersonId: null,
  },
];

/** Первый (августовский) период подразделения — для seed фактов. */
export const periodByDivisionId = new Map(
  timesheetPeriods
    .filter((p) => p.dateFrom.startsWith("2026-08"))
    .map((p) => [p.divisionId, p]),
);
