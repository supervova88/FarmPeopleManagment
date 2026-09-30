import { Ban, Check } from "lucide-react";
import { SOP_LEVEL_LABEL, type Sop } from "@/entities/sop/model";
import { formatDate } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { MoneyCell, Table, TBody, TD, TH, THead, TR } from "@/shared/ui/Table";

/**
 * Таблица СОП выбранного уровня.
 * Колонка «Тарифицируется» показывается только для уровня L3 —
 * это признак самого СОП, а не наличие тарифа.
 */
export function SopLevelTable({
  items,
  level,
  selectedId,
  onOpen,
  tariffCountBySopId,
}: {
  items: Sop[];
  level: Sop["level"];
  selectedId: string | null;
  onOpen: (sop: Sop) => void;
  tariffCountBySopId: Map<string, number>;
}) {
  const isOperationLevel = level === "L3_operation";

  return (
    <Table>
      <THead>
        <TR>
          <TH className="w-32">Код</TH>
          <TH>Наименование</TH>
          <TH className="w-16">Версия</TH>
          <TH className="w-32">Статус</TH>
          {isOperationLevel ? <TH className="w-36">Тарифицируется</TH> : null}
          {isOperationLevel ? <TH className="w-28" align="right">Тарифов</TH> : null}
          <TH className="w-28">Вступил в силу</TH>
          <TH className="w-24" align="right">
            Действие
          </TH>
        </TR>
      </THead>
      <TBody>
        {items.map((sop) => (
          <TR key={sop.id} selected={sop.id === selectedId} onClick={() => onOpen(sop)}>
            <TD className="font-medium text-ink-700">{sop.code}</TD>
            <TD>
              <span className="font-medium text-ink-900">{sop.name}</span>
              <span className="ml-2 text-2xs text-ink-400">{SOP_LEVEL_LABEL[sop.level]}</span>
            </TD>
            <TD className="tabular text-ink-600">{sop.version}</TD>
            <TD>
              <StatusBadge status={sop.status} />
            </TD>
            {isOperationLevel ? (
              <TD>
                {sop.isTariffable ? (
                  <Badge tone="success" icon={<Check size={10} />}>
                    Да
                  </Badge>
                ) : (
                  <Badge tone="muted" icon={<Ban size={10} />}>
                    Нет
                  </Badge>
                )}
              </TD>
            ) : null}
            {isOperationLevel ? (
              <TD align="right">
                {(() => {
                  const count = tariffCountBySopId.get(sop.id) ?? 0;
                  return count === 0 ? (
                    <Badge tone="warning">Тариф не задан</Badge>
                  ) : (
                    <MoneyCell>{count}</MoneyCell>
                  );
                })()}
              </TD>
            ) : null}
            <TD className="tabular text-ink-600">{formatDate(sop.effectiveFrom)}</TD>
            <TD align="right">
              <Button variant="outline" size="xs" onClick={() => onOpen(sop)}>
                Открыть
              </Button>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
