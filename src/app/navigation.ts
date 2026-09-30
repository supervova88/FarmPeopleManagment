import type { RoleId } from "@/entities/person/model";

export interface NavItem {
  to: string;
  label: string;
  /** Роли, которым раздел доступен */
  roles: RoleId[];
  group: "Методология" | "Расчёт" | "Служебное" | "Администрирование";
}

/** Роли производственного контура (без администратора). */
export const BUSINESS_ROLES: RoleId[] = [
  "specialist",
  "foreman",
  "tariff_methodologist",
  "direction_manager",
];

export const ALL_ROLES: RoleId[] = [...BUSINESS_ROLES, "admin"];

export const navItems: NavItem[] = [
  { to: "/sops", label: "Реестр СОП", roles: BUSINESS_ROLES, group: "Методология" },
  {
    to: "/tariffs",
    label: "Управление тарифами",
    roles: ["tariff_methodologist", "direction_manager"],
    group: "Методология",
  },
  {
    to: "/pay-schemes",
    label: "Схемы оплаты",
    roles: ["tariff_methodologist", "direction_manager"],
    group: "Методология",
  },
  {
    to: "/my-operations",
    label: "Мои операции",
    roles: ["specialist", "foreman"],
    group: "Расчёт",
  },
  {
    to: "/work-plans",
    label: "Планы работ",
    roles: ["foreman", "direction_manager"],
    group: "Расчёт",
  },
  {
    to: "/timesheet",
    label: "Табель подразделения",
    roles: ["foreman", "direction_manager"],
    group: "Расчёт",
  },
  {
    to: "/timesheet-calendar",
    label: "Календарный план",
    roles: ["foreman", "direction_manager"],
    group: "Расчёт",
  },
  {
    to: "/period-approval",
    label: "Утверждение периода",
    roles: ["direction_manager"],
    group: "Расчёт",
  },
  {
    to: "/admin",
    label: "Пользователи и подразделения",
    roles: ["admin"],
    group: "Администрирование",
  },
  { to: "/calc-check", label: "Проверка расчёта", roles: ALL_ROLES, group: "Служебное" },
];

export function isRouteAllowed(path: string, roleId: RoleId): boolean {
  const item = [...navItems]
    .sort((a, b) => b.to.length - a.to.length)
    .find((n) => path === n.to || path.startsWith(`${n.to}/`));
  if (!item) return true;
  return item.roles.includes(roleId);
}

/** Куда отправить роль после переключения, если текущий раздел ей недоступен. */
export function defaultRouteForRole(roleId: RoleId): string {
  switch (roleId) {
    case "specialist":
      return "/my-operations";
    case "foreman":
      return "/timesheet";
    case "tariff_methodologist":
      return "/tariffs";
    case "direction_manager":
      return "/period-approval";
    case "admin":
      return "/admin";
    default:
      return "/sops";
  }
}
