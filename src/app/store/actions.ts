import type { BonusPenalty, BonusPenaltyType } from "@/entities/bonusPenalty/model";
import type { CoefficientScope } from "@/entities/coefficient/model";
import type { DivisionStatus } from "@/entities/division/model";
import type { PayScheme } from "@/entities/payScheme/model";
import type { PersonStatus, RoleId } from "@/entities/person/model";
import type { SopLevel, SopOperationObject } from "@/entities/sop/model";
import type { SopFactStatus } from "@/entities/sopFact/model";
import type { SopTariff } from "@/entities/tariff/model";
import type {
  PlanTemplateStatus,
  WeekPlanSlot,
  WorkPlanSource,
} from "@/entities/workPlan/model";

export type SopCreatePayload = {
  id: string;
  code: string;
  name: string;
  level: SopLevel;
  parentId: string | null;
  version: string;
  ownerPersonId: string;
  effectiveFrom: string;
  methodSummary: string;
  operationObject?: SopOperationObject;
  isTariffable?: boolean;
};

/** Редактирование, включая перенос на другой уровень (если нет дочерних узлов). */
export type SopUpdatePayload = {
  id: string;
  code: string;
  name: string;
  level: SopLevel;
  parentId: string | null;
  version: string;
  ownerPersonId: string;
  effectiveFrom: string;
  methodSummary: string;
  operationObject?: SopOperationObject;
  isTariffable?: boolean;
};

export type PersonUpsertPayload = {
  fullName: string;
  personnelNumber: string;
  divisionId: string;
  jobTitle: string;
  status: PersonStatus;
  hiredAt: string;
  accessRoleId: RoleId | null;
};

export type DivisionUpsertPayload = {
  code: string;
  name: string;
  parentId: string | null;
  farmName: string;
  headPersonId: string;
  status: DivisionStatus;
};

export type AppAction =
  | { type: "role/set"; roleId: RoleId }
  // ── Справочники (админ) ──
  | { type: "person/create"; payload: PersonUpsertPayload }
  | { type: "person/update"; personId: string; payload: PersonUpsertPayload }
  | { type: "person/setStatus"; personId: string; status: PersonStatus }
  | { type: "division/create"; payload: DivisionUpsertPayload }
  | { type: "division/update"; divisionId: string; payload: DivisionUpsertPayload }
  | { type: "division/setStatus"; divisionId: string; status: DivisionStatus }
  // ── СОП ──
  | { type: "sop/create"; payload: SopCreatePayload }
  | { type: "sop/update"; payload: SopUpdatePayload }
  | { type: "sop/archive"; sopId: string }
  | { type: "sop/restore"; sopId: string }
  // ── Тарифы ──
  | {
      type: "tariff/createDraft";
      payload: Omit<SopTariff, "id" | "status" | "approvedByPersonId" | "createdAt" | "updatedAt">;
      authorPersonId: string;
    }
  | { type: "tariff/approve"; tariffId: string; approverPersonId: string }
  | { type: "tariff/reject"; tariffId: string }
  | { type: "tariff/unapprove"; tariffId: string }
  | { type: "tariff/archive"; tariffId: string }
  /** Архив → черновик (повторное утверждение через tariff/approve) */
  | { type: "tariff/restore"; tariffId: string }
  // ── Схемы оплаты по положению (CRUD) ──
  | {
      type: "payScheme/createDraft";
      payload: Omit<
        PayScheme,
        "id" | "status" | "approvedByPersonId" | "createdAt" | "updatedAt"
      >;
    }
  | {
      type: "payScheme/update";
      schemeId: string;
      payload: Omit<
        PayScheme,
        "id" | "status" | "approvedByPersonId" | "createdAt" | "updatedAt"
      >;
    }
  | { type: "payScheme/delete"; schemeId: string }
  | { type: "payScheme/approve"; schemeId: string; approverPersonId: string }
  | { type: "payScheme/reject"; schemeId: string }
  | { type: "payScheme/unapprove"; schemeId: string }
  | { type: "payScheme/archive"; schemeId: string }
  | { type: "payScheme/restore"; schemeId: string }
  // ── Производственные факты (календарный табель) ──
  | {
      type: "fact/create";
      payload: {
        sopId: string;
        /** 1 или 2 исполнителей; для совместимости допускается один performerPersonId через UI */
        performerPersonIds: string[];
        objectLabel: string;
        factDate: string;
        factStatus?: SopFactStatus;
        /** Количество в единицах тарифа; по умолчанию 1 */
        quantity?: number;
      };
    }
  // ── Календарный план работ ──
  | {
      type: "plan/create";
      payload: {
        sopId: string;
        personId: string;
        plannedDate: string;
        objectLabel: string;
        plannedQuantity?: number;
        source: WorkPlanSource;
        createdByPersonId: string;
      };
    }
  | {
      type: "plan/update";
      planId: string;
      payload: {
        objectLabel?: string;
        plannedQuantity?: number;
        plannedDate?: string;
        personId?: string;
        sopId?: string;
      };
    }
  | { type: "plan/cancel"; planId: string }
  | { type: "plan/take"; planId: string }
  | {
      type: "plan/complete";
      planId: string;
      payload: {
        factStatus?: Extract<SopFactStatus, "done" | "done_with_deviations">;
        quantity?: number;
        objectLabel?: string;
      };
    }
  | { type: "plan/skip"; planId: string }
  // ── Шаблоны дня / недели / назначения ──
  | {
      type: "dayPlan/create";
      payload: {
        name: string;
        divisionId: string;
        createdByPersonId: string;
        status?: PlanTemplateStatus;
        lines: Array<{
          sopId: string;
          objectLabel: string;
          plannedQuantity: number;
          sortOrder?: number;
        }>;
      };
    }
  | {
      type: "dayPlan/update";
      templateId: string;
      payload: {
        name?: string;
        status?: PlanTemplateStatus;
        lines?: Array<{
          sopId: string;
          objectLabel: string;
          plannedQuantity: number;
          sortOrder?: number;
        }>;
      };
    }
  | { type: "dayPlan/archive"; templateId: string }
  | {
      type: "weekPlan/create";
      payload: {
        name: string;
        divisionId: string;
        createdByPersonId: string;
        status?: PlanTemplateStatus;
        slots: WeekPlanSlot[];
      };
    }
  | {
      type: "weekPlan/update";
      templateId: string;
      payload: {
        name?: string;
        status?: PlanTemplateStatus;
        slots?: WeekPlanSlot[];
      };
    }
  | { type: "weekPlan/archive"; templateId: string }
  | {
      type: "weekPlan/assign";
      payload: {
        weekTemplateId: string;
        personId: string;
        weekStart: string;
        assignedByPersonId: string;
      };
    }
  | { type: "weekPlan/cancelAssignment"; assignmentId: string }
  | { type: "weekPlan/acknowledge"; assignmentId: string; personId: string }
  | {
      type: "weekPlan/reject";
      assignmentId: string;
      personId: string;
      comment: string;
    }
  // ── Табельные позиции ──
  | { type: "line/confirm"; lineId: string }
  | { type: "line/reject"; lineId: string; comment: string }
  | { type: "line/adjust"; lineId: string; amount: number | null; comment: string }
  | { type: "line/resetToAuto"; lineId: string }
  | { type: "line/confirmAllInEntry"; entryId: string }
  // ── Табель ──
  | { type: "entry/confirm"; entryId: string }
  | { type: "timesheet/confirmDivision"; periodId: string; foremanPersonId: string }
  | { type: "period/approve"; periodId: string; approverPersonId: string }
  | { type: "period/approveAll"; approverPersonId: string; monthKey: string }
  /** Открыть пустой табель на месяц для всех подразделений, у которых его ещё нет */
  | { type: "period/ensureMonth"; monthKey: string }
  // ── Коэффициенты ──
  | {
      type: "coefficient/set";
      scope: CoefficientScope;
      targetId: string;
      periodId: string;
      value: number;
      reason: string;
      setByPersonId: string;
    }
  | { type: "coefficient/remove"; coefficientId: string }
  // ── Премии и штрафы ──
  | {
      type: "accrual/add";
      payload: Omit<BonusPenalty, "id" | "status"> & { type: BonusPenaltyType };
    }
  | { type: "accrual/cancel"; accrualId: string }
  | { type: "demo/reset" };
