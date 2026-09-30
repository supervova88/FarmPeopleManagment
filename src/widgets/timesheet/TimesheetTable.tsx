import { Check, ChevronDown, ChevronRight, Pencil, ReceiptText, X } from "lucide-react";
import { Fragment } from "react";
import { Link } from "react-router-dom";
import { useStore } from "@/app/store/StoreProvider";
import type { PayoutBreakdown } from "@/features/payroll/calcFinalPayout";
import type { TimesheetEntry, TimesheetLine } from "@/entities/timesheet/model";
import { formatCoefficient, formatMoney } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { MoneyCell, Table, TBody, TD, TH, THead, TR } from "@/shared/ui/Table";
import { OperationsTable } from "@/widgets/payout/OperationsTable";

export interface TimesheetRow {
  entry: TimesheetEntry;
  breakdown: PayoutBreakdown;
  lines: TimesheetLine[];
}

/** Таблица сотрудников подразделения с разворотом в список табельных позиций. */
export function TimesheetTable({
  rows,
  expandedEntryId,
  onToggleExpand,
  locked,
  onConfirmLine,
  onRejectLine,
  onAdjustLine,
  onConfirmEntry,
  onConfirmAllLines,
}: {
  rows: TimesheetRow[];
  expandedEntryId: string | null;
  onToggleExpand: (entryId: string) => void;
  locked: boolean;
  onConfirmLine: (line: TimesheetLine) => void;
  onRejectLine: (line: TimesheetLine) => void;
  onAdjustLine: (line: TimesheetLine) => void;
  onConfirmEntry: (entry: TimesheetEntry) => void;
  onConfirmAllLines: (entry: TimesheetEntry) => void;
}) {
  const { state } = useStore();

  return (
    <Table>
      <THead>
        <TR>
          <TH className="w-8" />
          <TH>Сотрудник</TH>
          <TH className="w-44">Должность</TH>
          <TH align="right" className="w-20">
            Операций
          </TH>
          <TH align="right" className="w-24">
            Без тарифа
          </TH>
          <TH align="right" className="w-24">
            Не решено
          </TH>
          <TH align="right" className="w-32">
            Сумма по сделке
          </TH>
          <TH align="right" className="w-24">
            Коэф.
          </TH>
          <TH align="right" className="w-32">
            Итого к выплате
          </TH>
          <TH className="w-32">Статус записи</TH>
          <TH align="right" className="w-40">
            Действия
          </TH>
        </TR>
      </THead>
      <TBody>
        {rows.map(({ entry, breakdown, lines }) => {
          const person = state.persons.find((p) => p.id === entry.personId);
          const isExpanded = expandedEntryId === entry.id;
          const combinedCoefficient =
            breakdown.divisionCoefficientValue * breakdown.personCoefficientValue;
          const canConfirmEntry =
            !locked && entry.status === "draft" && breakdown.pendingCount === 0;

          return (
            <Fragment key={entry.id}>
              <TR selected={isExpanded}>
                <TD>
                  <button
                    type="button"
                    onClick={() => onToggleExpand(entry.id)}
                    className="rounded p-0.5 text-ink-400 hover:bg-line hover:text-ink-700"
                    aria-label={isExpanded ? "Свернуть" : "Развернуть"}
                  >
                    {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </button>
                </TD>
                <TD>
                  <span className="font-medium text-ink-900">{person?.fullName}</span>
                  <span className="ml-2 text-2xs text-ink-400">
                    таб. №{person?.personnelNumber}
                  </span>
                </TD>
                <TD className="text-ink-600">{person?.jobTitle}</TD>
                <TD align="right">
                  <MoneyCell>{breakdown.countedOperationsCount}</MoneyCell>
                </TD>
                <TD align="right">
                  {breakdown.missingTariffCount > 0 ? (
                    <Badge tone="warning">{breakdown.missingTariffCount}</Badge>
                  ) : (
                    <MoneyCell muted>0</MoneyCell>
                  )}
                </TD>
                <TD align="right">
                  {breakdown.pendingCount > 0 ? (
                    <Badge tone="info">{breakdown.pendingCount}</Badge>
                  ) : (
                    <Badge tone="success">все</Badge>
                  )}
                </TD>
                <TD align="right">
                  <MoneyCell>{formatMoney(breakdown.pieceworkTotal)}</MoneyCell>
                </TD>
                <TD align="right">
                  <MoneyCell muted={combinedCoefficient === 1}>
                    {formatCoefficient(combinedCoefficient)}
                  </MoneyCell>
                </TD>
                <TD align="right">
                  <MoneyCell emphasis>{formatMoney(breakdown.finalPayout)}</MoneyCell>
                </TD>
                <TD>
                  <StatusBadge status={entry.status} />
                </TD>
                <TD align="right">
                  <div className="flex justify-end gap-1">
                    <Link
                      to={`/payout/${entry.personId}`}
                      className="inline-flex h-6 items-center gap-1 rounded border border-line-strong bg-white px-2 text-2xs font-medium text-ink-800 hover:bg-canvas"
                      title="Детальная карточка расчёта"
                    >
                      <ReceiptText size={11} />
                      Расчёт
                    </Link>
                    {canConfirmEntry ? (
                      <Button size="xs" variant="success" onClick={() => onConfirmEntry(entry)}>
                        <Check size={11} />
                        Подтвердить
                      </Button>
                    ) : null}
                  </div>
                </TD>
              </TR>

              {isExpanded ? (
                <TR>
                  <TD colSpan={11} className="bg-canvas p-0">
                    {!locked && breakdown.pendingCount > 0 ? (
                      <div className="flex items-center justify-between gap-3 border-t border-line px-2.5 py-1.5">
                        <span className="text-2xs text-ink-600">
                          Позиций без решения: {breakdown.pendingCount}. Подтверждайте построчно или
                          примите все автоматически сформированные позиции сразу.
                        </span>
                        <Button size="xs" variant="outline" onClick={() => onConfirmAllLines(entry)}>
                          <Check size={11} />
                          Принять все автопозиции
                        </Button>
                      </div>
                    ) : null}
                    <div className="border-y border-line">
                      <OperationsTable
                        lines={lines}
                        actionsHeader="Решение по позиции"
                        renderActions={
                          locked
                            ? undefined
                            : (line) => (
                                <div className="flex justify-end gap-1">
                                  <Button
                                    size="xs"
                                    variant="success"
                                    disabled={
                                      line.status === "confirmed" || line.status === "tariff_missing"
                                    }
                                    onClick={() => onConfirmLine(line)}
                                    title={
                                      line.status === "tariff_missing"
                                        ? "Позицию без тарифа нельзя подтвердить: сначала нужен тариф"
                                        : "Подтвердить позицию"
                                    }
                                  >
                                    <Check size={11} />
                                  </Button>
                                  <Button
                                    size="xs"
                                    variant="danger"
                                    disabled={line.status === "rejected"}
                                    onClick={() => onRejectLine(line)}
                                    title="Отклонить позицию (нужен комментарий)"
                                  >
                                    <X size={11} />
                                  </Button>
                                  <Button
                                    size="xs"
                                    variant="outline"
                                    onClick={() => onAdjustLine(line)}
                                    title="Скорректировать вручную (исключение, нужен комментарий)"
                                  >
                                    <Pencil size={11} />
                                  </Button>
                                </div>
                              )
                        }
                      />
                    </div>
                  </TD>
                </TR>
              ) : null}
            </Fragment>
          );
        })}
      </TBody>
    </Table>
  );
}
