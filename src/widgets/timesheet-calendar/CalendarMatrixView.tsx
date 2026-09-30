import { useCallback, useRef, useState } from "react";
import type { CalendarCell, CalendarMatrix } from "@/app/store/selectors";
import type { SopFact } from "@/entities/sopFact/model";
import type { TimesheetLine } from "@/entities/timesheet/model";
import type { WorkPlanItem } from "@/entities/workPlan/model";
import {
  cn,
  DEMO_TODAY,
  formatDayOfMonth,
  formatMoney,
  formatMoneyShort,
} from "@/shared/lib/utils";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { MoneyCell } from "@/shared/ui/Table";
import { AddPlanModal } from "@/widgets/work-plan/AddPlanModal";
import { AddOperationModal } from "./AddOperationModal";
import { CalendarDayCellContent } from "./CalendarDayCell";
import { DayPopover } from "./DayPopover";

interface ActiveCell {
  personId: string;
  personName: string;
  entryId: string;
  cell: CalendarCell;
  rect: DOMRect;
}

/**
 * Матрица специалист × дата: план + факт.
 * Popover — hover/клик; модалки добавления — по кнопкам в popover.
 */
export function CalendarMatrixView({
  matrix,
  factsMap,
  locked,
  canEdit,
  showAmounts,
  onCreateFact,
  onCreatePlan,
  onCancelPlan,
  onRejectLine,
}: {
  matrix: CalendarMatrix;
  factsMap: Map<string, SopFact>;
  locked: boolean;
  canEdit: boolean;
  showAmounts: boolean;
  onCreateFact: (payload: {
    sopId: string;
    performerPersonIds: string[];
    objectLabel: string;
    factDate: string;
    factStatus: "done" | "done_with_deviations";
    quantity: number;
  }) => void;
  onCreatePlan: (payload: {
    sopId: string;
    personId: string;
    plannedDate: string;
    objectLabel: string;
    plannedQuantity: number;
  }) => void;
  onCancelPlan: (item: WorkPlanItem) => void;
  onRejectLine: (lineId: string, comment: string) => void;
}) {
  const [active, setActive] = useState<ActiveCell | null>(null);
  const [addFactTarget, setAddFactTarget] = useState<Omit<ActiveCell, "rect"> | null>(null);
  const [addPlanTarget, setAddPlanTarget] = useState<Omit<ActiveCell, "rect"> | null>(null);
  const addBusyRef = useRef(false);
  const hoverTimer = useRef<number | null>(null);

  const openCell = useCallback((next: ActiveCell) => {
    setActive(next);
  }, []);

  const scheduleOpen = useCallback(
    (next: ActiveCell) => {
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
      hoverTimer.current = window.setTimeout(() => {
        if (addBusyRef.current) return;
        openCell(next);
      }, 280);
    },
    [openCell],
  );

  const cancelSchedule = useCallback(() => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  }, []);

  const closePopover = useCallback(() => {
    setActive(null);
  }, []);

  return (
    <>
      <Panel className="print:shadow-none print:border-line">
        <PanelHeader
          title="Календарь: план и факты"
          subtitle={`${matrix.period.periodLabel} · ${matrix.dates.length} дней · ${matrix.rows.length} сотрудников`}
          className="print:py-2"
        />
        <PanelBody className="px-0 py-0">
          <div className="max-h-[70vh] overflow-auto print:max-h-none print:overflow-visible">
            <table className="w-max min-w-full border-collapse text-xs">
              <thead className="sticky top-0 z-20 bg-canvas print:static">
                <tr>
                  <th className="sticky left-0 z-30 min-w-[200px] border-b border-r border-line bg-canvas px-2.5 py-1.5 text-left text-2xs font-semibold uppercase tracking-wide text-ink-500 print:static">
                    Специалист
                  </th>
                  {matrix.dates.map((date) => {
                    const isToday = date === DEMO_TODAY;
                    return (
                      <th
                        key={date}
                        className={cn(
                          "min-w-[64px] border-b border-line px-0 py-1.5 text-center text-2xs font-semibold text-ink-500",
                          isToday && "bg-accent-soft text-accent",
                        )}
                        title={date}
                      >
                        {formatDayOfMonth(date)}
                      </th>
                    );
                  })}
                  <th className="sticky right-0 z-30 min-w-[112px] border-b border-l border-line bg-canvas px-2.5 py-1.5 text-right text-2xs font-semibold uppercase tracking-wide text-ink-500 print:static">
                    Итого
                  </th>
                </tr>
              </thead>
              <tbody>
                {matrix.rows.map((row) => (
                  <tr key={row.entry.id} className="border-b border-line-soft">
                    <td className="sticky left-0 z-10 border-r border-line bg-white px-2.5 py-1 align-middle print:static">
                      <p className="font-medium leading-tight text-ink-900">{row.personName}</p>
                      <p className="text-2xs text-ink-400">{row.jobTitle}</p>
                    </td>
                    {row.cells.map((cell) => (
                      <td key={cell.date} className="border-line-soft p-0 align-middle">
                        <div
                          className={cn(
                            "cursor-pointer hover:ring-1 hover:ring-inset hover:ring-accent/40 print:cursor-default print:hover:ring-0",
                            active?.personId === row.personId &&
                              active.cell.date === cell.date &&
                              "ring-2 ring-inset ring-accent",
                          )}
                          onMouseEnter={(e) => {
                            if (addFactTarget || addPlanTarget) return;
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            scheduleOpen({
                              personId: row.personId,
                              personName: row.personName,
                              entryId: row.entry.id,
                              cell,
                              rect,
                            });
                          }}
                          onMouseLeave={cancelSchedule}
                          onClick={(e) => {
                            if (addFactTarget || addPlanTarget) return;
                            cancelSchedule();
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            openCell({
                              personId: row.personId,
                              personName: row.personName,
                              entryId: row.entry.id,
                              cell,
                              rect,
                            });
                          }}
                        >
                          <CalendarDayCellContent cell={cell} />
                        </div>
                      </td>
                    ))}
                    <td className="sticky right-0 z-10 border-l border-line bg-white px-2.5 py-1 text-right align-middle print:static">
                      <MoneyCell emphasis>
                        {showAmounts ? formatMoney(row.rowTotal) : `${row.rowOpsCount} оп.`}
                      </MoneyCell>
                      {row.rowMissingTariffCount > 0 ? (
                        <p className="text-2xs text-pending">без тарифа: {row.rowMissingTariffCount}</p>
                      ) : null}
                    </td>
                  </tr>
                ))}

                <tr className="bg-canvas font-semibold">
                  <td className="sticky left-0 z-10 border-t border-r border-line bg-canvas px-2.5 py-2 text-ink-800 print:static">
                    Итого
                  </td>
                  {matrix.columnTotals.map((col) => (
                    <td
                      key={col.date}
                      className="border-t border-line px-1 py-2 text-center tabular text-2xs text-ink-700"
                    >
                      {col.opsCount === 0
                        ? "·"
                        : showAmounts
                          ? formatMoneyShort(col.total)
                          : col.opsCount}
                    </td>
                  ))}
                  <td className="sticky right-0 z-10 border-t border-l border-line bg-canvas px-2.5 py-2 text-right print:static">
                    <MoneyCell emphasis className="text-accent">
                      {showAmounts
                        ? formatMoney(matrix.grandTotal)
                        : `${matrix.grandOpsCount} оп.`}
                    </MoneyCell>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </PanelBody>
      </Panel>

      <DayPopover
        open={active !== null && addFactTarget === null && addPlanTarget === null}
        anchorRect={active?.rect ?? null}
        personName={active?.personName ?? ""}
        personId={active?.personId ?? ""}
        cell={active?.cell ?? null}
        factsMap={factsMap}
        locked={locked}
        canEdit={canEdit}
        onClose={closePopover}
        onAddFact={() => {
          if (!active) return;
          const target = {
            personId: active.personId,
            personName: active.personName,
            entryId: active.entryId,
            cell: active.cell,
          };
          addBusyRef.current = true;
          setAddFactTarget(target);
          setActive(null);
        }}
        onAddPlan={() => {
          if (!active) return;
          const target = {
            personId: active.personId,
            personName: active.personName,
            entryId: active.entryId,
            cell: active.cell,
          };
          addBusyRef.current = true;
          setAddPlanTarget(target);
          setActive(null);
        }}
        onCancelPlan={(item) => {
          onCancelPlan(item);
          setActive(null);
        }}
        onReject={(line: TimesheetLine, comment: string) => {
          onRejectLine(line.id, comment);
          setActive(null);
        }}
      />

      <AddOperationModal
        key={addFactTarget ? `fact-${addFactTarget.personId}-${addFactTarget.cell.date}` : "fact-idle"}
        open={addFactTarget !== null}
        onClose={() => {
          addBusyRef.current = false;
          setAddFactTarget(null);
        }}
        personName={addFactTarget?.personName ?? ""}
        personId={addFactTarget?.personId ?? ""}
        factDate={addFactTarget?.cell.date ?? ""}
        onSubmit={(payload) => {
          if (!addFactTarget) return;
          onCreateFact({
            ...payload,
            factDate: addFactTarget.cell.date,
          });
          addBusyRef.current = false;
          setAddFactTarget(null);
        }}
      />

      <AddPlanModal
        key={addPlanTarget ? `plan-${addPlanTarget.personId}-${addPlanTarget.cell.date}` : "plan-idle"}
        open={addPlanTarget !== null}
        onClose={() => {
          addBusyRef.current = false;
          setAddPlanTarget(null);
        }}
        personName={addPlanTarget?.personName ?? ""}
        personId={addPlanTarget?.personId ?? ""}
        plannedDate={addPlanTarget?.cell.date ?? ""}
        onSubmit={(payload) => {
          if (!addPlanTarget) return;
          onCreatePlan({
            ...payload,
            personId: addPlanTarget.personId,
            plannedDate: addPlanTarget.cell.date,
          });
          addBusyRef.current = false;
          setAddPlanTarget(null);
        }}
      />
    </>
  );
}
