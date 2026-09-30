import { useStore } from "@/app/store/StoreProvider";
import { getDivisionName } from "@/entities/division/mock";
import type { PayoutBreakdown } from "@/features/payroll/calcFinalPayout";
import { formatCoefficient, formatCoefficientDelta, formatMoney } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { Metric } from "@/shared/ui/Metric";

/** Компактная сводка расчёта за период — используется в экране специалиста. */
export function PeriodSummary({ breakdown }: { breakdown: PayoutBreakdown }) {
  const { state } = useStore();
  const person = state.persons.find((p) => p.id === breakdown.personId);

  return (
    <Panel>
      <PanelHeader
        title="Сводка за период"
        subtitle={
          person
            ? `${person.fullName} · ${getDivisionName(person.divisionId, state.divisions)}`
            : undefined
        }
        actions={
          breakdown.missingTariffCount > 0 ? (
            <Badge tone="warning">Без тарифа: {breakdown.missingTariffCount}</Badge>
          ) : null
        }
      />
      <PanelBody className="space-y-3">
        <div className="grid grid-cols-5 gap-2">
          <Metric label="Операций учтено" value={breakdown.countedOperationsCount} />
          <Metric
            label="Сумма по сделке"
            value={formatMoney(breakdown.pieceworkTotal)}
          />
          <Metric
            label="Коэф. подразделения"
            value={formatCoefficient(breakdown.divisionCoefficientValue)}
            hint={
              breakdown.divisionCoefficient
                ? formatCoefficientDelta(breakdown.divisionCoefficientValue)
                : "не задан"
            }
          />
          <Metric
            label="Коэф. сотрудника"
            value={formatCoefficient(breakdown.personCoefficientValue)}
            hint={
              breakdown.personCoefficient
                ? formatCoefficientDelta(breakdown.personCoefficientValue)
                : "не задан"
            }
          />
          <Metric
            label="Итого к выплате"
            value={formatMoney(breakdown.finalPayout)}
            tone="accent"
            size="lg"
          />
        </div>
        {breakdown.formula ? (
          <p className="rounded border border-line-soft bg-canvas px-2.5 py-1.5 text-2xs text-ink-600">
            {breakdown.formula}
          </p>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
