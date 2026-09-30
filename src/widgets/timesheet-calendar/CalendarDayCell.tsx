import type { CalendarCell } from "@/app/store/selectors";
import { cn, formatMoneyShort } from "@/shared/lib/utils";

const toneClass: Record<CalendarCell["tone"], string> = {
  empty: "bg-white text-ink-300",
  ok: "bg-paid-soft text-paid border-paid-line",
  warning: "bg-pending-soft text-pending border-pending-line",
  danger: "bg-reject-soft text-reject border-reject-line",
  plan: "bg-accent-soft text-accent border-accent/30",
};

/** Компактная ячейка дня: план + факт (число операций / сумма). */
export function CalendarDayCellContent({ cell }: { cell: CalendarCell }) {
  const empty = cell.tone === "empty";
  const planOnly = cell.opsCount === 0 && cell.planItems.length > 0;

  return (
    <div
      className={cn(
        "flex h-full min-h-[44px] w-full min-w-[64px] flex-col items-center justify-center gap-0.5 border border-transparent px-1 py-1 text-center",
        toneClass[cell.tone],
        !empty && "border",
        cell.openPlanCount > 0 && cell.opsCount > 0 && "ring-1 ring-inset ring-accent/50",
      )}
    >
      {empty ? (
        <span className="text-2xs">·</span>
      ) : planOnly ? (
        <>
          <span className="tabular text-2xs font-semibold leading-none">
            план {cell.planItems.length}
          </span>
          {cell.openPlanCount > 0 ? (
            <span className="text-[10px] leading-none opacity-80">{cell.openPlanCount} откр.</span>
          ) : (
            <span className="text-[10px] leading-none opacity-80">закрыт</span>
          )}
        </>
      ) : (
        <>
          <span className="tabular text-2xs font-semibold leading-none">{cell.opsCount}</span>
          <span className="tabular text-[10px] leading-none opacity-90">
            {cell.dayTotal === null ? "—" : formatMoneyShort(cell.dayTotal)}
          </span>
          {cell.openPlanCount > 0 ? (
            <span className="text-[9px] font-medium leading-none text-accent">
              +{cell.openPlanCount} план
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}
