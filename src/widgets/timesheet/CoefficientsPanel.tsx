import { Percent, Trash2 } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/app/store/StoreProvider";
import { getDivisionName } from "@/entities/division/mock";
import { getPersonName } from "@/entities/person/mock";
import type { Person } from "@/entities/person/model";
import { COEFFICIENT_SCOPE_LABEL, type CoefficientScope } from "@/entities/coefficient/model";
import type { TimesheetPeriod } from "@/entities/timesheet/model";
import { formatCoefficient, formatCoefficientDelta } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { Field, NumberInput, Select, Textarea } from "@/shared/ui/Field";
import { Modal } from "@/shared/ui/Modal";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/Table";

/**
 * Блок коэффициентов периода.
 * Коэффициент задаётся на весь расчётный период целиком — интерфейса для привязки
 * коэффициента к отдельной операции или к части периода намеренно нет.
 */
export function CoefficientsPanel({
  period,
  divisionId,
  employees,
  locked,
}: {
  period: TimesheetPeriod;
  divisionId: string;
  employees: Person[];
  locked: boolean;
}) {
  const { state, dispatch, currentPerson } = useStore();
  const [formOpen, setFormOpen] = useState(false);
  const [scope, setScope] = useState<CoefficientScope>("division");
  const [targetId, setTargetId] = useState(divisionId);
  const [value, setValue] = useState("1.10");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const coefficients = state.coefficients.filter((c) => c.periodId === period.id);

  function openForm(nextScope: CoefficientScope) {
    setScope(nextScope);
    setTargetId(nextScope === "division" ? divisionId : (employees[0]?.id ?? ""));
    setValue("1.10");
    setReason("");
    setError(null);
    setFormOpen(true);
  }

  function submit() {
    const numeric = Number(value.replace(",", "."));
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError("Коэффициент должен быть положительным числом, например 1,10 или 0,95");
      return;
    }
    if (reason.trim().length < 5) {
      setError("Укажите основание для коэффициента");
      return;
    }
    dispatch({
      type: "coefficient/set",
      scope,
      targetId,
      periodId: period.id,
      value: numeric,
      reason: reason.trim(),
      setByPersonId: currentPerson.id,
    });
    setFormOpen(false);
  }

  return (
    <Panel>
      <PanelHeader
        title="Коэффициенты периода"
        help={`Действуют на весь период «${period.periodLabel}» целиком, а не на отдельные операции. Даже если решение принято в середине месяца, для периода используется одно значение.`}
        icon={<Percent size={14} />}
        actions={
          locked ? null : (
            <>
              <Button size="xs" variant="outline" onClick={() => openForm("division")}>
                Коэффициент подразделения
              </Button>
              <Button size="xs" variant="outline" onClick={() => openForm("person")}>
                Коэффициент сотрудника
              </Button>
            </>
          )
        }
      />
      <PanelBody className="space-y-2.5">
        {coefficients.length === 0 ? (
          <p className="py-2 text-xs text-ink-500">
            Коэффициенты за период не заданы — расчёт идёт с множителем 1,00.
          </p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH className="w-40">Область действия</TH>
                <TH>Объект</TH>
                <TH align="right" className="w-24">
                  Значение
                </TH>
                <TH className="w-28">Эффект</TH>
                <TH>Основание</TH>
                <TH className="w-40">Установил</TH>
                <TH className="w-24">Статус</TH>
                {locked ? null : <TH className="w-16" align="right" />}
              </TR>
            </THead>
            <TBody>
              {coefficients.map((c) => (
                <TR key={c.id}>
                  <TD className="text-ink-600">{COEFFICIENT_SCOPE_LABEL[c.scope]}</TD>
                  <TD className="font-medium text-ink-900">
                    {c.scope === "division"
                      ? getDivisionName(c.targetId, state.divisions)
                      : getPersonName(c.targetId, state.persons)}
                  </TD>
                  <TD align="right">
                    <span className="tabular font-semibold">{formatCoefficient(c.value)}</span>
                  </TD>
                  <TD className={c.value >= 1 ? "text-paid" : "text-reject"}>
                    {formatCoefficientDelta(c.value)}
                  </TD>
                  <TD className="text-ink-600">{c.reason}</TD>
                  <TD className="text-ink-600">{getPersonName(c.setByPersonId, state.persons)}</TD>
                  <TD>
                    <StatusBadge status={c.status} />
                  </TD>
                  {locked ? null : (
                    <TD align="right">
                      <Button
                        size="xs"
                        variant="ghost"
                        title="Убрать коэффициент"
                        onClick={() => dispatch({ type: "coefficient/remove", coefficientId: c.id })}
                      >
                        <Trash2 size={11} />
                      </Button>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </PanelBody>

      <Modal
        open={formOpen}
        title={
          scope === "division" ? "Коэффициент подразделения на период" : "Коэффициент сотрудника на период"
        }
        subtitle={`Период «${period.periodLabel}», применяется ко всем операциям периода целиком`}
        onClose={() => setFormOpen(false)}
        width="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Отмена
            </Button>
            <Button onClick={submit}>Установить коэффициент</Button>
          </>
        }
      >
        <div className="space-y-3">
          {scope === "person" ? (
            <Field label="Сотрудник" required>
              <Select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                {employees.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Подразделение">
              <Select value={targetId} disabled>
                <option value={divisionId}>{getDivisionName(divisionId, state.divisions)}</option>
              </Select>
            </Field>
          )}

          <Field
            label="Значение коэффициента"
            required
            hint="1,10 = +10 % к сумме по сделке; 0,95 = −5 %"
          >
            <NumberInput value={value} step={0.05} min={0} onChange={(e) => setValue(e.target.value)} />
          </Field>

          <Field label="Основание" required error={error}>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Например: сохранность телят за период 98,4 % при плане 96 %"
            />
          </Field>
        </div>
      </Modal>
    </Panel>
  );
}
