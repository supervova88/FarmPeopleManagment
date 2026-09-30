import { CircleAlert, Lock, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useStore } from "@/app/store/StoreProvider";
import {
  selectAllDivisionSummaries,
  selectFarmTotals,
} from "@/app/store/selectors";
import { getPersonName } from "@/entities/person/mock";
import { formatMonthLabel } from "@/entities/timesheet/periodView";
import { TIMESHEET_PERIOD_STATUS_LABEL } from "@/entities/timesheet/model";
import { declension, formatCoefficient, formatMoney, formatMoneyShort } from "@/shared/lib/utils";
import { AccessDenied } from "@/shared/ui/AccessDenied";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { Hint } from "@/shared/ui/Hint";
import { Metric } from "@/shared/ui/Metric";
import { PageHeader } from "@/shared/ui/PageHeader";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { MoneyCell, Table, TBody, TD, TH, THead, TR } from "@/shared/ui/Table";
import { CalcFilters } from "@/widgets/period/CalcFilters";

/**
 * Экран 5. Утверждение расчётного периода управляющим по направлению.
 * Утверждается выбранный месяц (неделя — только срез отображения на других экранах).
 */
export function PeriodApprovalPage() {
  const { state, dispatch, role, currentPerson, periodView } = useStore();

  const monthLabel = formatMonthLabel(periodView.monthKey);

  if (role.id !== "direction_manager") {
    return (
      <>
        <PageHeader title="Утверждение периода" />
        <AccessDenied allowed={["direction_manager"]} />
      </>
    );
  }

  const summaries = selectAllDivisionSummaries(state, periodView.monthKey);
  const farm = selectFarmTotals(state, periodView.monthKey);

  const readyToApprove = summaries.filter((s) => s.period?.status === "in_review");
  const notReady = summaries.filter(
    (s) => s.period && s.period.status !== "in_review" && s.period.status !== "approved",
  );
  const canApproveAll = notReady.length === 0 && readyToApprove.length > 0;

  return (
    <>
      <PageHeader
        title="Утверждение периода"
        help="Сводный расчёт по всем подразделениям фермы за расчётный период. После утверждения данные блокируются от дальнейшего редактирования. Фильтр подразделения задаёт контекст для перехода на другие экраны; свод ниже — по всей ферме."
        meta={
          <>
            <Badge tone="neutral">{monthLabel}</Badge>
            <Badge tone="neutral">Подразделений: {summaries.length}</Badge>
            <Badge tone="info">Сотрудников: {farm.employeesCount}</Badge>
            {farm.allDivisionsApproved ? (
              <Badge tone="success" icon={<Lock size={10} />}>
                Период утверждён и заблокирован
              </Badge>
            ) : null}
          </>
        }
      />

      <CalcFilters
        trailing={
          <Button
            variant="success"
            disabled={!canApproveAll}
            onClick={() =>
              dispatch({
                type: "period/approveAll",
                approverPersonId: currentPerson.id,
                monthKey: periodView.monthKey,
              })
            }
            title={
              canApproveAll
                ? `Утвердить период «${monthLabel}» по всем подразделениям`
                : "Все подразделения должны быть в статусе «Подтверждено»"
            }
          >
            <ShieldCheck size={13} />
            Утвердить период
          </Button>
        }
      />

      <div className="space-y-3">
        {notReady.length > 0 ? (
          <Hint tone="warning">
            Утверждение недоступно: подразделения{" "}
            <strong>{notReady.map((s) => s.divisionName).join(", ")}</strong> ещё не подтвердили
            табель. Бригадир должен обработать все позиции и нажать «Подтвердить весь табель
            подразделения».
          </Hint>
        ) : null}

        {farm.allDivisionsApproved ? (
          <Hint tone="locked">
            Период утверждён. Табельные позиции, коэффициенты и начисления заблокированы для правок —
            во всех формах поля отмечены замком и недоступны.
          </Hint>
        ) : null}

        <div className="grid grid-cols-4 gap-2">
          <Metric
            label="Итого к выплате по ферме"
            value={formatMoneyShort(farm.finalPayout)}
            tone="accent"
            size="lg"
            hint={`Сумма по сделке ${formatMoney(farm.pieceworkTotal)} до коэффициентов и начислений`}
          />
          <Metric label="Операций в расчёте" value={farm.operationsCount} />
          <Metric
            label="Операций без тарифа"
            value={farm.missingTariffCount}
            tone={farm.missingTariffCount > 0 ? "warning" : "success"}
            hint={
              farm.missingTariffCount > 0
                ? "Сумма по ним не рассчитана — требуется решение методолога"
                : "Все выполненные операции оплачены по тарифу"
            }
          />
          <Metric
            label="Подразделений подтвердило"
            value={`${summaries.filter((s) => s.allEntriesConfirmed).length} из ${summaries.length}`}
            tone={farm.allDivisionsConfirmed ? "success" : "warning"}
          />
        </div>

        {farm.missingTariffCount > 0 ? (
          <Panel className="border-pending-line">
            <PanelBody className="flex items-start gap-2.5 bg-pending-soft">
              <CircleAlert size={16} className="mt-[1px] shrink-0 text-pending" />
              <div>
                <p className="text-xs font-semibold text-pending">
                  {farm.missingTariffCount}{" "}
                  {declension(farm.missingTariffCount, ["операция", "операции", "операций"])} по СОП
                  без тарифа на сумму 0 ₽ — требуется решение методолога
                </p>
                <p className="mt-1 text-xs leading-relaxed text-ink-700">
                  Операции зафиксированы в производственном контуре и в табеле, но денежная сумма по
                  ним не рассчитана: в системе стоит «—», а не ноль. После установки тарифа задним
                  числом суммы пересчитаются автоматически.{" "}
                  <Link to="/tariffs" className="font-medium text-accent underline">
                    Перейти к управлению тарифами
                  </Link>
                </p>
              </div>
            </PanelBody>
          </Panel>
        ) : null}

        <Panel>
          <PanelHeader
            title="Сводка по подразделениям"
            subtitle={`Расчётный период «${monthLabel}»`}
          />
          <PanelBody className="px-0 py-0">
            <Table>
              <THead>
                <TR>
                  <TH>Подразделение</TH>
                  <TH align="right" className="w-24">
                    Сотрудников
                  </TH>
                  <TH align="right" className="w-24">
                    Операций
                  </TH>
                  <TH align="right" className="w-24">
                    Без тарифа
                  </TH>
                  <TH align="right" className="w-32">
                    Сумма по сделке
                  </TH>
                  <TH align="right" className="w-24">
                    Коэф. подр.
                  </TH>
                  <TH align="right" className="w-28">
                    Премии
                  </TH>
                  <TH align="right" className="w-28">
                    Штрафы
                  </TH>
                  <TH align="right" className="w-32">
                    Итого к выплате
                  </TH>
                  <TH className="w-32">Статус табеля</TH>
                  <TH className="w-36">Проверил</TH>
                  <TH align="right" className="w-28">
                    Действие
                  </TH>
                </TR>
              </THead>
              <TBody>
                {summaries.map((s) => {
                  const status = s.period?.status ?? "open";
                  const isApproved = status === "approved";
                  return (
                    <TR key={s.divisionId}>
                      <TD className="font-medium text-ink-900">
                        {s.divisionName}
                        {isApproved ? (
                          <Lock size={11} className="ml-1.5 inline text-ink-400" />
                        ) : null}
                      </TD>
                      <TD align="right">
                        <MoneyCell>{s.employeesCount}</MoneyCell>
                      </TD>
                      <TD align="right">
                        <MoneyCell>{s.operationsCount}</MoneyCell>
                      </TD>
                      <TD align="right">
                        {s.missingTariffCount > 0 ? (
                          <Badge tone="warning">{s.missingTariffCount}</Badge>
                        ) : (
                          <MoneyCell muted>0</MoneyCell>
                        )}
                      </TD>
                      <TD align="right">
                        <MoneyCell>{formatMoney(s.pieceworkTotal)}</MoneyCell>
                      </TD>
                      <TD align="right">
                        <MoneyCell muted={s.divisionCoefficientValue === 1}>
                          {formatCoefficient(s.divisionCoefficientValue)}
                        </MoneyCell>
                      </TD>
                      <TD align="right">
                        <MoneyCell className={s.bonusTotal > 0 ? "text-paid" : undefined}>
                          {formatMoney(s.bonusTotal)}
                        </MoneyCell>
                      </TD>
                      <TD align="right">
                        <MoneyCell className={s.penaltyTotal > 0 ? "text-reject" : undefined}>
                          {formatMoney(s.penaltyTotal)}
                        </MoneyCell>
                      </TD>
                      <TD align="right">
                        <MoneyCell emphasis>{formatMoney(s.finalPayout)}</MoneyCell>
                      </TD>
                      <TD>
                        <StatusBadge
                          status={status === "in_review" ? "period_in_review" : status}
                          label={TIMESHEET_PERIOD_STATUS_LABEL[status]}
                        />
                      </TD>
                      <TD className="text-ink-600">
                        {s.period?.checkedByPersonId
                          ? getPersonName(s.period.checkedByPersonId, state.persons)
                          : "—"}
                      </TD>
                      <TD align="right">
                        {status === "in_review" ? (
                          <Button
                            size="xs"
                            variant="success"
                            onClick={() =>
                              dispatch({
                                type: "period/approve",
                                periodId: s.period!.id,
                                approverPersonId: currentPerson.id,
                              })
                            }
                          >
                            Утвердить
                          </Button>
                        ) : isApproved ? (
                          <span className="inline-flex items-center gap-1 text-2xs text-ink-500">
                            <Lock size={10} />
                            {getPersonName(s.period?.approvedByPersonId, state.persons)}
                          </span>
                        ) : (
                          <span className="text-2xs text-ink-400">ожидает бригадира</span>
                        )}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}
