import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/app/store/StoreProvider";
import { getSopNameFrom, indexSops } from "@/entities/sop/helpers";
import { SOP_FACT_STATUS_LABEL } from "@/entities/sopFact/model";
import {
  formatQuantityWithUnit,
  TARIFF_RATE_UNIT_LABEL,
  type TariffRateUnit,
} from "@/entities/tariff/model";
import type { WorkPlanItem } from "@/entities/workPlan/model";
import { findApplicableTariff } from "@/features/payroll/applyTariff";
import { DEMO_TODAY, formatDate } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Field, NumberInput, Select, TextInput } from "@/shared/ui/Field";
import { Modal } from "@/shared/ui/Modal";

const PAYABLE_OPTIONS: Array<"done" | "done_with_deviations"> = ["done", "done_with_deviations"];

/** Правка открытой задачи плана (объект / количество). */
export function EditPlanModal({
  open,
  item,
  onClose,
  onSubmit,
}: {
  open: boolean;
  item: WorkPlanItem | null;
  onClose: () => void;
  onSubmit: (payload: { objectLabel: string; plannedQuantity: number }) => void;
}) {
  const { state } = useStore();
  const [objectLabel, setObjectLabel] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setObjectLabel(item.objectLabel);
    setQuantity(String(item.plannedQuantity));
    setError(null);
  }, [item]);

  const person = state.persons.find((p) => p.id === item?.personId);
  const rateUnit: TariffRateUnit = useMemo(() => {
    if (!item || !person) return "operation";
    const tariff = findApplicableTariff(
      {
        sopId: item.sopId,
        divisionId: person.divisionId,
        jobTitle: person.jobTitle,
        date: item.plannedDate || DEMO_TODAY,
      },
      state.tariffs,
    );
    return tariff?.rateUnit ?? "operation";
  }, [item, person, state.tariffs]);

  if (!item) return null;

  function submit() {
    if (!objectLabel.trim()) {
      setError("Укажите объект операции");
      return;
    }
    const qty = Number(quantity.replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Укажите количество больше нуля");
      return;
    }
    onSubmit({ objectLabel: objectLabel.trim(), plannedQuantity: qty });
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Скорректировать задачу"
      subtitle={`${getSopNameFrom(state.sops, item.sopId)} · ${formatDate(item.plannedDate)}`}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit}>Сохранить</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Объект операции" required>
          <TextInput value={objectLabel} onChange={(e) => setObjectLabel(e.target.value)} />
        </Field>
        <Field label={`Количество (${TARIFF_RATE_UNIT_LABEL[rateUnit]})`} required error={error}>
          <NumberInput
            value={quantity}
            min={0}
            step={rateUnit === "hour" ? 0.5 : 1}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

/** Подтверждение исполнения задачи плана → факт + табельная позиция. */
export function CompletePlanModal({
  open,
  item,
  onClose,
  onSubmit,
}: {
  open: boolean;
  item: WorkPlanItem | null;
  onClose: () => void;
  onSubmit: (payload: {
    factStatus: "done" | "done_with_deviations";
    quantity: number;
    objectLabel: string;
  }) => void;
}) {
  const { state } = useStore();
  const sopById = indexSops(state.sops);
  const [objectLabel, setObjectLabel] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [factStatus, setFactStatus] = useState<"done" | "done_with_deviations">("done");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setObjectLabel(item.objectLabel);
    setQuantity(String(item.plannedQuantity));
    setFactStatus("done");
    setError(null);
  }, [item]);

  const person = state.persons.find((p) => p.id === item?.personId);
  const rateUnit: TariffRateUnit = useMemo(() => {
    if (!item || !person) return "operation";
    const tariff = findApplicableTariff(
      {
        sopId: item.sopId,
        divisionId: person.divisionId,
        jobTitle: person.jobTitle,
        date: item.plannedDate || DEMO_TODAY,
      },
      state.tariffs,
    );
    return tariff?.rateUnit ?? "operation";
  }, [item, person, state.tariffs]);

  if (!item) return null;

  const sop = sopById.get(item.sopId);

  function submit() {
    if (!objectLabel.trim()) {
      setError("Укажите объект операции");
      return;
    }
    const qty = Number(quantity.replace(",", "."));
    if (!Number.isFinite(qty) || qty <= 0) {
      setError("Укажите фактическое количество больше нуля");
      return;
    }
    onSubmit({
      factStatus,
      quantity: qty,
      objectLabel: objectLabel.trim(),
    });
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Подтвердить исполнение"
      subtitle={`${sop?.code ?? ""} · ${sop?.name ?? item.sopId} · ${formatDate(item.plannedDate)}`}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="success" onClick={submit}>
            Создать факт и позицию
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Объект" required>
          <TextInput value={objectLabel} onChange={(e) => setObjectLabel(e.target.value)} />
        </Field>
        <Field
          label={`Фактическое количество (${TARIFF_RATE_UNIT_LABEL[rateUnit]})`}
          required
          hint={`План: ${formatQuantityWithUnit(item.plannedQuantity, rateUnit)}`}
          error={error}
        >
          <NumberInput
            value={quantity}
            min={0}
            step={rateUnit === "hour" ? 0.5 : 1}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </Field>
        <Field label="Статус факта">
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
