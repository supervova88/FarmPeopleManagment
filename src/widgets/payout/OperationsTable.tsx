import { MessageSquareWarning } from "lucide-react";
import type { ReactNode } from "react";
import { useStore } from "@/app/store/StoreProvider";
import { getPersonShortName } from "@/entities/person/mock";
import { indexSops } from "@/entities/sop/helpers";
import { sopFactById } from "@/entities/sopFact/mock";
import {
  coPerformerIds,
  SOP_FACT_STATUS_LABEL,
  type SopFact,
} from "@/entities/sopFact/model";
import { formatQuantityWithUnit, TARIFF_RATE_UNIT_SHORT } from "@/entities/tariff/model";
import type { TimesheetLine } from "@/entities/timesheet/model";
import { cn, formatDate, formatMoney } from "@/shared/lib/utils";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { MoneyCell, Table, TBody, TD, TH, THead, TR } from "@/shared/ui/Table";

/**
 * Таблица табельных позиций (операций) сотрудника.
 * Строки без тарифа подсвечены янтарным: сумма «—», а не 0.
 */
export function OperationsTable({
  lines,
  actionsHeader,
  renderActions,
  compact,
  factsMap,
}: {
  lines: TimesheetLine[];
  actionsHeader?: string;
  renderActions?: (line: TimesheetLine) => ReactNode;
  compact?: boolean;
  /** Карта фактов из store; если не передана — fallback на статический mock */
  factsMap?: Map<string, SopFact>;
}) {
  const { state } = useStore();
  const sopById = indexSops(state.sops);
  if (lines.length === 0) {
    return <p className="px-3 py-4 text-xs text-ink-500">Операций за период нет.</p>;
  }

  function resolveFact(factId: string | null) {
    if (!factId) return undefined;
    return factsMap?.get(factId) ?? sopFactById.get(factId);
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH className="w-24">Дата</TH>
          <TH className="w-28">Код СОП</TH>
          <TH>Операция</TH>
          {!compact ? <TH className="w-48">Объект</TH> : null}
          <TH className="w-44">Статус факта</TH>
          <TH align="right" className="w-16">
            Кол-во
          </TH>
          <TH align="right" className="w-24">
            Тариф
          </TH>
          <TH align="right" className="w-28">
            Сумма
          </TH>
          <TH className="w-52">Статус позиции</TH>
          {renderActions ? (
            <TH align="right" className="w-56">
              {actionsHeader ?? "Действия"}
            </TH>
          ) : null}
        </TR>
      </THead>
      <TBody>
        {lines.map((line) => {
          const fact = resolveFact(line.factId);
          const sop = sopById.get(line.sopId);
          const noTariff = line.status === "tariff_missing";
          const rejected = line.status === "rejected";
          const entryPersonId =
            state.entries.find((e) => e.id === line.entryId)?.personId ?? "";
          const coNames = fact
            ? coPerformerIds(fact, entryPersonId).map((id) =>
                getPersonShortName(id, state.persons),
              )
            : [];

          return (
            <TR
              key={line.id}
              className={cn(
                noTariff && "bg-pending-soft",
                rejected && "bg-reject-soft/60",
                line.status === "manually_adjusted" && "bg-pending-soft/50",
              )}
            >
              <TD className="tabular whitespace-nowrap text-ink-600">{formatDate(line.factDate)}</TD>
              <TD className="whitespace-nowrap text-ink-600">{sop?.code ?? "—"}</TD>
              <TD>
                <span className={cn("font-medium", rejected ? "text-ink-500 line-through" : "text-ink-900")}>
                  {line.sopName}
                </span>
                <span className="ml-1.5 text-2xs text-ink-400">в. {line.sopVersion}</span>
                {coNames.length > 0 ? (
                  <p className="mt-1 text-2xs text-ink-500">совместно с {coNames.join(", ")}</p>
                ) : null}
                {line.adjustmentComment ? (
                  <p className="mt-1 flex items-start gap-1 text-2xs leading-snug text-ink-600">
                    <MessageSquareWarning size={11} className="mt-[1px] shrink-0 text-pending" />
                    {line.adjustmentComment}
                  </p>
                ) : null}
                {noTariff ? (
                  <p className="mt-1 text-2xs font-medium text-pending">
                    Тариф не задан — сумма будет рассчитана после установки тарифа
                  </p>
                ) : null}
              </TD>
              {!compact ? <TD className="text-ink-600">{fact?.objectLabel ?? "—"}</TD> : null}
              <TD>
                {fact ? (
                  <StatusBadge status={fact.factStatus} label={SOP_FACT_STATUS_LABEL[fact.factStatus]} />
                ) : (
                  <span className="text-2xs text-ink-400">ручная корректировка</span>
                )}
              </TD>
              <TD align="right">
                <MoneyCell>{formatQuantityWithUnit(line.quantity, line.appliedUnit)}</MoneyCell>
              </TD>
              <TD align="right">
                <MoneyCell muted={line.appliedRate === null}>
                  {line.appliedRate === null
                    ? "—"
                    : line.appliedUnit
                      ? `${formatMoney(line.appliedRate)} / ${TARIFF_RATE_UNIT_SHORT[line.appliedUnit]}`
                      : formatMoney(line.appliedRate)}
                </MoneyCell>
              </TD>
              <TD align="right">
                <MoneyCell emphasis={line.amount !== null && !rejected} muted={line.amount === null || rejected}>
                  {line.amount === null ? "—" : formatMoney(line.amount)}
                </MoneyCell>
              </TD>
              <TD>
                <StatusBadge status={line.status} />
              </TD>
              {renderActions ? <TD align="right">{renderActions(line)}</TD> : null}
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
