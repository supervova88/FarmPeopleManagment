/**
 * Подразделение — ОРГСТРУКТУРА (кто где числится административно).
 * Это НЕ технологическое место содержания животных (домик/двор/ферма).
 * Физическое место выполнения операции живёт в поле objectLabel сущности SopFact.
 */
export type DivisionStatus = "active" | "closed";

export interface Division {
  id: string;
  /** Код подразделения */
  code: string;
  /** Наименование, например «Телятник» */
  name: string;
  /** Родительское подразделение для иерархии оргструктуры */
  parentId: string | null;
  /** Ферма/площадка, к которой относится подразделение */
  farmName: string;
  /** Руководитель — ссылка на Person */
  headPersonId: string;
  status: DivisionStatus;
}

export const DIVISION_STATUS_LABEL: Record<DivisionStatus, string> = {
  active: "Активно",
  closed: "Закрыто",
};
