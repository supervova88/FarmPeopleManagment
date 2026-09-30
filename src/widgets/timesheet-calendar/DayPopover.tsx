import { Lock, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CalendarCell } from "@/app/store/selectors";
import { useStore } from "@/app/store/StoreProvider";
import { getPersonShortName } from "@/entities/person/mock";
import { getSopNameFrom, indexSops } from "@/entities/sop/helpers";
import { coPerformerIds, type SopFact } from "@/entities/sopFact/model";
import { formatQuantityWithUnit } from "@/entities/tariff/model";
import type { TimesheetLine } from "@/entities/timesheet/model";
import {
  isPlanItemOpen,
  WORK_PLAN_STATUS_LABEL,
  type WorkPlanItem,
} from "@/entities/workPlan/model";
import { cn, formatDate, formatMoney } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Field, Textarea } from "@/shared/ui/Field";
import { Hint } from "@/shared/ui/Hint";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { MoneyCell } from "@/shared/ui/Table";

/**
 * Всплывающая панель дня: план + факты, добавить в план / факт, отклонить.
 */
export function DayPopover({
  open,
  anchorRect,
  personName,
  personId,
  cell,
  factsMap,
  locked,
  canEdit,
  onClose,
  onAddFact,
  onAddPlan,
  onCancelPlan,
  onReject,
}: {
  open: boolean;
  anchorRect: DOMRect | null;
  personName: string;
  personId: string;
  cell: CalendarCell | null;
  factsMap: Map<string, SopFact>;
  locked: boolean;
  canEdit: boolean;
  onClose: () => void;
  onAddFact: () => void;
  onAddPlan: () => void;
  onCancelPlan: (item: WorkPlanItem) => void;
  onReject: (line: TimesheetLine, comment: string) => void;
}) {
  const { state } = useStore();
  const sopById = indexSops(state.sops);
  const panelRef = useRef<HTMLDivElement>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRejectingId(null);
      setComment("");
      setError(null);
    }
  }, [open, cell?.date]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onDoc(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDoc);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open || !cell || !anchorRect) return null;

  const editable = canEdit && !locked;
  const top = Math.min(anchorRect.bottom + 4, window.innerHeight - 360);
  const left = Math.min(Math.max(8, anchorRect.left), window.innerWidth - 380);

  function submitReject(line: TimesheetLine) {
    if (comment.trim().length < 10) {
      setError("Укажите причину отклонения — не менее 10 символов");
      return;
    }
    onReject(line, comment.trim());
    setRejectingId(null);
    setComment("");
    setError(null);
  }

  return (
    <div
      ref={panelRef}
      className="fixed z-50 w-[360px] overflow-hidden rounded border border-line bg-white shadow-overlay print:hidden"
      style={{ top, left }}
    >
      <header className="flex items-start justify-between gap-2 border-b border-line bg-canvas px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-ink-900">{personName}</p>
          <p className="tabular text-2xs text-ink-500">{formatDate(cell.date)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-ink-400 hover:bg-line hover:text-ink-700"
          aria-label="Закрыть"
        >
          <X size={14} />
        </button>
      </header>

      <div className="space-y-2 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2 rounded border border-line bg-accent-soft px-2.5 py-1.5">
          <span className="text-2xs font-semibold uppercase tracking-wide text-ink-500">
            Заработано за день (сделка)
          </span>
          <MoneyCell emphasis className="text-sm text-accent">
            {cell.dayTotal === null ? "—" : formatMoney(cell.dayTotal)}
          </MoneyCell>
        </div>

        {cell.openPlanCount > 0 ? (
          <Badge tone="info">В плане без факта: {cell.openPlanCount}</Badge>
        ) : null}
        {cell.missingTariffCount > 0 ? (
          <Badge tone="warning">Без тарифа: {cell.missingTariffCount}</Badge>
        ) : null}

        {locked ? (
          <Hint tone="locked">
            <span className="inline-flex items-center gap-1">
              <Lock size={12} /> Период утверждён — правки недоступны
            </span>
          </Hint>
        ) : null}

        <div>
          <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-ink-500">План</p>
          <div className="max-h-36 space-y-1.5 overflow-y-auto">
            {cell.planItems.length === 0 ? (
              <p className="py-1 text-xs text-ink-500">Задач в плане нет.</p>
            ) : (
              cell.planItems.map((item) => {
                const sop = sopById.get(item.sopId);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded border border-line px-2 py-1.5",
                      isPlanItemOpen(item) && "border-accent/40 bg-accent-soft/50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-ink-900">
                          {sop?.code ?? ""} · {getSopNameFrom(state.sops, item.sopId)}
                        </p>
                        <p className="truncate text-2xs text-ink-500">
                          {item.objectLabel} · план {item.plannedQuantity}
                        </p>
                        <div className="mt-1">
                          <StatusBadge
                            status={item.status}
                            label={WORK_PLAN_STATUS_LABEL[item.status]}
                          />
                        </div>
                      </div>
                      {editable && isPlanItemOpen(item) ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          title="Снять с плана"
                          onClick={() => onCancelPlan(item)}
                        >
                          <Trash2 size={11} />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div>
          <p className="mb-1 text-2xs font-semibold uppercase tracking-wide text-ink-500">Факт</p>
          <div className="max-h-48 space-y-1.5 overflow-y-auto">
            {cell.lines.length === 0 ? (
              <p className="py-1 text-xs text-ink-500">Операций в этот день нет.</p>
            ) : (
              cell.lines.map((line) => {
                const fact = line.factId ? factsMap.get(line.factId) : undefined;
                const sop = sopById.get(line.sopId);
                const isRejecting = rejectingId === line.id;
                return (
                  <div
                    key={line.id}
                    className={cn(
                      "rounded border border-line px-2 py-1.5",
                      line.status === "tariff_missing" && "border-pending-line bg-pending-soft",
                      line.status === "rejected" && "opacity-60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-ink-900">
                          {sop?.code ?? ""} · {line.sopName}
                        </p>
                        <p className="truncate text-2xs text-ink-500">
                          {fact?.objectLabel ?? "—"} ·{" "}
                          {formatQuantityWithUnit(line.quantity, line.appliedUnit)}
                          {fact && coPerformerIds(fact, personId).length > 0
                            ? ` · совместно с ${coPerformerIds(fact, personId)
                                .map((id) => getPersonShortName(id, state.persons))
                                .join(", ")}`
                            : ""}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <StatusBadge status={line.status} />
                          <span className="tabular text-2xs text-ink-600">
                            {line.amount === null ? "—" : formatMoney(line.amount)}
                          </span>
                        </div>
                      </div>
                      {editable && line.status !== "rejected" ? (
                        <Button
                          size="xs"
                          variant="ghost"
                          title="Отклонить (нужен комментарий)"
                          onClick={() => {
                            setRejectingId(line.id);
                            setComment("");
                            setError(null);
                          }}
                        >
                          <Trash2 size={11} />
                        </Button>
                      ) : null}
                    </div>

                    {isRejecting ? (
                      <div className="mt-2 space-y-1.5 border-t border-line-soft pt-2">
                        <Field label="Причина отклонения" required error={error}>
                          <Textarea
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Почему операция снимается с оплаты"
                            rows={2}
                          />
                        </Field>
                        <div className="flex justify-end gap-1">
                          <Button size="xs" variant="outline" onClick={() => setRejectingId(null)}>
                            Отмена
                          </Button>
                          <Button size="xs" variant="danger" onClick={() => submitReject(line)}>
                            Отклонить
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {editable ? (
          <div className="flex flex-col gap-1.5">
            <Button className="w-full" size="sm" variant="outline" onClick={onAddPlan}>
              <Plus size={13} />В план работ
            </Button>
            <Button className="w-full" size="sm" variant="outline" onClick={onAddFact}>
              <Plus size={13} />
              Факт задним числом
            </Button>
          </div>
        ) : null}

        <p className="text-2xs leading-snug text-ink-400">
          План не создаёт оплату. Факт → табельная позиция. Приём табеля — на экране «Табель
          подразделения».
        </p>
      </div>
    </div>
  );
}
