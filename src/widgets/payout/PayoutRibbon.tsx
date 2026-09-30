import { Equal, Minus, Plus, X } from "lucide-react";
import type { ReactNode } from "react";
import { useStore } from "@/app/store/StoreProvider";
import { deviationRefById } from "@/entities/bonusPenalty/mock";
import { getPersonName } from "@/entities/person/mock";
import type { BonusPenalty } from "@/entities/bonusPenalty/model";
import type { PeriodCoefficient } from "@/entities/coefficient/model";
import type { PayoutBreakdown } from "@/features/payroll/calcFinalPayout";
import { cn, formatCoefficient, formatCoefficientDelta, formatDate, formatMoney } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { MoneyCell, Table, TBody, TD, TH, THead, TR } from "@/shared/ui/Table";

function StepRow({
  index,
  title,
  description,
  value,
  tone = "neutral",
  icon,
  children,
}: {
  index: number;
  title: string;
  description?: ReactNode;
  value?: string;
  tone?: "neutral" | "subtotal" | "final";
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-b border-line px-3 py-2.5 last:border-b-0",
        tone === "subtotal" && "bg-canvas",
        tone === "final" && "bg-accent-soft",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-semibold",
            tone === "final" ? "bg-accent text-white" : "bg-line-soft text-ink-600",
          )}
        >
          {icon ?? index}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "font-semibold text-ink-900",
              tone === "final" ? "text-sm" : "text-xs",
            )}
          >
            {title}
          </p>
          {description ? (
            <div className="mt-0.5 text-xs leading-relaxed text-ink-600">{description}</div>
          ) : null}
          {children ? <div className="mt-2">{children}</div> : null}
        </div>
        {value ? (
          <span
            className={cn(
              "tabular shrink-0 whitespace-nowrap font-semibold text-ink-900",
              tone === "final" ? "text-2xl text-accent" : tone === "subtotal" ? "text-base" : "text-sm",
            )}
          >
            {value}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function CoefficientStep({
  index,
  title,
  coefficient,
  value,
}: {
  index: number;
  title: string;
  coefficient: PeriodCoefficient | null;
  value: number;
}) {
  const { state } = useStore();
  return (
    <StepRow
      index={index}
      icon={<X size={11} />}
      title={title}
      value={`× ${formatCoefficient(value)}`}
      description={
        coefficient ? (
          <>
            <span
              className={cn("font-medium", coefficient.value >= 1 ? "text-paid" : "text-reject")}
            >
              {formatCoefficientDelta(coefficient.value)}
            </span>{" "}
            · основание: {coefficient.reason} · установил{" "}
            {getPersonName(coefficient.setByPersonId, state.persons)}
            <p className="mt-0.5 text-2xs text-ink-500">
              Коэффициент действует на весь расчётный период целиком, а не на отдельные операции.
            </p>
          </>
        ) : (
          <span className="text-ink-500">Не задан — применяется множитель 1,00</span>
        )
      }
    />
  );
}

function AccrualList({ items, kind }: { items: BonusPenalty[]; kind: "bonus" | "penalty" }) {
  const { state } = useStore();
  if (items.length === 0) {
    return <p className="text-xs text-ink-500">Начислений нет.</p>;
  }
  return (
    <Table>
      <THead>
        <TR>
          <TH>Основание</TH>
          <TH className="w-64">Отклонение / задача</TH>
          <TH className="w-36">Применил</TH>
          <TH className="w-24">Дата</TH>
          <TH className="w-28">Статус</TH>
          <TH align="right" className="w-28">
            Сумма
          </TH>
        </TR>
      </THead>
      <TBody>
        {items.map((item) => (
          <TR key={item.id}>
            <TD className="text-ink-800">{item.reason}</TD>
            <TD className="text-2xs text-ink-500">
              {item.linkedDeviationId
                ? (deviationRefById.get(item.linkedDeviationId)?.label ?? item.linkedDeviationId)
                : "—"}
            </TD>
            <TD className="text-ink-600">{getPersonName(item.appliedByPersonId, state.persons)}</TD>
            <TD className="tabular text-ink-600">{formatDate(item.decidedAt)}</TD>
            <TD>
              <StatusBadge status={item.status} />
            </TD>
            <TD align="right">
              <MoneyCell emphasis className={kind === "penalty" ? "text-reject" : "text-paid"}>
                {kind === "penalty" ? "−" : "+"}
                {formatMoney(item.amount)}
              </MoneyCell>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

/**
 * «Расчётная лента»: шаги от операций СОП и схем положения до итога к выплате.
 */
export function PayoutRibbon({
  breakdown,
  operationsSlot,
}: {
  breakdown: PayoutBreakdown;
  operationsSlot: ReactNode;
}) {
  const hasSchemes = breakdown.schemeLines.length > 0;
  let step = 1;

  return (
    <Panel>
      <PanelHeader
        title="Расчётная лента"
        subtitle="Как из операций СОП и схем положения получается итоговая сумма к выплате"
      />
      <PanelBody className="px-0 py-0">
        <StepRow
          index={step++}
          title="Операции СОП периода"
          description={
            <>
              {breakdown.countedOperationsCount} операций в расчёте
              {breakdown.rejectedCount > 0 ? `, ${breakdown.rejectedCount} отклонено` : ""}
              {breakdown.missingTariffCount > 0 ? (
                <>
                  {", "}
                  <span className="font-medium text-pending">
                    {breakdown.missingTariffCount} без тарифа (сумма не рассчитана)
                  </span>
                </>
              ) : null}
              . Сумма позиции = количество × ставка тарифа; единица измерения задаётся в тарифе.
              {hasSchemes ? (
                <> Сделка по СОП: {formatMoney(breakdown.sopPieceworkTotal)}.</>
              ) : null}
            </>
          }
        >
          <div className="overflow-hidden rounded border border-line">{operationsSlot}</div>
        </StepRow>

        {hasSchemes ? (
          <StepRow
            index={step++}
            title="Схемы оплаты по положению"
            description={
              breakdown.schemeFormula ||
              "Начисления за результат, смену и качество по утверждённой схеме."
            }
            value={formatMoney(breakdown.schemeTotal)}
          >
            <Table>
              <THead>
                <TR>
                  <TH>Компонент</TH>
                  <TH>Формула</TH>
                  <TH align="right">Сумма</TH>
                </TR>
              </THead>
              <TBody>
                {breakdown.schemeLines.map((line) => (
                  <TR key={line.id}>
                    <TD>
                      <p className="font-medium text-ink-900">{line.title}</p>
                      <p className="text-2xs text-ink-500">{line.schemeName}</p>
                    </TD>
                    <TD className="text-2xs text-ink-600">{line.formula}</TD>
                    <TD align="right">
                      <MoneyCell>{formatMoney(line.amount)}</MoneyCell>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </StepRow>
        ) : null}

        <StepRow
          index={step++}
          tone="subtotal"
          title="Промежуточный итог: сумма по сделке"
          description={
            hasSchemes
              ? `СОП ${formatMoney(breakdown.sopPieceworkTotal)} + положение ${formatMoney(breakdown.schemeTotal)}. Позиции без тарифа не добавляют ноль.`
              : `Сложены ${breakdown.paidOperationsCount} позиций с рассчитанной суммой. Позиции без тарифа не добавляют ноль — они ждут решения методолога.`
          }
          value={formatMoney(breakdown.pieceworkTotal)}
        />

        <CoefficientStep
          index={step++}
          title="Коэффициент подразделения"
          coefficient={breakdown.divisionCoefficient}
          value={breakdown.divisionCoefficientValue}
        />

        <CoefficientStep
          index={step++}
          title="Коэффициент сотрудника"
          coefficient={breakdown.personCoefficient}
          value={breakdown.personCoefficientValue}
        />

        <StepRow
          index={step++}
          tone="subtotal"
          title="Промежуточный итог: сумма после коэффициентов"
          description={`${formatMoney(breakdown.pieceworkTotal)} × ${formatCoefficient(
            breakdown.divisionCoefficientValue,
          )} × ${formatCoefficient(breakdown.personCoefficientValue)}`}
          value={formatMoney(breakdown.afterCoefficients)}
        />

        <StepRow
          index={step++}
          icon={<Plus size={11} />}
          title="Премии"
          description="Фиксированные суммы с обязательным основанием. Верхней границы нет. Проценты из положения считаются в схемах, не здесь."
          value={`+ ${formatMoney(breakdown.bonusTotal)}`}
        >
          <AccrualList items={breakdown.bonuses} kind="bonus" />
        </StepRow>

        <StepRow
          index={step++}
          icon={<Minus size={11} />}
          title="Штрафы"
          description="Фиксированные суммы с обязательным основанием. Оспаривание не снимает начисление — снимает только отмена."
          value={`− ${formatMoney(breakdown.penaltyTotal)}`}
        >
          <AccrualList items={breakdown.penalties} kind="penalty" />
        </StepRow>

        <StepRow
          index={step++}
          tone="final"
          icon={<Equal size={11} />}
          title="Итого к выплате"
          value={formatMoney(breakdown.finalPayout)}
          description={
            <div className="mt-1 rounded border border-accent-line bg-white px-2.5 py-1.5">
              <p className="text-2xs font-semibold uppercase tracking-wide text-ink-500">
                Формула расчёта
              </p>
              <p className="tabular mt-0.5 text-xs leading-relaxed text-ink-900">
                {breakdown.formula}
              </p>
            </div>
          }
        />
      </PanelBody>

      {breakdown.missingTariffCount > 0 ? (
        <div className="border-t border-line px-3 py-2">
          <Badge tone="warning">
            {breakdown.missingTariffCount} операций ожидают установки тарифа — итог может вырасти
            после пересчёта
          </Badge>
        </div>
      ) : null}
    </Panel>
  );
}
