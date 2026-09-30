import type { ReactNode } from "react";
import { useStore } from "@/app/store/StoreProvider";
import { cn } from "@/shared/lib/utils";
import { Field, Select } from "@/shared/ui/Field";
import { PeriodFilter } from "./PeriodFilter";

/**
 * Единая полоса фильтров раздела «Расчёт»: подразделение + период (+ опционально итоги).
 */
export function CalcFilters({
  showAmounts,
  onShowAmountsChange,
  className,
  trailing,
}: {
  showAmounts?: boolean;
  onShowAmountsChange?: (showAmounts: boolean) => void;
  className?: string;
  /** Кнопки справа от фильтров (например «Подтвердить») */
  trailing?: ReactNode;
}) {
  const {
    state,
    role,
    currentPerson,
    selectedDivisionId,
    setSelectedDivisionId,
  } = useStore();

  const canPickDivision = role.id === "direction_manager";
  const activeDivisions = state.divisions.filter((d) => d.status === "active");
  const divisionValue = canPickDivision ? selectedDivisionId : currentPerson.divisionId;

  return (
    <div
      className={cn(
        "mb-3 flex flex-nowrap items-end gap-2 overflow-x-auto rounded border border-line bg-white px-3 py-2.5 shadow-panel",
        className,
      )}
    >
      <Field label="Подразделение" className="w-48 shrink-0">
        <Select
          className="h-[30px] py-1"
          value={divisionValue}
          disabled={!canPickDivision}
          onChange={(e) => setSelectedDivisionId(e.target.value)}
          title={
            canPickDivision
              ? undefined
              : "Доступно только своё подразделение"
          }
        >
          {activeDivisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>

      <PeriodFilter embedded />

      {onShowAmountsChange !== undefined && showAmounts !== undefined ? (
        <Field label="В итогах" className="w-44 shrink-0">
          <Select
            className="h-[30px] py-1"
            value={showAmounts ? "amounts" : "counts"}
            onChange={(e) => onShowAmountsChange(e.target.value === "amounts")}
          >
            <option value="amounts">Суммы</option>
            <option value="counts">Число операций</option>
          </Select>
        </Field>
      ) : null}

      {trailing ? <div className="ml-auto flex shrink-0 items-end gap-2 pb-px">{trailing}</div> : null}
    </div>
  );
}
