import { Eye, ReceiptText } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "@/app/store/StoreProvider";
import {
  selectEntryForPerson,
  selectLinesByEntry,
  selectPayoutBreakdown,
  selectPeriod,
} from "@/app/store/selectors";
import { getDivisionName } from "@/entities/division/mock";
import { getSopNameFrom } from "@/entities/sop/helpers";
import { SOP_FACT_STATUS_LABEL } from "@/entities/sopFact/model";
import { TIMESHEET_ENTRY_STATUS_LABEL } from "@/entities/timesheet/model";
import { formatDate } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { Field, Select } from "@/shared/ui/Field";
import { Hint } from "@/shared/ui/Hint";
import { PageHeader } from "@/shared/ui/PageHeader";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/Table";
import { CalcFilters } from "@/widgets/period/CalcFilters";
import { OperationsTable } from "@/widgets/payout/OperationsTable";
import { PeriodSummary } from "@/widgets/payout/PeriodSummary";
import { MyWeekPlanPanel } from "@/widgets/work-plan/MyWeekPlanPanel";
import { TodayTasksPanel } from "@/widgets/work-plan/TodayTasksPanel";

type LineFilter = "all" | "paid" | "no_tariff" | "rejected";

/**
 * Экран специалиста: задачи на сегодня + начисления за период.
 * Исполнение задач создаёт производственный факт и позицию в табеле.
 */
export function MyOperationsPage() {
  const { state, currentPerson, periodView, role } = useStore();
  const [filter, setFilter] = useState<LineFilter>("all");

  const canEditToday = role.id === "specialist" || role.id === "foreman";

  const entry = selectEntryForPerson(state, currentPerson.id, periodView.monthKey);
  const period = entry ? selectPeriod(state, entry.periodId) : undefined;
  const breakdown = entry ? selectPayoutBreakdown(state, entry.id) : null;
  const allLines = entry ? selectLinesByEntry(state, entry.id) : [];

  const lines = useMemo(() => {
    if (filter === "paid") return allLines.filter((l) => l.amount !== null && l.status !== "rejected");
    if (filter === "no_tariff") return allLines.filter((l) => l.status === "tariff_missing");
    if (filter === "rejected") return allLines.filter((l) => l.status === "rejected");
    return allLines;
  }, [allLines, filter]);

  /** Факты, которые не создали табельную позицию — демонстрация правила. */
  const nonPayableFacts = useMemo(
    () =>
      state.facts.filter(
        (f) =>
          f.performerPersonIds.includes(currentPerson.id) &&
          (f.factStatus === "partially_done" || f.factStatus === "not_done"),
      ),
    [state.facts, currentPerson.id],
  );

  return (
    <>
      <PageHeader
        title="Мои операции"
        help="Сначала подтвердите план недели (если назначен), затем задачи на сегодня — возьмите в работу и подтвердите исполнение. Ниже — начисления за период (только просмотр)."
        meta={
          <>
            <Badge tone="neutral">{currentPerson.fullName}</Badge>
            <Badge tone="info">Табельный №{currentPerson.personnelNumber}</Badge>
            <Badge tone="neutral">{getDivisionName(currentPerson.divisionId, state.divisions)}</Badge>
            {period ? <Badge tone="neutral">{period.periodLabel}</Badge> : null}
            {entry ? (
              <StatusBadge
                status={entry.status}
                label={`Табельная запись: ${TIMESHEET_ENTRY_STATUS_LABEL[entry.status]}`}
              />
            ) : null}
          </>
        }
      />

      <CalcFilters
        trailing={
          <Link
            to={`/payout/${currentPerson.id}`}
            className="inline-flex h-[30px] items-center gap-1.5 rounded border border-line-strong bg-white px-2.5 text-xs font-medium text-ink-800 transition-colors hover:bg-canvas"
          >
            <ReceiptText size={13} />
            Детальная карточка расчёта
          </Link>
        }
      />

      <div className="space-y-3">
        <MyWeekPlanPanel personId={currentPerson.id} />
        <TodayTasksPanel personId={currentPerson.id} canEditToday={canEditToday} />

        {breakdown && breakdown.missingTariffCount > 0 ? (
          <Hint tone="warning">
            {breakdown.missingTariffCount} операций выполнено по СОП без установленного тарифа. Они
            зафиксированы и не потеряются, но сумма по ним не рассчитана — она появится после того,
            как методолог задаст тариф.
          </Hint>
        ) : null}

        {!entry || !breakdown ? (
          <Panel>
            <PanelBody>
              <p className="text-xs text-ink-600">
                За выбранный период по сотруднику {currentPerson.fullName} пока нет табельных
                позиций. Подтвердите исполнение задач на сегодня — позиции появятся автоматически.
              </p>
            </PanelBody>
          </Panel>
        ) : (
          <>
            <Hint tone="locked">
              Начисления за период — режим просмотра. Коэффициенты, премии и приём табеля — зона
              ответственности бригадира подразделения.
            </Hint>

            <Panel>
              <PanelHeader
                title="Операции за период"
                help={`${allLines.length} позиций, сформированных из производственных фактов`}
                actions={
                  <Field label="" className="w-56">
                    <Select value={filter} onChange={(e) => setFilter(e.target.value as LineFilter)}>
                      <option value="all">Все позиции</option>
                      <option value="paid">Только с рассчитанной суммой</option>
                      <option value="no_tariff">Только без тарифа</option>
                      <option value="rejected">Только отклонённые</option>
                    </Select>
                  </Field>
                }
              />
              <PanelBody className="px-0 py-0">
                <OperationsTable lines={lines} />
              </PanelBody>
            </Panel>

            <PeriodSummary breakdown={breakdown} />
          </>
        )}

        {nonPayableFacts.length > 0 ? (
          <Panel>
            <PanelHeader
              title="Факты, не попавшие в табель"
              help="Табельную позицию создают только статусы «Выполнено» и «Выполнено с отклонениями»"
              icon={<Eye size={14} />}
            />
            <PanelBody className="px-0 py-0">
              <Table>
                <THead>
                  <TR>
                    <TH className="w-24">Дата</TH>
                    <TH>Операция</TH>
                    <TH className="w-52">Объект</TH>
                    <TH className="w-44">Статус факта</TH>
                    <TH className="w-56">Почему не оплачивается</TH>
                  </TR>
                </THead>
                <TBody>
                  {nonPayableFacts.map((f) => (
                    <TR key={f.id}>
                      <TD className="tabular text-ink-600">{formatDate(f.factDate)}</TD>
                      <TD className="font-medium text-ink-900">
                        {getSopNameFrom(state.sops, f.sopId)}
                      </TD>
                      <TD className="text-ink-600">{f.objectLabel}</TD>
                      <TD>
                        <StatusBadge
                          status={f.factStatus}
                          label={SOP_FACT_STATUS_LABEL[f.factStatus]}
                        />
                      </TD>
                      <TD className="text-2xs text-ink-500">
                        Табельная позиция не формируется для этого статуса факта
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </PanelBody>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
