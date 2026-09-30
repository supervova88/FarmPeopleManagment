/** ФизическоеЛицо — сотрудник, выполняющий операции и получающий сдельную оплату. */
export type PersonStatus = "working" | "dismissed" | "vacation" | "sick_leave";

export interface Person {
  id: string;
  fullName: string;
  /** Табельный номер */
  personnelNumber: string;
  /** Основное подразделение (оргструктура) */
  divisionId: string;
  jobTitle: string;
  status: PersonStatus;
  /** Дата приёма, ISO yyyy-mm-dd */
  hiredAt: string;
  /**
   * Уровень доступа в демо-переключателе ролей.
   * null — сотрудник только в справочнике / табеле, в шапку не попадает.
   * На один RoleId — не больше одного человека.
   */
  accessRoleId: RoleId | null;
}

export const PERSON_STATUS_LABEL: Record<PersonStatus, string> = {
  working: "Работает",
  dismissed: "Уволен",
  vacation: "Отпуск",
  sick_leave: "Больничный",
};

/** Роли демо-переключателя в шапке. */
export type RoleId =
  | "specialist"
  | "foreman"
  | "tariff_methodologist"
  | "direction_manager"
  | "admin";

export interface DemoRole {
  id: RoleId;
  /** Ссылка на Person, от лица которого работает демо */
  personId: string;
  title: string;
  shortTitle: string;
}

export const ROLE_SHORT_LABEL: Record<RoleId, string> = {
  specialist: "Специалист",
  foreman: "Бригадир",
  tariff_methodologist: "Методолог",
  direction_manager: "Управляющий",
  admin: "Администратор",
};

export const ROLE_FULL_LABEL: Record<RoleId, string> = {
  specialist: "Специалист",
  foreman: "Бригадир",
  tariff_methodologist: "Методолог по тарифам",
  direction_manager: "Управляющий по направлению",
  admin: "Администратор",
};

/** Порядок ролей в переключателе шапки. */
export const ROLE_ORDER: RoleId[] = [
  "specialist",
  "foreman",
  "tariff_methodologist",
  "direction_manager",
  "admin",
];

/** Краткое ФИО: «Петрова Анна Сергеевна» → «Петрова А. С.» */
export function formatPersonShortName(fullName: string): string {
  const [last, first, middle] = fullName.split(" ");
  const initials = [first, middle].filter(Boolean).map((n) => `${n[0]}.`).join(" ");
  return initials ? `${last} ${initials}` : last;
}

/** Собирает пункты переключателя ролей из справочника сотрудников. */
export function buildDemoRoles(persons: Person[]): DemoRole[] {
  const byRole = new Map<RoleId, Person>();
  for (const person of persons) {
    if (!person.accessRoleId) continue;
    if (!byRole.has(person.accessRoleId)) byRole.set(person.accessRoleId, person);
  }

  return ROLE_ORDER.filter((id) => byRole.has(id)).map((id) => {
    const person = byRole.get(id)!;
    const short = formatPersonShortName(person.fullName);
    return {
      id,
      personId: person.id,
      shortTitle: ROLE_SHORT_LABEL[id],
      title: `${ROLE_FULL_LABEL[id]} — ${short}`,
    };
  });
}
