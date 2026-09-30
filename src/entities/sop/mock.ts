import type { Sop } from "./model";
import {
  getSopChildrenFrom,
  getSopNameFrom,
  getSopPathFrom,
  indexSops,
  listL3Sops,
} from "./helpers";

/**
 * Дерево СОП: 2 уровня L1 → 5 уровней L2 → 11 операций L3.
 * Методическое описание намеренно краткое — предмет этого прототипа не методология,
 * а тарификация и расчёт.
 */
export const sops: Sop[] = [
  // ─────────────── L1 ───────────────
  {
    id: "sop-1",
    code: "СОП-01",
    name: "Выращивание телят молочного периода",
    level: "L1_division",
    parentId: null,
    version: "3.0",
    status: "active",
    ownerPersonId: "per-morozov",
    effectiveFrom: "2026-01-01",
    methodSummary:
      "Свод правил содержания, кормления и контроля здоровья телят от рождения до отъёма.",
  },
  {
    id: "sop-2",
    code: "СОП-02",
    name: "Санитария и подготовка мест содержания",
    level: "L1_division",
    parentId: null,
    version: "2.1",
    status: "active",
    ownerPersonId: "per-morozov",
    effectiveFrom: "2026-01-01",
    methodSummary:
      "Требования к санитарной обработке мест содержания, подстилки и выпойного инвентаря.",
  },

  // ─────────────── L2 ───────────────
  {
    id: "sop-1-1",
    code: "СОП-01.01",
    name: "Приём и первичная обработка новорождённого",
    level: "L2_process",
    parentId: "sop-1",
    version: "3.0",
    status: "active",
    ownerPersonId: "per-orlova",
    effectiveFrom: "2026-01-01",
    methodSummary: "Действия персонала в первые 6 часов жизни телёнка.",
  },
  {
    id: "sop-1-2",
    code: "СОП-01.02",
    name: "Кормление телят",
    level: "L2_process",
    parentId: "sop-1",
    version: "3.0",
    status: "active",
    ownerPersonId: "per-orlova",
    effectiveFrom: "2026-01-01",
    methodSummary: "Схемы выпойки молозивом и заменителем цельного молока.",
  },
  {
    id: "sop-1-3",
    code: "СОП-01.03",
    name: "Контроль здоровья телят",
    level: "L2_process",
    parentId: "sop-1",
    version: "3.1",
    status: "active",
    ownerPersonId: "per-ivanova",
    effectiveFrom: "2026-03-01",
    methodSummary: "Ежедневный осмотр, выполнение назначений, контроль привесов.",
  },
  {
    id: "sop-2-1",
    code: "СОП-02.01",
    name: "Подготовка мест содержания",
    level: "L2_process",
    parentId: "sop-2",
    version: "2.1",
    status: "active",
    ownerPersonId: "per-kuznecov",
    effectiveFrom: "2026-01-01",
    methodSummary: "Освобождение, мойка, дезинфекция и подготовка домика к заселению.",
  },
  {
    id: "sop-2-2",
    code: "СОП-02.02",
    name: "Обработка инвентаря",
    level: "L2_process",
    parentId: "sop-2",
    version: "2.1",
    status: "active",
    ownerPersonId: "per-kuznecov",
    effectiveFrom: "2026-01-01",
    methodSummary: "Мойка и дезинфекция выпойного и вспомогательного инвентаря.",
  },

  // ─────────────── L3 ───────────────
  {
    id: "sop-1-1-1",
    code: "СОП-01.01.01",
    name: "Приём новорождённого телёнка",
    level: "L3_operation",
    parentId: "sop-1-1",
    version: "3.0",
    status: "active",
    ownerPersonId: "per-orlova",
    effectiveFrom: "2026-01-01",
    methodSummary:
      "Обсушивание, обработка пуповины, взвешивание при рождении, присвоение номера, перевод в индивидуальный домик.",
    operationObject: "animal",
    normUnit: "operation",
    isTariffable: true,
  },
  {
    id: "sop-1-1-2",
    code: "СОП-01.01.02",
    name: "Первая выпойка молозивом",
    level: "L3_operation",
    parentId: "sop-1-1",
    version: "3.0",
    status: "active",
    ownerPersonId: "per-orlova",
    effectiveFrom: "2026-01-01",
    methodSummary:
      "Выпойка не позднее 2 часов после рождения, контроль качества молозива рефрактометром, фиксация объёма.",
    operationObject: "animal",
    normUnit: "operation",
    isTariffable: true,
  },
  {
    id: "sop-1-2-1",
    code: "СОП-01.02.01",
    name: "Повторная выпойка молозивом",
    level: "L3_operation",
    parentId: "sop-1-2",
    version: "3.0",
    status: "active",
    ownerPersonId: "per-orlova",
    effectiveFrom: "2026-01-01",
    methodSummary: "Вторая и третья выпойки в первые сутки по схеме.",
    operationObject: "animal",
    normUnit: "operation",
    isTariffable: true,
  },
  {
    id: "sop-1-2-2",
    code: "СОП-01.02.02",
    name: "Выпойка ЗЦМ по схеме",
    level: "L3_operation",
    parentId: "sop-1-2",
    version: "3.2",
    status: "active",
    ownerPersonId: "per-orlova",
    effectiveFrom: "2026-01-01",
    methodSummary:
      "Приготовление и раздача заменителя цельного молока согласно возрастной схеме, контроль температуры.",
    operationObject: "group",
    normUnit: "operation",
    isTariffable: true,
  },
  {
    id: "sop-1-2-3",
    code: "СОП-01.02.03",
    name: "Выдача комбикорма",
    level: "L3_operation",
    parentId: "sop-1-2",
    version: "1.0",
    status: "active",
    ownerPersonId: "per-orlova",
    effectiveFrom: "2026-01-01",
    methodSummary:
      "Раздача стартерного комбикорма по группам телят, контроль остатков и чистоты кормушек.",
    operationObject: "group",
    normUnit: "operation",
    isTariffable: true,
  },
  {
    id: "sop-1-3-1",
    code: "СОП-01.03.01",
    name: "Ежедневный клинический осмотр",
    level: "L3_operation",
    parentId: "sop-1-3",
    version: "3.1",
    status: "active",
    ownerPersonId: "per-ivanova",
    effectiveFrom: "2026-03-01",
    methodSummary:
      "Оценка аппетита, стула, дыхания и общего состояния; фиксация отклонений в производственном контуре.",
    operationObject: "animal",
    normUnit: "operation",
    isTariffable: true,
  },
  {
    id: "sop-1-3-2",
    code: "СОП-01.03.02",
    name: "Выполнение ветеринарного назначения",
    level: "L3_operation",
    parentId: "sop-1-3",
    version: "3.1",
    status: "active",
    ownerPersonId: "per-ivanova",
    effectiveFrom: "2026-03-01",
    methodSummary: "Введение препарата по листу назначений, отметка о выполнении и сроке ожидания.",
    operationObject: "animal",
    normUnit: "operation",
    isTariffable: true,
  },
  {
    id: "sop-1-3-3",
    code: "СОП-01.03.03",
    name: "Контрольное взвешивание телёнка",
    level: "L3_operation",
    parentId: "sop-1-3",
    version: "1.0",
    status: "active",
    ownerPersonId: "per-ivanova",
    // Операция введена в середине года — тариф по ней ещё не установлен.
    effectiveFrom: "2026-08-15",
    methodSummary:
      "Плановое взвешивание на 30-й и 60-й день для контроля среднесуточного привеса.",
    operationObject: "animal",
    normUnit: "operation",
    isTariffable: true,
  },
  {
    id: "sop-2-1-1",
    code: "СОП-02.01.01",
    name: "Санитарная подготовка места содержания",
    level: "L3_operation",
    parentId: "sop-2-1",
    version: "2.1",
    status: "active",
    ownerPersonId: "per-kuznecov",
    effectiveFrom: "2026-01-01",
    methodSummary: "Мойка, дезинфекция и просушка домика перед заселением, оформление паспорта готовности.",
    operationObject: "housing",
    normUnit: "operation",
    isTariffable: true,
  },
  {
    id: "sop-2-1-2",
    code: "СОП-02.01.02",
    name: "Замена подстилки",
    level: "L3_operation",
    parentId: "sop-2-1",
    version: "2.1",
    status: "active",
    ownerPersonId: "per-kuznecov",
    effectiveFrom: "2026-01-01",
    methodSummary: "Удаление загрязнённой подстилки и закладка сухой соломы нормативным слоем.",
    operationObject: "housing",
    normUnit: "operation",
    isTariffable: true,
  },
  {
    id: "sop-2-2-1",
    code: "СОП-02.02.01",
    name: "Мойка и дезинфекция выпойного инвентаря",
    level: "L3_operation",
    parentId: "sop-2-2",
    version: "2.1",
    status: "active",
    ownerPersonId: "per-kuznecov",
    effectiveFrom: "2026-01-01",
    methodSummary: "Трёхэтапная мойка вёдер, сосок и зондов с контролем концентрации раствора.",
    operationObject: "inventory",
    normUnit: "operation",
    isTariffable: true,
  },
];

/** Статический индекс seed-дерева (генератор фактов, calcDemo). Runtime — state.sops. */
export const sopById = indexSops(sops);

export const l3Sops = listL3Sops(sops);

export function getSopName(sopId: string): string {
  return getSopNameFrom(sops, sopId);
}

export function getSopChildren(parentId: string | null): Sop[] {
  return getSopChildrenFrom(sops, parentId);
}

/** Путь от корня до СОП — для хлебных крошек в карточке. */
export function getSopPath(sopId: string): string[] {
  return getSopPathFrom(sops, sopId);
}
