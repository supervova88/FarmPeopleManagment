import type { DemoRole, Person, RoleId } from "./model";
import { buildDemoRoles, formatPersonShortName } from "./model";

export const persons: Person[] = [
  // Телятник: 4 оператора + бригадир
  {
    id: "per-petrova",
    fullName: "Петрова Анна Сергеевна",
    personnelNumber: "ТН-1041",
    divisionId: "div-calf",
    jobTitle: "Оператор по уходу за телятами",
    status: "working",
    hiredAt: "2023-04-17",
    accessRoleId: "specialist",
  },
  {
    id: "per-sidorov",
    fullName: "Сидоров Пётр Ильич",
    personnelNumber: "ТН-1052",
    divisionId: "div-calf",
    jobTitle: "Оператор по уходу за телятами",
    status: "working",
    hiredAt: "2022-11-02",
    accessRoleId: null,
  },
  {
    id: "per-ivanov",
    fullName: "Иванов Сергей Алексеевич",
    personnelNumber: "ТН-1058",
    divisionId: "div-calf",
    jobTitle: "Оператор мойки инвентаря",
    status: "working",
    hiredAt: "2024-06-03",
    accessRoleId: null,
  },
  {
    id: "per-volkova",
    fullName: "Волкова Наталья Юрьевна",
    personnelNumber: "ТН-1074",
    divisionId: "div-calf",
    jobTitle: "Оператор по уходу за телятами",
    status: "working",
    hiredAt: "2024-02-12",
    accessRoleId: null,
  },
  {
    id: "per-lebedeva",
    fullName: "Лебедева Ирина Васильевна",
    personnelNumber: "ТН-1085",
    divisionId: "div-calf",
    jobTitle: "Оператор по уходу за телятами",
    status: "working",
    hiredAt: "2025-01-20",
    accessRoleId: null,
  },
  {
    id: "per-kuznecov",
    fullName: "Кузнецов Иван Николаевич",
    personnelNumber: "ТН-1007",
    divisionId: "div-calf",
    jobTitle: "Бригадир телятника",
    status: "working",
    hiredAt: "2019-02-25",
    accessRoleId: "foreman",
  },
  // Родильное отделение
  {
    id: "per-smirnova",
    fullName: "Смирнова Ольга Викторовна",
    personnelNumber: "ТН-2011",
    divisionId: "div-maternity",
    jobTitle: "Бригадир родильного отделения",
    status: "working",
    hiredAt: "2020-08-03",
    accessRoleId: null,
  },
  {
    id: "per-fedorov",
    fullName: "Фёдоров Денис Олегович",
    personnelNumber: "ТН-2024",
    divisionId: "div-maternity",
    jobTitle: "Оператор родильного отделения",
    status: "working",
    hiredAt: "2023-09-11",
    accessRoleId: null,
  },
  {
    id: "per-ivanova",
    fullName: "Иванова Мария Дмитриевна",
    personnelNumber: "ТН-1063",
    divisionId: "div-maternity",
    jobTitle: "Ветеринарный фельдшер",
    status: "working",
    hiredAt: "2021-06-14",
    accessRoleId: null,
  },
  // Доильный блок
  {
    id: "per-gavrilov",
    fullName: "Гаврилов Сергей Павлович",
    personnelNumber: "ТН-3005",
    divisionId: "div-milking",
    jobTitle: "Бригадир доильного блока",
    status: "working",
    hiredAt: "2018-05-21",
    accessRoleId: null,
  },
  {
    id: "per-noskova",
    fullName: "Носкова Татьяна Игоревна",
    personnelNumber: "ТН-3018",
    divisionId: "div-milking",
    jobTitle: "Оператор машинного доения",
    status: "vacation",
    hiredAt: "2022-03-30",
    accessRoleId: null,
  },
  // Методолог и управляющий — административно в телятнике
  {
    id: "per-orlova",
    fullName: "Орлова Елена Андреевна",
    personnelNumber: "ТН-0102",
    divisionId: "div-calf",
    jobTitle: "Методолог по тарифам",
    status: "working",
    hiredAt: "2020-01-20",
    accessRoleId: "tariff_methodologist",
  },
  {
    id: "per-morozov",
    fullName: "Морозов Алексей Валерьевич",
    personnelNumber: "ТН-0011",
    divisionId: "div-calf",
    jobTitle: "Управляющий по направлению",
    status: "working",
    hiredAt: "2017-10-09",
    accessRoleId: "direction_manager",
  },
  {
    id: "per-admin",
    fullName: "Администратор системы",
    personnelNumber: "ТН-0001",
    divisionId: "div-calf",
    jobTitle: "Администратор",
    status: "working",
    hiredAt: "2016-01-01",
    accessRoleId: "admin",
  },
];

export const personById = new Map(persons.map((p) => [p.id, p]));

export function getPersonName(
  personId: string | null | undefined,
  catalog: Person[] = persons,
): string {
  if (!personId) return "—";
  return catalog.find((p) => p.id === personId)?.fullName ?? personId;
}

/** «Петрова Анна Сергеевна» → «Петрова А. С.» */
export function getPersonShortName(
  personId: string | null | undefined,
  catalog: Person[] = persons,
): string {
  if (!personId) return "—";
  const person = catalog.find((p) => p.id === personId);
  if (!person) return personId;
  return formatPersonShortName(person.fullName);
}

/** @deprecated Используйте buildDemoRoles(state.persons). Оставлено для AccessDenied fallback. */
export const demoRoles: DemoRole[] = buildDemoRoles(persons);

export const demoRoleById = new Map(demoRoles.map((r) => [r.id, r]));

export function getRole(roleId: RoleId, catalog: Person[] = persons): DemoRole {
  const roles = buildDemoRoles(catalog);
  return roles.find((r) => r.id === roleId) ?? roles[0] ?? demoRoles[0];
}
