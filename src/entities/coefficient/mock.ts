import type { PeriodCoefficient } from "./model";

/**
 * Коэффициенты действуют на весь расчётный период целиком.
 * У телятника коэффициенты = 1.0: разброс зарплат задаётся только выработкой.
 */
export const periodCoefficients: PeriodCoefficient[] = [
  {
    id: "coef-div-calf",
    scope: "division",
    targetId: "div-calf",
    periodId: "tsp-calf-2026-08",
    value: 1.0,
    reason: "Базовый период: коэффициент подразделения не применяется (1,00)",
    setByPersonId: "per-kuznecov",
    status: "active",
  },
  {
    id: "coef-div-maternity",
    scope: "division",
    targetId: "div-maternity",
    periodId: "tsp-maternity-2026-08",
    value: 1.03,
    reason: "Выполнение норматива по выпойке молозива в первые 2 часа",
    setByPersonId: "per-smirnova",
    status: "active",
  },
];
