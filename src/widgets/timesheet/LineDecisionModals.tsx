import { useState } from "react";
import { formatQuantityWithUnit, formatRateUnitPerOne } from "@/entities/tariff/model";
import type { TimesheetLine } from "@/entities/timesheet/model";
import { formatDate, formatMoney } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Field, NumberInput, Textarea } from "@/shared/ui/Field";
import { Hint } from "@/shared/ui/Hint";
import { Modal } from "@/shared/ui/Modal";

/** Отклонение позиции: комментарий обязателен. */
export function RejectLineModal({
  line,
  onClose,
  onConfirm,
}: {
  line: TimesheetLine | null;
  onClose: () => void;
  onConfirm: (comment: string) => void;
}) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (comment.trim().length < 10) {
      setError("Опишите причину отклонения подробнее — не менее 10 символов");
      return;
    }
    onConfirm(comment.trim());
    setComment("");
    setError(null);
  }

  return (
    <Modal
      open={line !== null}
      title="Отклонить табельную позицию"
      subtitle={line ? `${line.sopName} · ${formatDate(line.factDate)}` : undefined}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="danger" onClick={submit}>
            Отклонить позицию
          </Button>
        </>
      }
    >
      <Hint tone="warning" className="mb-3">
        Отклонённая позиция полностью исключается из суммы по сделке. Производственный факт при этом
        остаётся в системе — отменяется только оплата.
      </Hint>
      <Field label="Причина отклонения" required error={error}>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Например: операция выполнена не в свою смену и уже оплачена другому исполнителю"
        />
      </Field>
    </Modal>
  );
}

/** Ручная корректировка суммы — исключение, а не основной сценарий. */
export function AdjustLineModal({
  line,
  onClose,
  onConfirm,
}: {
  line: TimesheetLine | null;
  onClose: () => void;
  onConfirm: (amount: number | null, comment: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const value = amount.trim() === "" ? null : Number(amount.replace(",", "."));
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      setError("Сумма должна быть числом не меньше нуля");
      return;
    }
    if (comment.trim().length < 10) {
      setError("Комментарий причины обязателен — не менее 10 символов");
      return;
    }
    onConfirm(value, comment.trim());
    setAmount("");
    setComment("");
    setError(null);
  }

  return (
    <Modal
      open={line !== null}
      title="Скорректировать позицию вручную"
      subtitle={line ? `${line.sopName} · ${formatDate(line.factDate)}` : undefined}
      onClose={onClose}
      width="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="warning" onClick={submit}>
            Применить корректировку
          </Button>
        </>
      }
    >
      <Hint tone="warning" className="mb-3">
        Ручная корректировка — исключение, а не основной сценарий. В норме сумма позиции берётся из
        тарифа автоматически. Каждая корректировка попадает в историю расчёта с указанием автора и
        причины.
      </Hint>

      {line ? (
        <p className="mb-3 rounded border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink-600">
          Текущая сумма позиции:{" "}
          <span className="tabular font-semibold text-ink-900">
            {line.amount === null ? "не рассчитана" : formatMoney(line.amount)}
          </span>
          {line.appliedRate !== null ? (
            <>
              {" "}
              · тариф {formatMoney(line.appliedRate)}
              {line.appliedUnit ? ` (${formatRateUnitPerOne(line.appliedUnit)})` : ""} ×{" "}
              {formatQuantityWithUnit(line.quantity, line.appliedUnit)}
            </>
          ) : null}
        </p>
      ) : null}

      <div className="space-y-3">
        <Field
          label="Новая сумма позиции, ₽"
          hint="Пусто = снять сумму (позиция останется зафиксированной, но неоплаченной)"
        >
          <NumberInput
            value={amount}
            min={0}
            step={10}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />
        </Field>
        <Field label="Причина корректировки" required error={error}>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Например: факт задвоился при сбое синхронизации терминала, вторая запись снята с оплаты"
          />
        </Field>
      </div>
    </Modal>
  );
}
