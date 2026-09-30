import {
  formatMonthLabel,
  weekRangeLabel,
  type PeriodGranularity,
} from "@/entities/timesheet/periodView";
import { useStore } from "@/app/store/StoreProvider";
import { cn } from "@/shared/lib/utils";
import { Field, TextInput } from "@/shared/ui/Field";

/**
 * Переключатель расчётного периода: месяц / неделя.
 * Месяц — любой YYYY-MM; неделя — дата из календаря (ISO пн–вс).
 */
export function PeriodFilter({
  compact = false,
  className,
  /** Встроен в CalcFilters: без внешнего отступа, высота как у селектов */
  embedded = false,
}: {
  compact?: boolean;
  className?: string;
  embedded?: boolean;
}) {
  const {
    periodView,
    setPeriodGranularity,
    setPeriodMonthKey,
    setPeriodWeekStart,
  } = useStore();

  const weekLabel = weekRangeLabel(periodView.weekStart);
  const dateForWeekInput = periodView.weekStart;

  const inputClass = compact
    ? "h-7 min-w-0 rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-2xs text-white outline-none focus:border-white/40 [color-scheme:dark]"
    : undefined;

  function onMonthChange(value: string) {
    if (!/^\d{4}-\d{2}$/.test(value)) return;
    setPeriodMonthKey(value);
  }

  function onWeekDateChange(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    setPeriodWeekStart(value);
  }

  if (embedded) {
    return (
      <div className={cn("flex flex-nowrap items-end gap-2", className)}>
        <div
          className="inline-flex h-[30px] items-stretch overflow-hidden rounded border border-line-strong bg-white"
          role="group"
          aria-label="Гранулярность периода"
        >
          {(
            [
              { id: "month" as const, label: "Месяц" },
              { id: "week" as const, label: "Неделя" },
            ] satisfies Array<{ id: PeriodGranularity; label: string }>
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPeriodGranularity(opt.id)}
              className={cn(
                "px-2.5 text-2xs font-medium transition-colors",
                periodView.granularity === opt.id
                  ? "bg-accent text-white"
                  : "text-ink-600 hover:bg-canvas",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Field
          label="Месяц и год"
          className="w-40"
          hint={formatMonthLabel(periodView.monthKey)}
        >
          <TextInput
            type="month"
            className="h-[30px] py-1"
            value={periodView.monthKey}
            onChange={(e) => onMonthChange(e.target.value)}
          />
        </Field>

        {periodView.granularity === "week" ? (
          <Field
            label="Неделя"
            className="w-44"
            hint={`${weekLabel} (пн–вс; дата → начало недели)`}
          >
            <TextInput
              type="date"
              className="h-[30px] py-1"
              value={dateForWeekInput}
              onChange={(e) => onWeekDateChange(e.target.value)}
            />
          </Field>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        compact
          ? "inline-flex flex-wrap items-center gap-1.5"
          : "flex flex-wrap items-end gap-2",
        className,
      )}
    >
      {compact ? (
        <span className="text-2xs text-white/70">Период:</span>
      ) : null}

      <div
        className={cn(
          "inline-flex rounded border",
          compact ? "border-white/20 bg-white/5" : "border-line bg-white",
        )}
        role="group"
        aria-label="Гранулярность периода"
      >
        {(
          [
            { id: "month" as const, label: "Месяц" },
            { id: "week" as const, label: "Неделя" },
          ] satisfies Array<{ id: PeriodGranularity; label: string }>
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setPeriodGranularity(opt.id)}
            className={cn(
              "px-2 py-1 text-2xs font-medium transition-colors",
              periodView.granularity === opt.id
                ? compact
                  ? "bg-white/25 text-white"
                  : "bg-accent text-white"
                : compact
                  ? "text-white/70 hover:bg-white/10 hover:text-white"
                  : "text-ink-600 hover:bg-canvas",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {compact ? (
        <>
          <input
            type="month"
            className={cn(inputClass, "w-[8.5rem]")}
            value={periodView.monthKey}
            onChange={(e) => onMonthChange(e.target.value)}
            aria-label="Месяц и год"
            title={formatMonthLabel(periodView.monthKey)}
          />
          {periodView.granularity === "week" ? (
            <>
              <input
                type="date"
                className={cn(inputClass, "w-[9rem]")}
                value={dateForWeekInput}
                onChange={(e) => onWeekDateChange(e.target.value)}
                aria-label="Дата недели"
                title={weekLabel}
              />
              <span className="text-2xs text-white/65 tabular">{weekLabel}</span>
            </>
          ) : null}
        </>
      ) : (
        <>
          <Field label="Месяц и год" className="w-44" hint={formatMonthLabel(periodView.monthKey)}>
            <TextInput
              type="month"
              value={periodView.monthKey}
              onChange={(e) => onMonthChange(e.target.value)}
            />
          </Field>
          {periodView.granularity === "week" ? (
            <Field
              label="Неделя"
              className="w-52"
              hint={`${weekLabel} (пн–вс; дата → начало недели)`}
            >
              <TextInput
                type="date"
                value={dateForWeekInput}
                onChange={(e) => onWeekDateChange(e.target.value)}
              />
            </Field>
          ) : null}
        </>
      )}
    </div>
  );
}
