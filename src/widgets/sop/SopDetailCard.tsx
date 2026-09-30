import { CircleDollarSign, Coins } from "lucide-react";
import type { ReactNode } from "react";
import { useStore } from "@/app/store/StoreProvider";
import { getDivisionName } from "@/entities/division/mock";
import { getPersonName } from "@/entities/person/mock";
import { getSopPathFrom } from "@/entities/sop/helpers";
import {
  SOP_LEVEL_LABEL,
  SOP_OPERATION_OBJECT_LABEL,
  type Sop,
} from "@/entities/sop/model";
import type { SopTariff } from "@/entities/tariff/model";
import { formatDate, formatMoney } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Hint } from "@/shared/ui/Hint";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { MoneyCell, Table, TBody, TD, TH, THead, TR } from "@/shared/ui/Table";

function DefinitionRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-line-soft py-1.5 last:border-b-0">
      <dt className="w-44 shrink-0 text-2xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-xs text-ink-800">{children}</dd>
    </div>
  );
}

/**
 * Карточка СОП. Методическая часть и денежная часть намеренно разделены:
 * тарифы живут в отдельном блоке внизу, а не среди полей инструкции.
 */
export function SopDetailCard({
  sop,
  sops,
  tariffs,
  canManageTariffs,
  canEditSop,
  onCreateTariff,
  onEditSop,
  onArchiveSop,
  onRestoreSop,
}: {
  sop: Sop;
  sops: Sop[];
  tariffs: SopTariff[];
  canManageTariffs: boolean;
  canEditSop?: boolean;
  onCreateTariff: () => void;
  onEditSop?: () => void;
  onArchiveSop?: () => void;
  onRestoreSop?: () => void;
}) {
  const { state } = useStore();
  const path = getSopPathFrom(sops, sop.id);
  const isOperation = sop.level === "L3_operation";
  const isArchived = sop.status === "archived";
  const parentArchived = sop.parentId
    ? sops.find((s) => s.id === sop.parentId)?.status === "archived"
    : false;

  return (
    <div className="space-y-3">
      <Panel>
        <PanelHeader
          title={`${sop.code} · ${sop.name}`}
          subtitle={path.join(" → ")}
          actions={
            <>
              <StatusBadge status={sop.level} />
              <StatusBadge status={sop.status} />
              {canEditSop && onEditSop && !isArchived ? (
                <Button size="xs" variant="outline" onClick={onEditSop}>
                  Редактировать
                </Button>
              ) : null}
              {canEditSop && !isArchived && onArchiveSop ? (
                <Button size="xs" variant="warning" onClick={onArchiveSop}>
                  В архив
                </Button>
              ) : null}
              {canEditSop && isArchived && onRestoreSop ? (
                <Button
                  size="xs"
                  variant="success"
                  onClick={onRestoreSop}
                  disabled={parentArchived}
                  title={
                    parentArchived
                      ? "Сначала восстановите родительский СОП"
                      : "Вернуть в статус «Действует»"
                  }
                >
                  Из архива
                </Button>
              ) : null}
            </>
          }
        />
        <PanelBody>
          {isArchived ? (
            <Hint tone="warning" className="mb-3">
              СОП в архиве: не используется для новых тарифов и фактов.
              {parentArchived
                ? " Родитель тоже в архиве — сначала восстановите его."
                : " Вместе с ним в архив ушли все дочерние узлы (при архивации)."}
            </Hint>
          ) : null}
          <dl>
            <DefinitionRow label="Уровень">{SOP_LEVEL_LABEL[sop.level]}</DefinitionRow>
            <DefinitionRow label="Версия">
              <span className="tabular">{sop.version}</span>
            </DefinitionRow>
            <DefinitionRow label="Владелец / утверждающий">
              {getPersonName(sop.ownerPersonId, state.persons)}
            </DefinitionRow>
            <DefinitionRow label="Дата вступления в силу">
              <span className="tabular">{formatDate(sop.effectiveFrom)}</span>
            </DefinitionRow>
            {isOperation ? (
              <>
                <DefinitionRow label="Объект операции">
                  {sop.operationObject ? SOP_OPERATION_OBJECT_LABEL[sop.operationObject] : "—"}
                </DefinitionRow>
                <DefinitionRow label="Единица нормирования">
                  <Badge tone="info">в тарифе</Badge>
                  <span className="ml-2 text-2xs text-ink-500">
                    единица и ставка задаются в тарифе СОП (операция, час, голова, домик, секция)
                  </span>
                </DefinitionRow>
                <DefinitionRow label="Признак тарифицируемости">
                  {sop.isTariffable ? (
                    <Badge tone="success">Тарифицируется</Badge>
                  ) : (
                    <Badge tone="muted">Не тарифицируется</Badge>
                  )}
                </DefinitionRow>
              </>
            ) : null}
            <DefinitionRow label="Методическое описание">
              <p className="leading-relaxed">{sop.methodSummary}</p>
            </DefinitionRow>
          </dl>

          <Hint tone="info" className="mt-3">
            Карточка СОП — методический документ. Денежных полей в ней нет: ставка задаётся отдельной
            сущностью «Тариф СОП» и может отличаться по подразделениям и должностям.
          </Hint>
        </PanelBody>
      </Panel>

      {isOperation ? (
        <Panel>
          <PanelHeader
            title="Тарифы по этому СОП"
            subtitle="Отдельная сущность: одна операция — одна ставка на дату выполнения"
            icon={<CircleDollarSign size={14} />}
            actions={
              canManageTariffs && tariffs.length > 0 ? (
                <Button size="xs" onClick={onCreateTariff}>
                  <Coins size={12} />
                  Задать тариф
                </Button>
              ) : null
            }
          />
          <PanelBody className="px-0 py-0">
            {tariffs.length === 0 ? (
              <div className="p-3">
                <EmptyState
                  tone="warning"
                  title="Тариф не задан"
                  description="Операции по этому СОП фиксируются, но не оплачиваются, пока тариф не будет установлен. В табеле такие позиции получают статус «Тариф не задан» и сумму «—», а не ноль."
                  action={
                    canManageTariffs ? (
                      <Button size="sm" onClick={onCreateTariff}>
                        <Coins size={12} />
                        Задать тариф
                      </Button>
                    ) : (
                      <span className="text-2xs text-ink-500">
                        Установить тариф могут роли «Методолог по тарифам» и «Управляющий по направлению»
                      </span>
                    )
                  }
                />
              </div>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Подразделение</TH>
                    <TH>Должность</TH>
                    <TH align="right" className="w-28">
                      Ставка
                    </TH>
                    <TH className="w-44">Период действия</TH>
                    <TH className="w-28">Статус</TH>
                    <TH className="w-40">Утвердил</TH>
                  </TR>
                </THead>
                <TBody>
                  {tariffs.map((t) => (
                    <TR key={t.id}>
                      <TD className="font-medium text-ink-900">{getDivisionName(t.divisionId, state.divisions)}</TD>
                      <TD className="text-ink-600">{t.jobTitle ?? "Все должности"}</TD>
                      <TD align="right">
                        <MoneyCell emphasis={t.status === "active"} muted={t.status !== "active"}>
                          {formatMoney(t.rate)}
                        </MoneyCell>
                      </TD>
                      <TD className="tabular text-ink-600">
                        {formatDate(t.validFrom)} — {t.validTo ? formatDate(t.validTo) : "бессрочно"}
                      </TD>
                      <TD>
                        <StatusBadge status={t.status} />
                      </TD>
                      <TD className="text-ink-600">
                        {t.approvedByPersonId ? getPersonName(t.approvedByPersonId, state.persons) : "не утверждён"}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </PanelBody>
        </Panel>
      ) : null}
    </div>
  );
}
