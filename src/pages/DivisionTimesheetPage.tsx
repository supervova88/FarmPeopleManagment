import { CheckCheck, Lock } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "@/app/store/StoreProvider";
import {
  isPeriodLocked,
  selectDivisionSummary,
  selectEntriesByPeriod,
  selectLinesByEntry,
  selectLinesByEntryInRange,
  selectOpenPlanGaps,
  selectPayoutBreakdown,
  selectPeriodByDivision,
} from "@/app/store/selectors";
import type { Person } from "@/entities/person/model";
import { TIMESHEET_PERIOD_STATUS_LABEL, type TimesheetLine } from "@/entities/timesheet/model";
import { viewDateRange } from "@/entities/timesheet/periodView";
import { calcPieceworkTotal } from "@/features/payroll/calcCoefficients";
import { declension, formatMoney } from "@/shared/lib/utils";
import { AccessDenied } from "@/shared/ui/AccessDenied";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { Hint } from "@/shared/ui/Hint";
import { Metric } from "@/shared/ui/Metric";
import { PageHeader } from "@/shared/ui/PageHeader";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { CalcFilters } from "@/widgets/period/CalcFilters";
import { AccrualsPanel } from "@/widgets/timesheet/AccrualsPanel";
import { CoefficientsPanel } from "@/widgets/timesheet/CoefficientsPanel";
import { AdjustLineModal, RejectLineModal } from "@/widgets/timesheet/LineDecisionModals";
import { TimesheetTable, type TimesheetRow } from "@/widgets/timesheet/TimesheetTable";

/**
 * Экран 4. Табель подразделения.
 * Бригадир обрабатывает позиции, задаёт коэффициенты периода и начисляет премии/штрафы.
 */
export function DivisionTimesheetPage() {
  const { state, dispatch, role, currentPerson, periodView, selectedDivisionId } = useStore();

  const canManage = role.id === "foreman" || role.id === "direction_manager";
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<TimesheetLine | null>(null);
  const [adjustTarget, setAdjustTarget] = useState<TimesheetLine | null>(null);

  const period = selectPeriodByDivision(state, selectedDivisionId, periodView.monthKey);
  const locked = isPeriodLocked(period);
  const summary = selectDivisionSummary(state, selectedDivisionId, periodView.monthKey);

  const dateRange = useMemo(() => {
    if (!period) return null;
    return viewDateRange(period, periodView.granularity, periodView.weekStart);
  }, [period, periodView.granularity, periodView.weekStart]);

  const rows = useMemo<TimesheetRow[]>(() => {
    if (!period || !dateRange) return [];
    return selectEntriesByPeriod(state, period.id)
      .map((entry) => {
        const breakdown = selectPayoutBreakdown(state, entry.id);
        if (!breakdown) return null;
        const lines =
          periodView.granularity === "week"
            ? selectLinesByEntryInRange(state, entry.id, dateRange.from, dateRange.to)
            : selectLinesByEntry(state, entry.id);

        if (periodView.granularity === "week") {
          const weekPiece = calcPieceworkTotal(lines);
          return {
            entry,
            breakdown: {
              ...breakdown,
              pieceworkTotal: weekPiece.pieceworkTotal,
              countedOperationsCount: weekPiece.countedOperationsCount,
              missingTariffCount: weekPiece.missingTariffCount,
              pendingCount: weekPiece.pendingCount,
              rejectedCount: weekPiece.rejectedCount,
            },
            lines,
          };
        }

        return { entry, breakdown, lines };
      })
      .filter((r): r is TimesheetRow => r !== null);
  }, [state, period, dateRange, periodView.granularity]);

  const employees: Person[] = rows
    .map((r) => state.persons.find((p) => p.id === r.entry.personId))
    .filter((p): p is Person => p !== undefined);

  const monthPending = useMemo(() => {
    if (!period) return 0;
    return selectEntriesByPeriod(state, period.id).reduce((acc, entry) => {
      const b = selectPayoutBreakdown(state, entry.id);
      return acc + (b?.pendingCount ?? 0);
    }, 0);
  }, [state, period]);

  const canConfirmAll = !locked && monthPending === 0 && rows.length > 0;

  const openPlanGaps = useMemo(() => {
    if (!period || !dateRange) return [];
    return selectOpenPlanGaps(state, selectedDivisionId, dateRange.from, dateRange.to);
  }, [state, period, dateRange, selectedDivisionId]);

  const weekPieceworkTotal = useMemo(
    () => rows.reduce((acc, r) => acc + r.breakdown.pieceworkTotal, 0),
    [rows],
  );
  const weekOpsCount = useMemo(
    () => rows.reduce((acc, r) => acc + r.breakdown.countedOperationsCount, 0),
    [rows],
  );
  const weekMissingTariff = useMemo(
    () => rows.reduce((acc, r) => acc + r.breakdown.missingTariffCount, 0),
    [rows],
  );

  if (!canManage) {
    return (
      <>
        <PageHeader title="Табель подразделения" />
        <AccessDenied allowed={["foreman", "direction_manager"]} />
      </>
    );
  }

  if (!period) {
    return (
      <>
        <PageHeader
          title="Табель подразделения"
          help="Табельные позиции сформированы автоматически из производственных фактов выполнения СОП. Ручной ввод — только редкая корректировка с обязательным комментарием."
        />
        <CalcFilters />
        <Panel>
          <PanelBody>
            <p className="text-xs text-ink-600">
              Для выбранного подразделения расчётный период не открыт.
            </p>
          </PanelBody>
        </Panel>
      </>
    );
  }

  const isWeek = periodView.granularity === "week";

  return (
    <>
      <PageHeader
        title="Табель подразделения"
        help={
          isWeek
            ? "Показаны операции выбранной недели. Коэффициенты, премии и штрафы действуют на весь месяц; «Итого к выплате» — за месяц. Табельные позиции формируются из фактов СОП."
            : "Табельные позиции сформированы автоматически из производственных фактов выполнения СОП. Ручной ввод — только редкая корректировка с обязательным комментарием."
        }
        meta={
          <>
            <Badge tone="neutral">{period.periodLabel}</Badge>
            {isWeek ? <Badge tone="info">Неделя</Badge> : null}
            <StatusBadge
              status={period.status === "in_review" ? "period_in_review" : period.status}
              label={`Период: ${TIMESHEET_PERIOD_STATUS_LABEL[period.status]}`}
            />
            {locked ? (
              <Badge tone="muted" icon={<Lock size={10} />}>
                Заблокирован для правок
              </Badge>
            ) : null}
          </>
        }
      />

      <CalcFilters
        trailing={
          <Button
            variant="success"
            disabled={!canConfirmAll}
            onClick={() =>
              dispatch({
                type: "timesheet/confirmDivision",
                periodId: period.id,
                foremanPersonId: currentPerson.id,
              })
            }
            title={
              canConfirmAll
                ? "Перевести все табельные записи в статус «Подтверждено»"
                : "Сначала примите решение по всем позициям в статусе «Сформировано автоматически»"
            }
          >
            <CheckCheck size={13} />
            Подтвердить весь табель
          </Button>
        }
      />

      <div className="space-y-3">
        {locked ? (
          <Hint tone="locked">
            Период утверждён управляющим по направлению. Позиции, коэффициенты и начисления
            заблокированы от изменений — данные зафиксированы для выплаты.
          </Hint>
        ) : monthPending > 0 ? (
          <Hint tone="warning">
            {monthPending} {declension(monthPending, ["позиция", "позиции", "позиций"])} в статусе
            «Сформировано автоматически» ждут решения. Подтвердить весь табель подразделения можно
            только после обработки всех позиций.
          </Hint>
        ) : null}

        {!locked && openPlanGaps.length > 0 ? (
          <Hint tone="info">
            В плане на выбранный период ещё {openPlanGaps.length}{" "}
            {declension(openPlanGaps.length, ["задача", "задачи", "задач"])} без факта исполнения.
            Специалист подтверждает их на «Мои операции»; вы принимаете уже созданные позиции здесь.
          </Hint>
        ) : null}

        <div className="grid grid-cols-6 gap-2">
          <Metric label="Сотрудников" value={summary.employeesCount} />
          <Metric
            label={isWeek ? "Операций за неделю" : "Операций в расчёте"}
            value={isWeek ? weekOpsCount : summary.operationsCount}
          />
          <Metric
            label="Без тарифа"
            value={isWeek ? weekMissingTariff : summary.missingTariffCount}
            tone={(isWeek ? weekMissingTariff : summary.missingTariffCount) > 0 ? "warning" : "neutral"}
            hint={
              (isWeek ? weekMissingTariff : summary.missingTariffCount) > 0
                ? "Требуется решение методолога"
                : undefined
            }
          />
          <Metric
            label={isWeek ? "Сделка за неделю" : "Сумма по сделке"}
            value={formatMoney(isWeek ? weekPieceworkTotal : summary.pieceworkTotal)}
          />
          <Metric
            label="Премии / штрафы"
            value={`${formatMoney(summary.bonusTotal)} / ${formatMoney(summary.penaltyTotal)}`}
            hint="За месяц"
          />
          <Metric
            label="Итого к выплате"
            value={formatMoney(summary.finalPayout)}
            tone="accent"
            size="lg"
            hint="За месяц"
          />
        </div>

        <Panel>
          <PanelHeader
            title="Сотрудники подразделения"
            help={
              isWeek
                ? "Операции выбранной недели; разверните строку для позиций"
                : "Разверните строку, чтобы обработать табельные позиции сотрудника"
            }
          />
          <PanelBody className="px-0 py-0">
            <TimesheetTable
              rows={rows}
              expandedEntryId={expandedEntryId}
              onToggleExpand={(id) => setExpandedEntryId((prev) => (prev === id ? null : id))}
              locked={locked}
              onConfirmLine={(line) => dispatch({ type: "line/confirm", lineId: line.id })}
              onRejectLine={setRejectTarget}
              onAdjustLine={setAdjustTarget}
              onConfirmEntry={(entry) => dispatch({ type: "entry/confirm", entryId: entry.id })}
              onConfirmAllLines={(entry) =>
                dispatch({ type: "line/confirmAllInEntry", entryId: entry.id })
              }
            />
          </PanelBody>
        </Panel>

        <CoefficientsPanel
          period={period}
          divisionId={selectedDivisionId}
          employees={employees}
          locked={locked}
        />

        <AccrualsPanel
          entries={rows.map((r) => r.entry)}
          employees={employees}
          locked={locked}
        />
      </div>

      <RejectLineModal
        key={`reject-${rejectTarget?.id ?? "none"}`}
        line={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={(comment) => {
          if (rejectTarget) dispatch({ type: "line/reject", lineId: rejectTarget.id, comment });
          setRejectTarget(null);
        }}
      />

      <AdjustLineModal
        key={`adjust-${adjustTarget?.id ?? "none"}`}
        line={adjustTarget}
        onClose={() => setAdjustTarget(null)}
        onConfirm={(amount, comment) => {
          if (adjustTarget) dispatch({ type: "line/adjust", lineId: adjustTarget.id, amount, comment });
          setAdjustTarget(null);
        }}
      />
    </>
  );
}
