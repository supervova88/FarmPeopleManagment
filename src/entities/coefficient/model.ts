/**
 * КоэффициентПериода — множитель, действующий НА ВЕСЬ расчётный период целиком.
 * Разбивка внутри периода намеренно не поддерживается: у сущности нет полей дат,
 * только ссылка на период.
 */
export type CoefficientScope = "division" | "person";

export type CoefficientStatus = "active" | "archived";

export interface PeriodCoefficient {
  id: string;
  /** Тип области действия */
  scope: CoefficientScope;
  /** Ссылка на Division или Person в зависимости от scope */
  targetId: string;
  /** Ссылка на TimesheetPeriod — коэффициент привязан к периоду, а не к операции */
  periodId: string;
  /** Значение множителя: 1.10 = +10 %, 0.95 = −5 % */
  value: number;
  /** Основание */
  reason: string;
  /** Установил — ссылка на Person */
  setByPersonId: string;
  status: CoefficientStatus;
}

export const COEFFICIENT_SCOPE_LABEL: Record<CoefficientScope, string> = {
  division: "Подразделение",
  person: "Физическое лицо",
};

export const COEFFICIENT_STATUS_LABEL: Record<CoefficientStatus, string> = {
  active: "Действует",
  archived: "Архив",
};
