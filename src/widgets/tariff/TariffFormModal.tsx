import { useMemo, useState } from "react";
import { useStore } from "@/app/store/StoreProvider";
import { listActiveTariffableL3 } from "@/entities/sop/helpers";
import {
  formatRateUnitPerOne,
  TARIFF_RATE_UNIT_LABEL,
  TARIFF_RATE_UNIT_ORDER,
  type TariffRateUnit,
} from "@/entities/tariff/model";
import { formatDate, formatMoney, previousDay } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Field, NumberInput, Select, TextInput } from "@/shared/ui/Field";
import { Hint } from "@/shared/ui/Hint";
import { Modal } from "@/shared/ui/Modal";

/**
 * Форма создания тарифа. Всегда создаёт ЧЕРНОВИК:
 * перевод в статус «действует» — отдельный шаг управляющего по направлению.
 */
export function TariffFormModal({
  open,
  onClose,
  presetSopId,
}: {
  open: boolean;
  onClose: () => void;
  presetSopId?: string;
}) {
  const { state, dispatch, currentPerson } = useStore();

  const activeDivisions = state.divisions.filter((d) => d.status === "active");
  const tariffableSops = listActiveTariffableL3(state.sops);
  const [sopId, setSopId] = useState(presetSopId ?? tariffableSops[0]?.id ?? "");
  const [divisionId, setDivisionId] = useState(activeDivisions[0]?.id ?? "");
  const [jobTitle, setJobTitle] = useState("");
  const [rate, setRate] = useState("");
  const [rateUnit, setRateUnit] = useState<TariffRateUnit>("operation");
  const [validFrom, setValidFrom] = useState("2026-08-01");
  const [validTo, setValidTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const jobTitles = useMemo(
    () =>
      Array.from(
        new Set(
          state.persons.filter((p) => p.divisionId === divisionId).map((p) => p.jobTitle),
        ),
      ),
    [divisionId, state.persons],
  );

  /** Действующая версия, которую закроет новая при утверждении. */
  const supersededTariff = useMemo(
    () =>
      state.tariffs
        .filter(
          (t) =>
            t.sopId === sopId &&
            t.divisionId === divisionId &&
            (t.jobTitle ?? "") === jobTitle &&
            t.status === "active" &&
            t.validFrom < validFrom,
        )
        .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] ?? null,
    [state.tariffs, sopId, divisionId, jobTitle, validFrom],
  );

  function reset() {
    setRate("");
    setRateUnit("operation");
    setValidTo("");
    setError(null);
  }

  function submit() {
    const rateValue = Number(rate.replace(",", "."));
    if (!sopId) return setError("Выберите СОП уровня L3");
    if (!Number.isFinite(rateValue) || rateValue <= 0) return setError("Укажите ставку больше нуля");
    if (!validFrom) return setError("Укажите дату начала действия");
    if (validTo && validTo < validFrom) return setError("Дата окончания раньше даты начала");

    dispatch({
      type: "tariff/createDraft",
      authorPersonId: currentPerson.id,
      payload: {
        sopId,
        divisionId,
        jobTitle: jobTitle || null,
        rate: rateValue,
        rateUnit,
        validFrom,
        validTo: validTo || null,
      },
    });
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Создать тариф СОП"
      subtitle="Тариф создаётся черновиком и начинает действовать только после утверждения управляющим по направлению"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit}>Создать черновик</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="СОП (только уровень L3)" required className="col-span-2">
          <Select value={sopId} onChange={(e) => setSopId(e.target.value)}>
            {tariffableSops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Подразделение" required>
          <Select
            value={divisionId}
            onChange={(e) => {
              setDivisionId(e.target.value);
              setJobTitle("");
            }}
          >
            {activeDivisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Должность"
          hint="Не обязательно. Если указана — тариф действует только для этой должности и имеет приоритет над общим"
        >
          <Select value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}>
            <option value="">Все должности подразделения</option>
            {jobTitles.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Единица измерения" required hint="Ставка задаётся за одну выбранную единицу">
          <Select value={rateUnit} onChange={(e) => setRateUnit(e.target.value as TariffRateUnit)}>
            {TARIFF_RATE_UNIT_ORDER.map((u) => (
              <option key={u} value={u}>
                {TARIFF_RATE_UNIT_LABEL[u]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Ставка, ₽" required hint={formatRateUnitPerOne(rateUnit)}>
          <NumberInput value={rate} min={0} step={5} onChange={(e) => setRate(e.target.value)} placeholder="0" />
        </Field>

        <Field label="Дата начала действия" required>
          <TextInput type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        </Field>

        <Field label="Дата окончания действия" hint="Пусто = действует бессрочно" className="col-span-2">
          <TextInput type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
        </Field>
      </div>

      {supersededTariff ? (
        <Hint tone="warning" className="mt-3">
          При утверждении этого тарифа действующая версия{" "}
          <strong>{formatMoney(supersededTariff.rate)}</strong> (с{" "}
          {formatDate(supersededTariff.validFrom)}) автоматически получит дату окончания{" "}
          <strong>{formatDate(previousDay(validFrom))}</strong> — день до начала новой версии — и уйдёт
          в архив. Операции, выполненные до этой даты, сохранят старую ставку.
        </Hint>
      ) : null}

      {error ? (
        <p className="mt-3 rounded border border-reject-line bg-reject-soft px-2.5 py-1.5 text-xs text-reject">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
