import { CircleSlash, Gift } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/app/store/StoreProvider";
import { deviationRefById, deviationRefs } from "@/entities/bonusPenalty/mock";
import { BONUS_PENALTY_TYPE_LABEL, type BonusPenaltyType } from "@/entities/bonusPenalty/model";
import { getPersonName } from "@/entities/person/mock";
import type { Person } from "@/entities/person/model";
import type { TimesheetEntry } from "@/entities/timesheet/model";
import { DEMO_TODAY, formatDate, formatMoney } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { Field, NumberInput, Select, Textarea } from "@/shared/ui/Field";
import { Modal } from "@/shared/ui/Modal";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { MoneyCell, Table, TBody, TD, TH, THead, TR } from "@/shared/ui/Table";

/**
 * Блок премий и штрафов.
 * Лимитов, верхних границ и дополнительного согласования нет — по принятому решению.
 * Обязательное поле здесь только одно: основание.
 */
export function AccrualsPanel({
  entries,
  employees,
  locked,
}: {
  entries: TimesheetEntry[];
  employees: Person[];
  locked: boolean;
}) {
  const { state, dispatch, currentPerson } = useStore();
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<BonusPenaltyType>("bonus");
  const [personId, setPersonId] = useState(employees[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [deviationId, setDeviationId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const entryIds = new Set(entries.map((e) => e.id));
  const accruals = state.accruals.filter((a) => entryIds.has(a.entryId));

  function submit() {
    const numeric = Number(amount.replace(",", "."));
    const entry = entries.find((e) => e.personId === personId);
    if (!entry) {
      setError("У сотрудника нет табельной записи за период");
      return;
    }
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError("Укажите сумму больше нуля");
      return;
    }
    if (reason.trim().length < 5) {
      setError("Основание — обязательное поле");
      return;
    }

    dispatch({
      type: "accrual/add",
      payload: {
        personId,
        entryId: entry.id,
        type,
        amount: numeric,
        reason: reason.trim(),
        linkedDeviationId: deviationId || null,
        appliedByPersonId: currentPerson.id,
        decidedAt: DEMO_TODAY,
      },
    });

    setAmount("");
    setReason("");
    setDeviationId("");
    setError(null);
    setFormOpen(false);
  }

  return (
    <Panel>
      <PanelHeader
        title="Премии и штрафы"
        help="Фиксированные суммы к итогу периода. Верхней границы и доп. согласования нет — обязательно только текстовое основание; ссылка на отклонение или задачу по желанию."
        icon={<Gift size={14} />}
        actions={
          locked ? null : (
            <Button size="xs" onClick={() => setFormOpen(true)}>
              Начислить
            </Button>
          )
        }
      />
      <PanelBody className="space-y-2.5">
        {accruals.length === 0 ? (
          <p className="py-2 text-xs text-ink-500">Начислений за период нет.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH className="w-24">Тип</TH>
                <TH className="w-56">Сотрудник</TH>
                <TH align="right" className="w-28">
                  Сумма
                </TH>
                <TH>Основание</TH>
                <TH className="w-64">Отклонение / задача</TH>
                <TH className="w-40">Применил</TH>
                <TH className="w-24">Дата</TH>
                <TH className="w-28">Статус</TH>
                {locked ? null : <TH className="w-24" align="right" />}
              </TR>
            </THead>
            <TBody>
              {accruals.map((a) => (
                <TR key={a.id} className={a.status === "cancelled" ? "opacity-55" : undefined}>
                  <TD>
                    <StatusBadge
                      status={a.type === "bonus" ? "confirmed" : "rejected"}
                      label={BONUS_PENALTY_TYPE_LABEL[a.type]}
                    />
                  </TD>
                  <TD className="font-medium text-ink-900">{getPersonName(a.personId, state.persons)}</TD>
                  <TD align="right">
                    <MoneyCell emphasis className={a.type === "penalty" ? "text-reject" : "text-paid"}>
                      {a.type === "penalty" ? "−" : "+"}
                      {formatMoney(a.amount)}
                    </MoneyCell>
                  </TD>
                  <TD className="text-ink-700">{a.reason}</TD>
                  <TD className="text-2xs text-ink-500">
                    {a.linkedDeviationId
                      ? (deviationRefById.get(a.linkedDeviationId)?.label ?? a.linkedDeviationId)
                      : "—"}
                  </TD>
                  <TD className="text-ink-600">{getPersonName(a.appliedByPersonId, state.persons)}</TD>
                  <TD className="tabular text-ink-600">{formatDate(a.decidedAt)}</TD>
                  <TD>
                    <StatusBadge status={a.status} />
                  </TD>
                  {locked ? null : (
                    <TD align="right">
                      {a.status !== "cancelled" ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          title="Отменить начисление"
                          onClick={() => dispatch({ type: "accrual/cancel", accrualId: a.id })}
                        >
                          <CircleSlash size={11} />
                        </Button>
                      ) : null}
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
        title="Начислить премию или штраф"
        subtitle="Сумма фиксированная, не процент от сделки"
        onClose={() => setFormOpen(false)}
        width="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Отмена
            </Button>
            <Button onClick={submit}>Начислить</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Тип начисления" required>
              <Select value={type} onChange={(e) => setType(e.target.value as BonusPenaltyType)}>
                <option value="bonus">Премия</option>
                <option value="penalty">Штраф</option>
              </Select>
            </Field>
            <Field label="Сумма, ₽" required hint="Ограничений по величине нет">
              <NumberInput
                value={amount}
                min={0}
                step={500}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
              />
            </Field>
          </div>

          <Field label="Сотрудник" required>
            <Select value={personId} onChange={(e) => setPersonId(e.target.value)}>
              {employees.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Основание" required error={error}>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Например: выход в ночную смену при внеплановом отёле, молозиво выпоено в норматив"
            />
          </Field>

          <Field label="Ссылка на отклонение или задачу" hint="Не обязательно">
            <Select value={deviationId} onChange={(e) => setDeviationId(e.target.value)}>
              <option value="">Без ссылки</option>
              {deviationRefs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>
    </Panel>
  );
}
