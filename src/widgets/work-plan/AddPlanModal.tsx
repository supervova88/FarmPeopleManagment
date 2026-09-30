import { useMemo, useState } from "react";
import { useStore } from "@/app/store/StoreProvider";
import { listActiveTariffableL3 } from "@/entities/sop/helpers";
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

/**
 * Добавление задачи в календарный план (без создания факта и оплаты).
 */
export function AddPlanModal({
  open,
  onClose,
  personName,
  personId,
  plannedDate,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  personName: string;
  personId: string;
  plannedDate: string;
  onSubmit: (payload: { sopId: string; objectLabel: string; plannedQuantity: number }) => void;
}) {
  const { state } = useStore();
  const tariffable = listActiveTariffableL3(state.sops);
  const person = state.persons.find((p) => p.id === personId);
  const divisionId = person?.divisionId ?? "";
  const jobTitle = person?.jobTitle ?? "";
  const [sopId, setSopId] = useState(tariffable[0]?.id ?? "");
  const [objectLabel, setObjectLabel] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const rateUnit: TariffRateUnit = useMemo(() => {
    if (!sopId || !divisionId) return "operation";
    const tariff = findApplicableTariff(
      {
        sopId,
        divisionId,
        jobTitle,
        date: plannedDate || DEMO_TODAY,
      },
      state.tariffs,
    );
    return tariff?.rateUnit ?? "operation";
  }, [sopId, divisionId, jobTitle, plannedDate, state.tariffs]);

  function submit() {
    if (!sopId) {
      setError("Выберите операцию СОП уровня L3");
      return;
    }
    if (!objectLabel.trim()) {
      setError("Укажите объект операции");
      return;
    }
    const qty = Number(quantity.replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Укажите количество больше нуля");
      return;
    }
    onSubmit({ sopId, objectLabel: objectLabel.trim(), plannedQuantity: qty });
    setObjectLabel("");
    setQuantity("1");
    setError(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Добавить в план работ"
      subtitle={`${personName} · ${formatDate(plannedDate)}`}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit}>В план</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field
          label="Операция СОП (L3)"
          required
          hint="Задача попадёт в календарный план. Оплата появится только после подтверждения исполнения."
        >
          <Select value={sopId} onChange={(e) => setSopId(e.target.value)}>
            {tariffable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Объект операции" required>
          <TextInput
            value={objectLabel}
            onChange={(e) => setObjectLabel(e.target.value)}
            placeholder="Например: Группа Г-1 или Домик Д-14"
          />
        </Field>

        <Field
          label={`Плановое количество (${TARIFF_RATE_UNIT_LABEL[rateUnit]})`}
          required
          hint={
            rateUnit === "operation"
              ? "Единица из тарифа; если тарифа нет — операция"
              : `Единица: ${formatQuantityWithUnit(1, rateUnit)} (${formatRateUnitPerOne(rateUnit)})`
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
      </div>
    </Modal>
  );
}
