import type { Division } from "./model";

/**
 * Оргструктура фермы «Василево». Домики, дворы и секции здесь намеренно отсутствуют:
 * место содержания — это не подразделение.
 */
export const divisions: Division[] = [
  {
    id: "div-calf",
    code: "ПОДР-01",
    name: "Телятник",
    parentId: null,
    farmName: "Василево",
    headPersonId: "per-kuznecov",
    status: "active",
  },
  {
    id: "div-maternity",
    code: "ПОДР-02",
    name: "Родильное отделение",
    parentId: null,
    farmName: "Василево",
    headPersonId: "per-smirnova",
    status: "active",
  },
  {
    id: "div-milking",
    code: "ПОДР-03",
    name: "Доильный блок",
    parentId: null,
    farmName: "Василево",
    headPersonId: "per-gavrilov",
    status: "active",
  },
];

export const divisionById = new Map(divisions.map((d) => [d.id, d]));

export function getDivisionName(
  divisionId: string | null | undefined,
  catalog: Division[] = divisions,
): string {
  if (!divisionId) return "—";
  return catalog.find((d) => d.id === divisionId)?.name ?? divisionId;
}
