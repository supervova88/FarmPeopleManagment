import { Lock, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "@/app/store/StoreProvider";
import {
  isPeriodLocked,
  selectCalendarMatrix,
  selectFactMap,
  selectOpenPlanGaps,
  selectPeriodByDivision,
} from "@/app/store/selectors";
import { TIMESHEET_PERIOD_STATUS_LABEL } from "@/entities/timesheet/model";
import { roundKopecks } from "@/features/payroll/rounding";
import { formatMoney } from "@/shared/lib/utils";
import { AccessDenied } from "@/shared/ui/AccessDenied";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Panel, PanelBody } from "@/shared/ui/Card";
import { Hint } from "@/shared/ui/Hint";
import { Metric } from "@/shared/ui/Metric";
import { PageHeader } from "@/shared/ui/PageHeader";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { CalcFilters } from "@/widgets/period/CalcFilters";
import { CalendarMatrixView } from "@/widgets/timesheet-calendar/CalendarMatrixView";

/**
 * Календарный план и табель операций: специалист × дата.
 * Бригадир составляет план на дни/неделю; факт создаёт оплату.
 */
export function TimesheetCalendarPage() {
  const { state, dispatch, role, currentPerson, periodView, selectedDivisionId } = useStore();
  const canAccess = role.id === "foreman" || role.id === "direction_manager";
  const canEdit = role.id === "foreman" || role.id === "direction_manager";

  const [showAmounts, setShowAmounts] = useState(true);

  const period = selectPeriodByDivision(state, selectedDivisionId, periodView.monthKey);
  const locked = isPeriodLocked(period);
  const factsMap = useMemo(() => selectFactMap(state), [state.facts]);

  const viewOpts = useMemo(
    () => ({ granularity: periodView.granularity, weekStart: periodView.weekStart }),
    [periodView.granularity, periodView.weekStart],
  );

  const matrix = useMemo(
    () => (period ? selectCalendarMatrix(state, period.id, viewOpts) : null),
    [state, period, viewOpts],
  );

  const openGaps = useMemo(() => {
    if (!period || !matrix) return [];
    const from = matrix.dates[0] ?? period.dateFrom;
    const to = matrix.dates[matrix.dates.length - 1] ?? period.dateTo;
    return selectOpenPlanGaps(state, selectedDivisionId, from, to);
  }, [state, period, matrix, selectedDivisionId]);

  if (!canAccess) {
    return (
      <>
        <PageHeader title="Календарный табель операций" />
        <AccessDenied allowed={["foreman", "direction_manager"]} />
      </>
    );
  }

  if (!period || !matrix) {
    return (
      <>
        <PageHeader
          title="Календарный табель операций"
          help="План работ на дни и учёт сдельных фактов. Ячейка: план и/или факт из СОП."
        />
        <CalcFilters showAmounts={showAmounts} onShowAmountsChange={setShowAmounts} />
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

  const missingTariffCount = matrix.rows.reduce((acc, row) => acc + row.rowMissingTariffCount, 0);
  const dayCount = matrix.dates.length || 1;

  return (
    <>
      <PageHeader
        title="Календарный табель операций"
        help={
          <>
            Составьте план на день или неделю («В план работ»), специалист подтвердит исполнение на
            экране «Мои операции». Факт задним числом — для свершившихся операций. Приём табеля за
            период — на экране «Табель подразделения».
            {periodView.granularity === "week"
              ? " Показана выбранная неделя; расчётный период остаётся месячным."
              : null}
          </>
        }
        meta={
          <>
            <Badge tone="neutral">{period.periodLabel}</Badge>
            {periodView.granularity === "week" ? <Badge tone="info">Неделя</Badge> : null}
            <StatusBadge
              status={period.status === "in_review" ? "period_in_review" : period.status}
              label={`Период: ${TIMESHEET_PERIOD_STATUS_LABEL[period.status]}`}
            />
            {locked ? (
              <Badge tone="muted" icon={<Lock size={10} />}>
                Заблокирован
              </Badge>
            ) : null}
          </>
        }
      />

      <CalcFilters
        showAmounts={showAmounts}
        onShowAmountsChange={setShowAmounts}
        trailing={
          <div className="flex flex-wrap items-center gap-1.5 print:hidden">
            <Link
              to="/work-plans"
              className="inline-flex h-7 items-center justify-center gap-1.5 rounded border border-line-strong bg-white px-2.5 text-xs font-medium text-ink-800 hover:bg-canvas"
            >
              Составить план недели
            </Link>
            <Button
              variant="outline"
              onClick={() => window.print()}
              title="Печать плана и матрицы"
            >
              <Printer size={13} />
              Печать плана
            </Button>
          </div>
        }
      />

      <div className="space-y-3 print:space-y-2">
        <div className="flex flex-wrap items-end gap-2 print:hidden">
          <Metric
            className="min-w-[220px] flex-1"
            label="Итого по сделке"
            value={formatMoney(matrix.grandTotal)}
            tone="accent"
            size="lg"
            hint="Без коэффициентов и премий/штрафов"
          />
          <Metric
            className="min-w-[180px]"
            label="В среднем за день"
            value={formatMoney(roundKopecks(matrix.grandTotal / dayCount))}
            hint={
              periodView.granularity === "week"
                ? "Сделка недели / дни недели"
                : "Сделка периода / календарные дни"
            }
          />
          <div className="flex flex-wrap items-center gap-1.5 pb-1">
            <Badge tone="neutral">{matrix.rows.length} сотрудников</Badge>
            <Badge tone="neutral">{matrix.dates.length} дн.</Badge>
            {openGaps.length > 0 ? (
              <Badge tone="info">{openGaps.length} в плане без факта</Badge>
            ) : null}
            {missingTariffCount > 0 ? (
              <Badge tone="warning">{missingTariffCount} без тарифа</Badge>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-2xs text-ink-500 print:hidden">
          <span className="font-semibold uppercase tracking-wide">Легенда:</span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded border border-paid-line bg-paid-soft" /> Факт со суммой
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded border border-accent/30 bg-accent-soft" /> Только план
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded border border-pending-line bg-pending-soft" /> Есть без
            тарифа
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded border border-reject-line bg-reject-soft" /> Есть
            отклонённые
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-3 rounded border border-line bg-white" /> Пусто
          </span>
        </div>

        {openGaps.length > 0 && !locked ? (
          <Hint tone="info" className="print:hidden">
            {openGaps.length} задач в плане ещё без факта исполнения — специалист должен подтвердить
            или вы зафиксируете факт задним числом. Приём оплачиваемых позиций — в «Табеле
            подразделения».
          </Hint>
        ) : null}

        {locked ? (
          <Hint tone="locked" className="print:hidden">
            Период утверждён. Календарь доступен только для просмотра — план и факты заблокированы.
          </Hint>
        ) : null}

        <CalendarMatrixView
          matrix={matrix}
          factsMap={factsMap}
          locked={locked}
          canEdit={canEdit}
          showAmounts={showAmounts}
          onCreateFact={(payload) => dispatch({ type: "fact/create", payload })}
          onCreatePlan={(payload) =>
            dispatch({
              type: "plan/create",
              payload: {
                ...payload,
                source: "assigned",
                createdByPersonId: currentPerson.id,
              },
            })
          }
          onCancelPlan={(item) => dispatch({ type: "plan/cancel", planId: item.id })}
          onRejectLine={(lineId, comment) => dispatch({ type: "line/reject", lineId, comment })}
        />
      </div>
    </>
  );
}
