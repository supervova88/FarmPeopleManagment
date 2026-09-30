import type { Division } from "@/entities/division/model";
import type { PayScheme } from "@/entities/payScheme/model";
import type { Person, RoleId } from "@/entities/person/model";
import { getDescendantIds, hasSopChildren, indexSops } from "@/entities/sop/helpers";
import type { Sop } from "@/entities/sop/model";
import type { SopFact } from "@/entities/sopFact/model";
import { factPerformers } from "@/entities/sopFact/model";
import type { SopTariff } from "@/entities/tariff/model";
import type { TimesheetLine, TimesheetPeriod } from "@/entities/timesheet/model";
import {
  formatMonthLabel,
  listMonthOptions,
  mondayOfWeek,
  monthBounds,
  monthKeyFromPeriod,
  periodIdForDivisionMonth,
} from "@/entities/timesheet/periodView";
import {
  isPlanItemOpen,
  type DayPlanLine,
  type DayPlanTemplate,
  type WeekPlanAssignment,
  type WeekPlanSlot,
  type WeekPlanTemplate,
  type Weekday,
  type WorkPlanItem,
  WEEKDAYS,
} from "@/entities/workPlan/model";
import { buildLineFromFact, recalcLineWithTariffs } from "@/features/payroll/buildTimesheet";
import { DEMO_TODAY, previousDay, shiftDate, uid } from "@/shared/lib/utils";
import type { AppAction, DivisionUpsertPayload, PersonUpsertPayload } from "./actions";
import { buildInitialData, makeEntryId, type AppData } from "./seed";

export interface AppState extends AppData {
  currentRoleId: RoleId;
}

export function createInitialState(): AppState {
  return { currentRoleId: "specialist", ...buildInitialData() };
}

function findPeriodForDate(
  state: AppState,
  divisionId: string,
  date: string,
): TimesheetPeriod | undefined {
  return state.periods.find(
    (p) => p.divisionId === divisionId && p.dateFrom <= date && date <= p.dateTo,
  );
}

function isPeriodEditable(period: TimesheetPeriod | undefined): boolean {
  if (!period) return false;
  return period.status !== "approved" && period.status !== "closed";
}

function normalizeDayPlanLines(
  state: AppState,
  raw: Array<{
    sopId: string;
    objectLabel: string;
    plannedQuantity: number;
    sortOrder?: number;
  }>,
): DayPlanLine[] | null {
  const sopIndex = indexSops(state.sops);
  const lines: DayPlanLine[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i]!;
    const sop = sopIndex.get(row.sopId);
    if (!sop || sop.level !== "L3_operation" || sop.status === "archived") return null;
    const qty = row.plannedQuantity;
    if (typeof qty !== "number" || !Number.isFinite(qty) || qty <= 0) return null;
    const objectLabel = row.objectLabel.trim();
    if (!objectLabel) return null;
    lines.push({
      id: uid("dpl"),
      sopId: sop.id,
      objectLabel,
      plannedQuantity: qty,
      sortOrder: row.sortOrder ?? i + 1,
    });
  }
  return lines;
}

function normalizeWeekSlots(
  state: AppState,
  divisionId: string,
  raw: WeekPlanSlot[],
): WeekPlanSlot[] | null {
  const byWeekday = new Map<Weekday, string | null>();
  for (const weekday of WEEKDAYS) byWeekday.set(weekday, null);

  for (const slot of raw) {
    if (!WEEKDAYS.includes(slot.weekday as Weekday)) return null;
    if (slot.dayTemplateId) {
      const day = (state.dayPlanTemplates ?? []).find((t) => t.id === slot.dayTemplateId);
      if (!day || day.status !== "active" || day.divisionId !== divisionId) return null;
      byWeekday.set(slot.weekday as Weekday, day.id);
    } else {
      byWeekday.set(slot.weekday as Weekday, null);
    }
  }

  return WEEKDAYS.map((weekday) => ({
    weekday,
    dayTemplateId: byWeekday.get(weekday) ?? null,
  }));
}

/**
 * Создаёт факт и табельные линии для исполнителей (общая логика fact/create и plan/complete).
 * Возвращает null, если валидация не прошла.
 */
function appendFactWithLines(
  state: AppState,
  payload: {
    sopId: string;
    performerPersonIds: string[];
    objectLabel: string;
    factDate: string;
    factStatus?: SopFact["factStatus"];
    quantity?: number;
  },
): { facts: SopFact[]; entries: AppState["entries"]; lines: TimesheetLine[]; fact: SopFact } | null {
  const sop = indexSops(state.sops).get(payload.sopId);
  if (!sop || sop.level !== "L3_operation" || sop.status === "archived") {
    return null;
  }

  const performerIds = factPerformers({
    performerPersonIds: payload.performerPersonIds ?? [],
  });
  if (performerIds.length === 0) return null;

  const performers = performerIds
    .map((id) => state.persons.find((p) => p.id === id))
    .filter((p): p is Person => Boolean(p));
  if (performers.length !== performerIds.length) return null;

  const primary = performers[0]!;
  const period = findPeriodForDate(state, primary.divisionId, payload.factDate);
  if (!isPeriodEditable(period) || !period) return null;
  if (performers.some((p) => p.divisionId !== primary.divisionId)) return null;

  const quantityRaw = payload.quantity ?? 1;
  const quantity =
    typeof quantityRaw === "number" && Number.isFinite(quantityRaw) && quantityRaw > 0
      ? quantityRaw
      : null;
  if (quantity === null) return null;

  const fact: SopFact = {
    id: uid("fact"),
    sopId: sop.id,
    sopVersion: sop.version,
    performerPersonIds: performerIds,
    objectLabel: payload.objectLabel.trim() || "Объект не указан",
    factDate: payload.factDate,
    factStatus: payload.factStatus ?? "done",
    quantity,
  };

  let entries = state.entries;
  const newLines: TimesheetLine[] = [];

  for (const performer of performers) {
    let entry = entries.find((e) => e.periodId === period.id && e.personId === performer.id);
    if (!entry) {
      const divisionCoefficient = state.coefficients.find(
        (c) =>
          c.scope === "division" &&
          c.targetId === performer.divisionId &&
          c.periodId === period.id &&
          c.status === "active",
      );
      const personCoefficient = state.coefficients.find(
        (c) =>
          c.scope === "person" &&
          c.targetId === performer.id &&
          c.periodId === period.id &&
          c.status === "active",
      );
      entry = {
        id: makeEntryId(period.id, performer.id),
        periodId: period.id,
        personId: performer.id,
        status: "draft",
        divisionCoefficientId: divisionCoefficient?.id ?? null,
        personCoefficientId: personCoefficient?.id ?? null,
      };
      entries = [...entries, entry];
    }

    const line = buildLineFromFact({
      fact,
      sop,
      performer,
      tariffs: state.tariffs,
      entryId: entry.id,
    });
    if (line) newLines.push(line);
  }

  return {
    fact,
    facts: [...state.facts, fact],
    entries,
    lines: newLines.length > 0 ? [...state.lines, ...newLines] : state.lines,
  };
}

/**
 * Пересчёт всех позиций сотрудников после изменения набора тарифов.
 * Именно здесь отрабатывает правило «тариф задан задним числом → суммы появились».
 */
function recalcAllLines(state: AppState, tariffs: SopTariff[]): TimesheetLine[] {
  const personById = new Map(state.persons.map((p) => [p.id, p]));
  const personIdByEntryId = new Map(state.entries.map((e) => [e.id, e.personId]));
  return state.lines.map((line) => {
    const person = personById.get(personIdByEntryId.get(line.entryId) ?? "");
    if (!person) return line;
    return recalcLineWithTariffs(line, person, tariffs);
  });
}

function parentLevelFor(level: Sop["level"]): Sop["level"] | null {
  if (level === "L1_division") return null;
  if (level === "L2_process") return "L1_division";
  return "L2_process";
}

/** На один RoleId — один сотрудник; с прежнего назначения роль снимается. */
function withUniqueAccessRole(
  persons: Person[],
  personId: string,
  accessRoleId: RoleId | null,
): Person[] {
  return persons.map((p) => {
    if (p.id === personId) return { ...p, accessRoleId };
    if (accessRoleId && p.accessRoleId === accessRoleId) return { ...p, accessRoleId: null };
    return p;
  });
}

function isLastAdmin(persons: Person[], personId: string): boolean {
  const admins = persons.filter((p) => p.accessRoleId === "admin");
  return admins.length === 1 && admins[0]?.id === personId;
}

function normalizePersonPayload(payload: PersonUpsertPayload): PersonUpsertPayload | null {
  const fullName = payload.fullName.trim();
  const personnelNumber = payload.personnelNumber.trim();
  const jobTitle = payload.jobTitle.trim();
  if (!fullName || !personnelNumber || !jobTitle || !payload.divisionId || !payload.hiredAt) {
    return null;
  }
  return { ...payload, fullName, personnelNumber, jobTitle };
}

function normalizeDivisionPayload(payload: DivisionUpsertPayload): DivisionUpsertPayload | null {
  const code = payload.code.trim();
  const name = payload.name.trim();
  const farmName = payload.farmName.trim() || "Василево";
  if (!code || !name || !payload.headPersonId) return null;
  return { ...payload, code, name, farmName };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "role/set":
      return { ...state, currentRoleId: action.roleId };

    // ─────────────── Справочники (админ) ───────────────
    case "person/create": {
      const payload = normalizePersonPayload(action.payload);
      if (!payload) return state;
      if (!state.divisions.some((d) => d.id === payload.divisionId)) return state;
      if (state.persons.some((p) => p.personnelNumber === payload.personnelNumber)) return state;

      const id = uid("per");
      const created: Person = { id, ...payload };
      let persons = [...state.persons, created];
      persons = withUniqueAccessRole(persons, id, payload.accessRoleId);
      return { ...state, persons };
    }

    case "person/update": {
      const payload = normalizePersonPayload(action.payload);
      if (!payload) return state;
      const existing = state.persons.find((p) => p.id === action.personId);
      if (!existing) return state;
      if (!state.divisions.some((d) => d.id === payload.divisionId)) return state;
      if (
        state.persons.some(
          (p) => p.id !== action.personId && p.personnelNumber === payload.personnelNumber,
        )
      ) {
        return state;
      }

      if (
        isLastAdmin(state.persons, action.personId) &&
        payload.accessRoleId !== "admin"
      ) {
        return state;
      }

      let persons = state.persons.map((p) =>
        p.id === action.personId ? { ...p, ...payload } : p,
      );
      persons = withUniqueAccessRole(persons, action.personId, payload.accessRoleId);
      return { ...state, persons };
    }

    case "person/setStatus": {
      const existing = state.persons.find((p) => p.id === action.personId);
      if (!existing) return state;
      if (
        action.status === "dismissed" &&
        isLastAdmin(state.persons, action.personId)
      ) {
        return state;
      }
      return {
        ...state,
        persons: state.persons.map((p) =>
          p.id === action.personId ? { ...p, status: action.status } : p,
        ),
      };
    }

    case "division/create": {
      const payload = normalizeDivisionPayload(action.payload);
      if (!payload) return state;
      if (!state.persons.some((p) => p.id === payload.headPersonId)) return state;
      if (payload.parentId && !state.divisions.some((d) => d.id === payload.parentId)) {
        return state;
      }
      if (state.divisions.some((d) => d.code === payload.code)) return state;

      const id = uid("div");
      const created: Division = { id, ...payload };
      // Периоды по уже открытым месяцам; новый месяц доберёт period/ensureMonth
      const openMonths = listMonthOptions(state.periods);
      const monthsForNew =
        openMonths.length > 0
          ? openMonths
          : [{ monthKey: "2026-08", label: formatMonthLabel("2026-08") }];
      const newPeriods: TimesheetPeriod[] = monthsForNew.map((month) => {
        const { dateFrom, dateTo } = monthBounds(month.monthKey);
        return {
          id: periodIdForDivisionMonth(id, month.monthKey),
          divisionId: id,
          periodLabel: month.label,
          dateFrom,
          dateTo,
          status: "open" as const,
          checkedByPersonId: null,
          approvedByPersonId: null,
        };
      });

      return {
        ...state,
        divisions: [...state.divisions, created],
        periods: [...state.periods, ...newPeriods],
      };
    }

    case "division/update": {
      const payload = normalizeDivisionPayload(action.payload);
      if (!payload) return state;
      const existing = state.divisions.find((d) => d.id === action.divisionId);
      if (!existing) return state;
      if (!state.persons.some((p) => p.id === payload.headPersonId)) return state;
      if (payload.parentId === action.divisionId) return state;
      if (payload.parentId && !state.divisions.some((d) => d.id === payload.parentId)) {
        return state;
      }
      if (
        state.divisions.some((d) => d.id !== action.divisionId && d.code === payload.code)
      ) {
        return state;
      }

      return {
        ...state,
        divisions: state.divisions.map((d) =>
          d.id === action.divisionId ? { ...d, ...payload } : d,
        ),
      };
    }

    case "division/setStatus": {
      if (!state.divisions.some((d) => d.id === action.divisionId)) return state;
      return {
        ...state,
        divisions: state.divisions.map((d) =>
          d.id === action.divisionId ? { ...d, status: action.status } : d,
        ),
      };
    }

    // ─────────────── СОП ───────────────
    case "sop/create": {
      const { payload } = action;
      const code = payload.code.trim();
      const name = payload.name.trim();
      if (!code || !name || !payload.effectiveFrom) return state;

      const expectedParentLevel = parentLevelFor(payload.level);
      if (expectedParentLevel === null) {
        if (payload.parentId !== null) return state;
      } else {
        if (!payload.parentId) return state;
        const parent = state.sops.find((s) => s.id === payload.parentId);
        if (!parent || parent.level !== expectedParentLevel) return state;
      }

      if (state.sops.some((s) => s.code === code || s.id === payload.id)) return state;

      const sop: Sop = {
        id: payload.id,
        code,
        name,
        level: payload.level,
        parentId: payload.parentId,
        version: payload.version.trim() || "1.0",
        status: "active",
        ownerPersonId: payload.ownerPersonId,
        effectiveFrom: payload.effectiveFrom,
        methodSummary: payload.methodSummary.trim() || "Описание не задано.",
      };

      if (payload.level === "L3_operation") {
        sop.operationObject = payload.operationObject ?? "other";
        sop.normUnit = "operation";
        sop.isTariffable = payload.isTariffable ?? true;
      }

      return { ...state, sops: [...state.sops, sop] };
    }

    case "sop/update": {
      const { payload } = action;
      const existing = state.sops.find((s) => s.id === payload.id);
      if (!existing) return state;

      const code = payload.code.trim();
      const name = payload.name.trim();
      if (!code || !name || !payload.effectiveFrom) return state;
      if (state.sops.some((s) => s.code === code && s.id !== payload.id)) return state;

      const nextLevel = payload.level;
      if (nextLevel !== existing.level && hasSopChildren(state.sops, existing.id)) {
        // Перенос уровня при наличии детей ломает иерархию L1→L2→L3
        return state;
      }

      const expectedParentLevel = parentLevelFor(nextLevel);
      if (expectedParentLevel === null) {
        if (payload.parentId !== null) return state;
      } else {
        if (!payload.parentId) return state;
        if (payload.parentId === payload.id) return state;
        const parent = state.sops.find((s) => s.id === payload.parentId);
        if (!parent || parent.level !== expectedParentLevel) return state;
        if (parent.status === "archived") return state;
        const descendantIds = new Set(getDescendantIds(state.sops, payload.id));
        if (descendantIds.has(payload.parentId)) return state;
      }

      const updated: Sop = {
        ...existing,
        code,
        name,
        level: nextLevel,
        parentId: payload.parentId,
        version: payload.version.trim() || existing.version,
        ownerPersonId: payload.ownerPersonId,
        effectiveFrom: payload.effectiveFrom,
        methodSummary: payload.methodSummary.trim() || "Описание не задано.",
      };

      if (nextLevel === "L3_operation") {
        updated.operationObject = payload.operationObject ?? existing.operationObject ?? "other";
        updated.normUnit = "operation";
        updated.isTariffable = payload.isTariffable ?? existing.isTariffable ?? true;
      } else {
        delete updated.operationObject;
        delete updated.normUnit;
        delete updated.isTariffable;
      }

      const sops = state.sops.map((s) => (s.id === payload.id ? updated : s));
      const lines =
        nextLevel === "L3_operation" &&
        (existing.name !== updated.name || existing.version !== updated.version)
          ? state.lines.map((line) =>
              line.sopId === payload.id
                ? { ...line, sopName: updated.name, sopVersion: updated.version }
                : line,
            )
          : state.lines;

      return { ...state, sops, lines };
    }

    case "sop/archive": {
      const target = state.sops.find((s) => s.id === action.sopId);
      if (!target || target.status === "archived") return state;
      const ids = new Set([action.sopId, ...getDescendantIds(state.sops, action.sopId)]);
      return {
        ...state,
        sops: state.sops.map((s) => (ids.has(s.id) ? { ...s, status: "archived" as const } : s)),
      };
    }

    case "sop/restore": {
      const target = state.sops.find((s) => s.id === action.sopId);
      if (!target || target.status !== "archived") return state;
      // Родитель должен быть действующим, иначе ветка снова «висит» в архиве
      if (target.parentId) {
        const parent = state.sops.find((s) => s.id === target.parentId);
        if (!parent || parent.status === "archived") return state;
      }
      return {
        ...state,
        sops: state.sops.map((s) =>
          s.id === action.sopId ? { ...s, status: "active" as const } : s,
        ),
      };
    }

    // ─────────────── Тарифы ───────────────
    case "tariff/createDraft": {
      const now = DEMO_TODAY;
      const draft: SopTariff = {
        ...action.payload,
        id: uid("trf"),
        status: "draft",
        approvedByPersonId: null,
        createdAt: now,
        updatedAt: now,
      };
      return { ...state, tariffs: [...state.tariffs, draft] };
    }

    case "tariff/approve": {
      const target = state.tariffs.find((t) => t.id === action.tariffId);
      if (!target) return state;
      const now = DEMO_TODAY;

      const tariffs = state.tariffs.map((t) => {
        if (t.id === target.id) {
          return {
            ...t,
            status: "active" as const,
            approvedByPersonId: action.approverPersonId,
            updatedAt: now,
          };
        }
        // Предыдущая действующая версия по тому же СОП и подразделению закрывается
        // днём раньше начала новой и уходит в архив, если её окно уже истекло.
        const isSameScope =
          t.sopId === target.sopId &&
          t.divisionId === target.divisionId &&
          t.jobTitle === target.jobTitle &&
          t.status === "active" &&
          t.validFrom < target.validFrom;
        if (!isSameScope) return t;

        const closingDate = previousDay(target.validFrom);
        const alreadyClosedEarlier = t.validTo !== null && t.validTo < closingDate;
        const validTo = alreadyClosedEarlier ? t.validTo! : closingDate;
        return {
          ...t,
          validTo,
          status: (validTo < now ? "archived" : "active") as SopTariff["status"],
          updatedAt: now,
        };
      });

      return { ...state, tariffs, lines: recalcAllLines(state, tariffs) };
    }

    case "tariff/reject": {
      const tariffs = state.tariffs.filter((t) => t.id !== action.tariffId);
      return { ...state, tariffs, lines: recalcAllLines(state, tariffs) };
    }

    case "tariff/unapprove": {
      const target = state.tariffs.find((t) => t.id === action.tariffId);
      if (!target || target.status !== "active") return state;
      const now = DEMO_TODAY;
      const tariffs = state.tariffs.map((t) =>
        t.id === target.id
          ? {
              ...t,
              status: "draft" as const,
              approvedByPersonId: null,
              updatedAt: now,
            }
          : t,
      );
      return { ...state, tariffs, lines: recalcAllLines(state, tariffs) };
    }

    case "tariff/archive": {
      const target = state.tariffs.find((t) => t.id === action.tariffId);
      if (!target || target.status === "archived") return state;
      // Архив только из «Действует»; черновик удаляется через reject
      if (target.status !== "active") return state;
      const now = DEMO_TODAY;
      const closingDate = previousDay(now);
      const validTo =
        target.validTo !== null && target.validTo < closingDate
          ? target.validTo
          : closingDate;
      const tariffs = state.tariffs.map((t) =>
        t.id === target.id
          ? {
              ...t,
              status: "archived" as const,
              validTo,
              updatedAt: now,
            }
          : t,
      );
      return { ...state, tariffs, lines: recalcAllLines(state, tariffs) };
    }

    case "tariff/restore": {
      // CRUD: archived → draft. Снова нужна кнопка «Утвердить».
      // validTo сбрасываем в null, чтобы после утверждения окно снова было открытым.
      const target = state.tariffs.find((t) => t.id === action.tariffId);
      if (!target || target.status !== "archived") return state;
      const now = DEMO_TODAY;
      const tariffs = state.tariffs.map((t) =>
        t.id === target.id
          ? {
              ...t,
              status: "draft" as const,
              approvedByPersonId: null,
              validTo: null,
              updatedAt: now,
            }
          : t,
      );
      return { ...state, tariffs, lines: recalcAllLines(state, tariffs) };
    }

    // ─────────────── Схемы оплаты по положению ───────────────
    case "payScheme/createDraft": {
      const now = DEMO_TODAY;
      const name = action.payload.name?.trim();
      if (!name) return state;
      if (!action.payload.divisionId || !action.payload.siteKey) return state;
      const draft: PayScheme = {
        ...action.payload,
        name,
        regulationRef: action.payload.regulationRef?.trim() || "—",
        jobTitle: action.payload.jobTitle?.trim() || null,
        components: Array.isArray(action.payload.components) ? action.payload.components : [],
        id: uid("ps"),
        status: "draft",
        approvedByPersonId: null,
        createdAt: now,
        updatedAt: now,
      };
      return {
        ...state,
        paySchemes: [...(state.paySchemes ?? []), draft],
      };
    }

    case "payScheme/update": {
      const target = (state.paySchemes ?? []).find((s) => s.id === action.schemeId);
      // Править можно черновик и действующую; архив — только через restore.
      if (!target || target.status === "archived") return state;
      const name = action.payload.name?.trim();
      if (!name) return state;
      if (!action.payload.divisionId || !action.payload.siteKey) return state;
      const now = DEMO_TODAY;
      return {
        ...state,
        paySchemes: (state.paySchemes ?? []).map((s) =>
          s.id === target.id
            ? {
                ...s,
                name,
                regulationRef: action.payload.regulationRef?.trim() || "—",
                divisionId: action.payload.divisionId,
                siteKey: action.payload.siteKey,
                jobTitle: action.payload.jobTitle?.trim() || null,
                components: Array.isArray(action.payload.components)
                  ? action.payload.components
                  : s.components,
                // Правка действующей схемы возвращает её в черновик — нужно повторное утверждение
                status: s.status === "active" ? ("draft" as const) : s.status,
                approvedByPersonId: s.status === "active" ? null : s.approvedByPersonId,
                updatedAt: now,
              }
            : s,
        ),
      };
    }

    case "payScheme/delete": {
      const target = (state.paySchemes ?? []).find((s) => s.id === action.schemeId);
      // Удаление только черновика; действующую — в архив.
      if (!target || target.status !== "draft") return state;
      return {
        ...state,
        paySchemes: (state.paySchemes ?? []).filter((s) => s.id !== target.id),
      };
    }

    case "payScheme/approve": {
      const target = (state.paySchemes ?? []).find((s) => s.id === action.schemeId);
      if (!target || target.status !== "draft") return state;
      const now = DEMO_TODAY;
      const paySchemes = (state.paySchemes ?? []).map((s) => {
        if (s.id === target.id) {
          return {
            ...s,
            status: "active" as const,
            approvedByPersonId: action.approverPersonId,
            updatedAt: now,
          };
        }
        const sameScope =
          s.siteKey === target.siteKey &&
          s.divisionId === target.divisionId &&
          s.jobTitle === target.jobTitle &&
          s.status === "active";
        if (sameScope) {
          return { ...s, status: "archived" as const, updatedAt: now };
        }
        return s;
      });
      return { ...state, paySchemes };
    }

    case "payScheme/reject": {
      const target = (state.paySchemes ?? []).find((s) => s.id === action.schemeId);
      if (!target || target.status !== "draft") return state;
      return {
        ...state,
        paySchemes: (state.paySchemes ?? []).filter((s) => s.id !== target.id),
      };
    }

    case "payScheme/unapprove": {
      const target = (state.paySchemes ?? []).find((s) => s.id === action.schemeId);
      if (!target || target.status !== "active") return state;
      const now = DEMO_TODAY;
      return {
        ...state,
        paySchemes: (state.paySchemes ?? []).map((s) =>
          s.id === target.id
            ? {
                ...s,
                status: "draft" as const,
                approvedByPersonId: null,
                updatedAt: now,
              }
            : s,
        ),
      };
    }

    case "payScheme/archive": {
      const target = (state.paySchemes ?? []).find((s) => s.id === action.schemeId);
      if (!target || target.status !== "active") return state;
      const now = DEMO_TODAY;
      return {
        ...state,
        paySchemes: (state.paySchemes ?? []).map((s) =>
          s.id === target.id ? { ...s, status: "archived" as const, updatedAt: now } : s,
        ),
      };
    }

    case "payScheme/restore": {
      const target = (state.paySchemes ?? []).find((s) => s.id === action.schemeId);
      if (!target || target.status !== "archived") return state;
      const now = DEMO_TODAY;
      return {
        ...state,
        paySchemes: (state.paySchemes ?? []).map((s) =>
          s.id === target.id
            ? {
                ...s,
                status: "draft" as const,
                approvedByPersonId: null,
                updatedAt: now,
              }
            : s,
        ),
      };
    }

    // ─────────────── Производственные факты ───────────────
    case "fact/create": {
      const created = appendFactWithLines(state, action.payload);
      if (!created) return state;
      return {
        ...state,
        facts: created.facts,
        entries: created.entries,
        lines: created.lines,
      };
    }

    // ─────────────── Календарный план работ ───────────────
    case "plan/create": {
      const sop = indexSops(state.sops).get(action.payload.sopId);
      if (!sop || sop.level !== "L3_operation" || sop.status === "archived") return state;

      const person = state.persons.find((p) => p.id === action.payload.personId);
      if (!person || person.status !== "working") return state;

      const { plannedDate, source, createdByPersonId } = action.payload;
      if (source === "self_picked" && plannedDate !== DEMO_TODAY) return state;

      const period = findPeriodForDate(state, person.divisionId, plannedDate);
      if (!isPeriodEditable(period)) return state;

      const qtyRaw = action.payload.plannedQuantity ?? 1;
      const plannedQuantity =
        typeof qtyRaw === "number" && Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : null;
      if (plannedQuantity === null) return state;

      const planItem: WorkPlanItem = {
        id: uid("plan"),
        sopId: sop.id,
        personId: person.id,
        divisionId: person.divisionId,
        plannedDate,
        objectLabel: action.payload.objectLabel.trim() || "Объект не указан",
        plannedQuantity,
        status: "planned",
        source,
        factId: null,
        createdByPersonId,
        assignmentId: null,
      };

      return { ...state, planItems: [...state.planItems, planItem] };
    }

    case "plan/update": {
      const existing = state.planItems.find((p) => p.id === action.planId);
      if (!existing || !isPlanItemOpen(existing)) return state;

      const period = findPeriodForDate(state, existing.divisionId, existing.plannedDate);
      if (!isPeriodEditable(period)) return state;

      const nextPersonId = action.payload.personId ?? existing.personId;
      const nextPerson = state.persons.find((p) => p.id === nextPersonId);
      if (!nextPerson || nextPerson.divisionId !== existing.divisionId) return state;

      const nextDate = action.payload.plannedDate ?? existing.plannedDate;
      const nextPeriod = findPeriodForDate(state, existing.divisionId, nextDate);
      if (!isPeriodEditable(nextPeriod)) return state;

      let nextSopId = existing.sopId;
      if (action.payload.sopId) {
        const sop = indexSops(state.sops).get(action.payload.sopId);
        if (!sop || sop.level !== "L3_operation" || sop.status === "archived") return state;
        nextSopId = sop.id;
      }

      let plannedQuantity = existing.plannedQuantity;
      if (action.payload.plannedQuantity !== undefined) {
        const q = action.payload.plannedQuantity;
        if (typeof q !== "number" || !Number.isFinite(q) || q <= 0) return state;
        plannedQuantity = q;
      }

      return {
        ...state,
        planItems: state.planItems.map((p) =>
          p.id === action.planId
            ? {
                ...p,
                sopId: nextSopId,
                personId: nextPersonId,
                plannedDate: nextDate,
                objectLabel:
                  action.payload.objectLabel !== undefined
                    ? action.payload.objectLabel.trim() || "Объект не указан"
                    : p.objectLabel,
                plannedQuantity,
              }
            : p,
        ),
      };
    }

    case "plan/cancel": {
      const existing = state.planItems.find((p) => p.id === action.planId);
      if (!existing || !isPlanItemOpen(existing)) return state;
      const period = findPeriodForDate(state, existing.divisionId, existing.plannedDate);
      if (!isPeriodEditable(period)) return state;
      return {
        ...state,
        planItems: state.planItems.filter((p) => p.id !== action.planId),
      };
    }

    case "plan/take": {
      const existing = state.planItems.find((p) => p.id === action.planId);
      if (!existing || existing.status !== "planned") return state;
      const period = findPeriodForDate(state, existing.divisionId, existing.plannedDate);
      if (!isPeriodEditable(period)) return state;
      return {
        ...state,
        planItems: state.planItems.map((p) =>
          p.id === action.planId ? { ...p, status: "in_progress" as const } : p,
        ),
      };
    }

    case "plan/complete": {
      const existing = state.planItems.find((p) => p.id === action.planId);
      if (!existing || !isPlanItemOpen(existing)) return state;

      const created = appendFactWithLines(state, {
        sopId: existing.sopId,
        performerPersonIds: [existing.personId],
        objectLabel: action.payload.objectLabel ?? existing.objectLabel,
        factDate: existing.plannedDate,
        factStatus: action.payload.factStatus ?? "done",
        quantity: action.payload.quantity ?? existing.plannedQuantity,
      });
      if (!created) return state;

      return {
        ...state,
        facts: created.facts,
        entries: created.entries,
        lines: created.lines,
        planItems: state.planItems.map((p) =>
          p.id === action.planId
            ? { ...p, status: "completed" as const, factId: created.fact.id }
            : p,
        ),
      };
    }

    case "plan/skip": {
      const existing = state.planItems.find((p) => p.id === action.planId);
      if (!existing || !isPlanItemOpen(existing)) return state;
      const period = findPeriodForDate(state, existing.divisionId, existing.plannedDate);
      if (!isPeriodEditable(period)) return state;
      return {
        ...state,
        planItems: state.planItems.map((p) =>
          p.id === action.planId ? { ...p, status: "skipped" as const } : p,
        ),
      };
    }

    // ─────────────── Шаблоны дня / недели / назначения ───────────────
    case "dayPlan/create": {
      const name = action.payload.name.trim();
      if (!name) return state;
      const division = state.divisions.find((d) => d.id === action.payload.divisionId);
      if (!division) return state;

      const lines = normalizeDayPlanLines(state, action.payload.lines);
      if (lines === null) return state;

      const template: DayPlanTemplate = {
        id: uid("dpt"),
        name,
        divisionId: division.id,
        createdByPersonId: action.payload.createdByPersonId,
        status: action.payload.status === "draft" ? "draft" : "active",
        lines,
      };
      return {
        ...state,
        dayPlanTemplates: [...(state.dayPlanTemplates ?? []), template],
      };
    }

    case "dayPlan/update": {
      const existing = (state.dayPlanTemplates ?? []).find((t) => t.id === action.templateId);
      if (!existing || existing.status === "archived") return state;

      let lines = existing.lines;
      if (action.payload.lines) {
        const next = normalizeDayPlanLines(state, action.payload.lines);
        if (next === null) return state;
        lines = next;
      }

      const name =
        action.payload.name !== undefined ? action.payload.name.trim() : existing.name;
      if (!name) return state;

      const status = action.payload.status ?? existing.status;
      if (status === "archived") return state;

      return {
        ...state,
        dayPlanTemplates: (state.dayPlanTemplates ?? []).map((t) =>
          t.id === action.templateId ? { ...t, name, status, lines } : t,
        ),
      };
    }

    case "dayPlan/archive": {
      const existing = (state.dayPlanTemplates ?? []).find((t) => t.id === action.templateId);
      if (!existing || existing.status === "archived") return state;
      return {
        ...state,
        dayPlanTemplates: (state.dayPlanTemplates ?? []).map((t) =>
          t.id === action.templateId ? { ...t, status: "archived" as const } : t,
        ),
      };
    }

    case "weekPlan/create": {
      const name = action.payload.name.trim();
      if (!name) return state;
      const division = state.divisions.find((d) => d.id === action.payload.divisionId);
      if (!division) return state;

      const slots = normalizeWeekSlots(state, division.id, action.payload.slots);
      if (slots === null) return state;

      const template: WeekPlanTemplate = {
        id: uid("wpt"),
        name,
        divisionId: division.id,
        createdByPersonId: action.payload.createdByPersonId,
        status: action.payload.status === "draft" ? "draft" : "active",
        slots,
      };
      return {
        ...state,
        weekPlanTemplates: [...(state.weekPlanTemplates ?? []), template],
      };
    }

    case "weekPlan/update": {
      const existing = (state.weekPlanTemplates ?? []).find((t) => t.id === action.templateId);
      if (!existing || existing.status === "archived") return state;

      let slots = existing.slots;
      if (action.payload.slots) {
        const next = normalizeWeekSlots(state, existing.divisionId, action.payload.slots);
        if (next === null) return state;
        slots = next;
      }

      const name =
        action.payload.name !== undefined ? action.payload.name.trim() : existing.name;
      if (!name) return state;

      const status = action.payload.status ?? existing.status;
      if (status === "archived") return state;

      return {
        ...state,
        weekPlanTemplates: (state.weekPlanTemplates ?? []).map((t) =>
          t.id === action.templateId ? { ...t, name, status, slots } : t,
        ),
      };
    }

    case "weekPlan/archive": {
      const existing = (state.weekPlanTemplates ?? []).find((t) => t.id === action.templateId);
      if (!existing || existing.status === "archived") return state;
      return {
        ...state,
        weekPlanTemplates: (state.weekPlanTemplates ?? []).map((t) =>
          t.id === action.templateId ? { ...t, status: "archived" as const } : t,
        ),
      };
    }

    case "weekPlan/assign": {
      const weekTemplate = (state.weekPlanTemplates ?? []).find(
        (t) => t.id === action.payload.weekTemplateId,
      );
      if (!weekTemplate || weekTemplate.status !== "active") return state;

      const person = state.persons.find((p) => p.id === action.payload.personId);
      if (!person || person.status !== "working") return state;
      if (person.divisionId !== weekTemplate.divisionId) return state;

      const weekStart = mondayOfWeek(action.payload.weekStart);
      const weekEnd = shiftDate(weekStart, 6);

      const overlapping = (state.weekPlanAssignments ?? []).some(
        (a) =>
          a.personId === person.id &&
          a.weekStart === weekStart &&
          (a.status === "assigned" || a.status === "acknowledged" || a.status === "rejected"),
      );
      if (overlapping) return state;

      // Все рабочие дни назначения должны попадать в редактируемые периоды
      for (let i = 0; i < 7; i++) {
        const date = shiftDate(weekStart, i);
        const slot = weekTemplate.slots.find((s) => s.weekday === ((i + 1) as Weekday));
        if (!slot?.dayTemplateId) continue;
        const period = findPeriodForDate(state, person.divisionId, date);
        if (!isPeriodEditable(period)) return state;
      }

      const assignmentId = uid("wpa");
      const assignment: WeekPlanAssignment = {
        id: assignmentId,
        weekTemplateId: weekTemplate.id,
        personId: person.id,
        divisionId: person.divisionId,
        weekStart,
        status: "assigned",
        assignedByPersonId: action.payload.assignedByPersonId,
        acknowledgedAt: null,
        rejectComment: null,
      };

      const dayById = new Map((state.dayPlanTemplates ?? []).map((t) => [t.id, t]));
      const newItems: WorkPlanItem[] = [];

      for (let i = 0; i < 7; i++) {
        const weekday = (i + 1) as Weekday;
        const date = shiftDate(weekStart, i);
        const slot = weekTemplate.slots.find((s) => s.weekday === weekday);
        if (!slot?.dayTemplateId) continue;
        const day = dayById.get(slot.dayTemplateId);
        if (!day || day.status !== "active" || day.divisionId !== weekTemplate.divisionId) {
          continue;
        }
        for (const line of [...day.lines].sort((a, b) => a.sortOrder - b.sortOrder)) {
          newItems.push({
            id: uid("plan"),
            sopId: line.sopId,
            personId: person.id,
            divisionId: person.divisionId,
            plannedDate: date,
            objectLabel: line.objectLabel,
            plannedQuantity: line.plannedQuantity,
            status: "planned",
            source: "assigned",
            factId: null,
            createdByPersonId: action.payload.assignedByPersonId,
            assignmentId,
          });
        }
      }

      // Гарантируем табельные записи на месяцы недели (как при фактах)
      let entries = state.entries;
      const months = new Set([weekStart.slice(0, 7), weekEnd.slice(0, 7)]);
      for (const monthKey of months) {
        const period = state.periods.find(
          (p) => p.divisionId === person.divisionId && monthKeyFromPeriod(p) === monthKey,
        );
        if (!period || !isPeriodEditable(period)) continue;
        const entryId = makeEntryId(period.id, person.id);
        if (entries.some((e) => e.id === entryId)) continue;
        entries = [
          ...entries,
          {
            id: entryId,
            periodId: period.id,
            personId: person.id,
            status: "draft",
            divisionCoefficientId: null,
            personCoefficientId: null,
          },
        ];
      }

      return {
        ...state,
        weekPlanAssignments: [...(state.weekPlanAssignments ?? []), assignment],
        planItems: [...state.planItems, ...newItems],
        entries,
      };
    }

    case "weekPlan/cancelAssignment": {
      const existing = (state.weekPlanAssignments ?? []).find(
        (a) => a.id === action.assignmentId,
      );
      if (!existing || existing.status === "cancelled") return state;

      const linked = state.planItems.filter((p) => p.assignmentId === existing.id);
      if (linked.some((p) => !isPlanItemOpen(p) && p.status !== "planned")) {
        // если есть completed/skipped — нельзя отменить целиком
        if (linked.some((p) => p.status === "completed" || p.status === "skipped")) {
          return state;
        }
      }
      if (linked.some((p) => p.status === "completed" || p.status === "skipped")) return state;
      // in_progress тоже блокирует отмену
      if (linked.some((p) => p.status === "in_progress")) return state;

      for (const item of linked) {
        const period = findPeriodForDate(state, item.divisionId, item.plannedDate);
        if (!isPeriodEditable(period)) return state;
      }

      return {
        ...state,
        weekPlanAssignments: (state.weekPlanAssignments ?? []).map((a) =>
          a.id === action.assignmentId ? { ...a, status: "cancelled" as const } : a,
        ),
        planItems: state.planItems.filter((p) => p.assignmentId !== existing.id),
      };
    }

    case "weekPlan/acknowledge": {
      const existing = (state.weekPlanAssignments ?? []).find(
        (a) => a.id === action.assignmentId,
      );
      if (!existing || existing.status !== "assigned") return state;
      if (existing.personId !== action.personId) return state;
      return {
        ...state,
        weekPlanAssignments: (state.weekPlanAssignments ?? []).map((a) =>
          a.id === action.assignmentId
            ? {
                ...a,
                status: "acknowledged" as const,
                acknowledgedAt: DEMO_TODAY,
                rejectComment: null,
              }
            : a,
        ),
      };
    }

    case "weekPlan/reject": {
      const existing = (state.weekPlanAssignments ?? []).find(
        (a) => a.id === action.assignmentId,
      );
      if (!existing || existing.status !== "assigned") return state;
      if (existing.personId !== action.personId) return state;
      const comment = action.comment.trim();
      if (!comment) return state;
      return {
        ...state,
        weekPlanAssignments: (state.weekPlanAssignments ?? []).map((a) =>
          a.id === action.assignmentId
            ? { ...a, status: "rejected" as const, rejectComment: comment }
            : a,
        ),
      };
    }

    // ─────────────── Табельные позиции ───────────────
    case "line/confirm":
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.id === action.lineId && l.status !== "tariff_missing"
            ? { ...l, status: "confirmed" }
            : l,
        ),
      };

    // Массовое подтверждение: позиции без тарифа остаются нерешёнными,
    // потому что подтверждать нечего — суммы у них нет.
    case "line/confirmAllInEntry":
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.entryId === action.entryId && l.status === "auto_generated"
            ? { ...l, status: "confirmed" }
            : l,
        ),
      };

    case "line/reject":
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.id === action.lineId
            ? { ...l, status: "rejected", adjustmentComment: action.comment }
            : l,
        ),
      };

    case "line/adjust":
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.id === action.lineId
            ? {
                ...l,
                status: "manually_adjusted",
                appliedRate: action.amount,
                amount: action.amount,
                adjustmentComment: action.comment,
              }
            : l,
        ),
      };

    case "line/resetToAuto": {
      const cleared = state.lines.map((l) =>
        l.id === action.lineId ? { ...l, adjustmentComment: undefined, status: "auto_generated" as const } : l,
      );
      return { ...state, lines: recalcAllLines({ ...state, lines: cleared }, state.tariffs) };
    }

    // ─────────────── Табель ───────────────
    case "entry/confirm":
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.id === action.entryId ? { ...e, status: "confirmed" } : e,
        ),
      };

    case "timesheet/confirmDivision": {
      const entryIds = state.entries
        .filter((e) => e.periodId === action.periodId)
        .map((e) => e.id);
      return {
        ...state,
        entries: state.entries.map((e) =>
          entryIds.includes(e.id) ? { ...e, status: "confirmed" } : e,
        ),
        periods: state.periods.map((p) =>
          p.id === action.periodId
            ? { ...p, status: "in_review", checkedByPersonId: action.foremanPersonId }
            : p,
        ),
      };
    }

    case "period/approve":
      return approvePeriods(state, [action.periodId], action.approverPersonId);

    case "period/approveAll":
      return approvePeriods(
        state,
        state.periods
          .filter((p) => monthKeyFromPeriod(p) === action.monthKey)
          .map((p) => p.id),
        action.approverPersonId,
      );

    case "period/ensureMonth": {
      const monthKey = action.monthKey;
      if (!/^\d{4}-\d{2}$/.test(monthKey)) return state;
      const { dateFrom, dateTo } = monthBounds(monthKey);
      const periodLabel = formatMonthLabel(monthKey);
      const missing = state.divisions.filter(
        (d) =>
          !state.periods.some(
            (p) => p.divisionId === d.id && monthKeyFromPeriod(p) === monthKey,
          ),
      );
      if (missing.length === 0) return state;

      const newPeriods: TimesheetPeriod[] = missing.map((d) => ({
        id: periodIdForDivisionMonth(d.id, monthKey),
        divisionId: d.id,
        periodLabel,
        dateFrom,
        dateTo,
        status: "open" as const,
        checkedByPersonId: null,
        approvedByPersonId: null,
      }));

      return {
        ...state,
        periods: [...state.periods, ...newPeriods],
      };
    }

    // ─────────────── Коэффициенты ───────────────
    case "coefficient/set": {
      const existing = state.coefficients.find(
        (c) =>
          c.scope === action.scope &&
          c.targetId === action.targetId &&
          c.periodId === action.periodId &&
          c.status === "active",
      );

      const coefficientId = existing?.id ?? uid("coef");
      const coefficients = existing
        ? state.coefficients.map((c) =>
            c.id === existing.id
              ? { ...c, value: action.value, reason: action.reason, setByPersonId: action.setByPersonId }
              : c,
          )
        : [
            ...state.coefficients,
            {
              id: coefficientId,
              scope: action.scope,
              targetId: action.targetId,
              periodId: action.periodId,
              value: action.value,
              reason: action.reason,
              setByPersonId: action.setByPersonId,
              status: "active" as const,
            },
          ];

      // Привязываем коэффициент к табельным записям периода
      const entries = state.entries.map((e) => {
        if (e.periodId !== action.periodId) return e;
        if (action.scope === "division") {
          return { ...e, divisionCoefficientId: coefficientId };
        }
        return e.personId === action.targetId ? { ...e, personCoefficientId: coefficientId } : e;
      });

      return { ...state, coefficients, entries };
    }

    case "coefficient/remove": {
      const coefficients = state.coefficients.filter((c) => c.id !== action.coefficientId);
      const entries = state.entries.map((e) => ({
        ...e,
        divisionCoefficientId:
          e.divisionCoefficientId === action.coefficientId ? null : e.divisionCoefficientId,
        personCoefficientId:
          e.personCoefficientId === action.coefficientId ? null : e.personCoefficientId,
      }));
      return { ...state, coefficients, entries };
    }

    // ─────────────── Премии и штрафы ───────────────
    case "accrual/add":
      return {
        ...state,
        accruals: [
          ...state.accruals,
          { ...action.payload, id: uid("bp"), status: "accrued" },
        ],
      };

    case "accrual/cancel":
      return {
        ...state,
        accruals: state.accruals.map((a) =>
          a.id === action.accrualId ? { ...a, status: "cancelled" } : a,
        ),
      };

    case "demo/reset":
      return createInitialState();

    default:
      return state;
  }
}

function approvePeriods(state: AppState, periodIds: string[], approverPersonId: string): AppState {
  const targets = state.periods.filter(
    (p) => periodIds.includes(p.id) && p.status === "in_review",
  );
  if (targets.length === 0) return state;
  const targetIds = targets.map((p) => p.id);

  return {
    ...state,
    periods: state.periods.map((p) =>
      targetIds.includes(p.id) ? { ...p, status: "approved", approvedByPersonId: approverPersonId } : p,
    ),
    entries: state.entries.map((e) =>
      targetIds.includes(e.periodId) ? { ...e, status: "approved" } : e,
    ),
  };
}
