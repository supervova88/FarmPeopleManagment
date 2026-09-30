import { useMemo, useState } from "react";
import { useStore } from "@/app/store/StoreProvider";
import { getPersonShortName } from "@/entities/person/mock";
import { listActiveTariffableL3 } from "@/entities/sop/helpers";
import { SOP_FACT_STATUS_LABEL } from "@/entities/sopFact/model";
import {
  formatQuantityWithUnit,
  formatRateUnitPerOne,
  TARIFF_RATE_UNIT_LABEL,
  type TariffRateUnit,
} from "@/entities/tariff/model";
import { findApplicableTariff } from "@/features/payroll/applyTariff";
import { DEMO_TODAY, formatDate } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Field, NumberInput, Select, TextInput } from "@/shared/ui/Field";
import { Modal } from "@/shared/ui/Modal";

const PAYABLE_OPTIONS: Array<"done" | "done_with_deviations"> = ["done", "done_with_deviations"];

/**
 * Создание производственного факта L3 из календарной ячейки.
 * Можно указать второго исполнителя — каждому создаётся своя позиция с полной ставкой.
 */
export function AddOperationModal({
  open,
  onClose,
  personName,
  personId,
  factDate,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  personName: string;
  personId: string;
  factDate: string;
  onSubmit: (payload: {
    sopId: string;
    objectLabel: string;
    factStatus: "done" | "done_with_deviations";
    quantity: number;
    performerPersonIds: string[];
  }) => void;
}) {
  const { state } = useStore();
  const tariffable = listActiveTariffableL3(state.sops);
  const person = state.persons.find((p) => p.id === personId);
  const divisionId = person?.divisionId ?? "";
  const jobTitle = person?.jobTitle ?? "";
  const [sopId, setSopId] = useState(tariffable[0]?.id ?? "");
  const [objectLabel, setObjectLabel] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [coPerformerId, setCoPerformerId] = useState("");
  const [factStatus, setFactStatus] = useState<"done" | "done_with_deviations">("done");
  const [error, setError] = useState<string | null>(null);

  const colleagues = useMemo(
    () =>
      state.persons.filter(
        (p) =>
          p.divisionId === divisionId &&
          p.id !== personId &&
          p.status === "working",
      ),
    [state.persons, divisionId, personId],
  );

  const rateUnit: TariffRateUnit = useMemo(() => {
    if (!sopId || !divisionId) return "operation";
    const tariff = findApplicableTariff(
      {
        sopId,
        divisionId,
        jobTitle,
        date: factDate || DEMO_TODAY,
      },
      state.tariffs,
    );
    return tariff?.rateUnit ?? "operation";
  }, [sopId, divisionId, jobTitle, factDate, state.tariffs]);

  function submit() {
    if (!sopId) {
      setError("Выберите операцию СОП уровня L3");
      return;
    }
    if (!objectLabel.trim()) {
      setError("Укажите объект операции (животное, домик, группа, инвентарь)");
      return;
    }
    const qty = Number(quantity.replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Укажите количество больше нуля");
      return;
    }
    const performerPersonIds = coPerformerId ? [personId, coPerformerId] : [personId];
    onSubmit({
      sopId,
      objectLabel: objectLabel.trim(),
      factStatus,
      quantity: qty,
      performerPersonIds,
    });
    setObjectLabel("");
    setQuantity("1");
    setCoPerformerId("");
    setFactStatus("done");
    setError(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Добавить операцию из СОП"
      subtitle={`${personName} · ${formatDate(factDate)}`}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit}>Создать факт и позицию</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field
          label="Операция СОП (L3)"
          required
          hint={`Создаётся производственный факт выполнения СОП. При совместной работе каждому исполнителю начисляется полная сумма (количество × ставка тарифа, ${formatRateUnitPerOne(rateUnit)}).`}
        >
          <Select value={sopId} onChange={(e) => setSopId(e.target.value)}>
            {tariffable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Объект операции"
          required
          hint="Место содержания / животное / инвентарь — не путать с подразделением оргструктуры"
        >
          <TextInput
            value={objectLabel}
            onChange={(e) => setObjectLabel(e.target.value)}
            placeholder="Например: Телёнок №4712 или Домик Д-14"
          />
        </Field>

        <Field
          label="Второй исполнитель"
          hint="Необязательно. Совместная уборка / приём — оба получают полную ставку"
        >
          <Select value={coPerformerId} onChange={(e) => setCoPerformerId(e.target.value)}>
            <option value="">Только {getPersonShortName(personId, state.persons)}</option>
            {colleagues.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label={`Количество (${TARIFF_RATE_UNIT_LABEL[rateUnit]})`}
          required
          hint={
            rateUnit === "operation"
              ? "Единица из действующего тарифа; если тарифа нет — операция"
              : `Единица из действующего тарифа: ${formatQuantityWithUnit(1, rateUnit)}`
          }
          error={error}
        >
          <NumberInput
            value={quantity}
            min={0}
            step={rateUnit === "hour" ? 0.5 : 1}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="1"
          />
        </Field>

        <Field label="Статус факта" hint="Только «Выполнено» и «с отклонениями» попадают в табель">
          <Select
            value={factStatus}
            onChange={(e) => setFactStatus(e.target.value as "done" | "done_with_deviations")}
          >
            {PAYABLE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {SOP_FACT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
