import { Archive, Check, RotateCcw, Trash2, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { useStore } from "@/app/store/StoreProvider";
import { getDivisionName } from "@/entities/division/mock";
import { getPersonName } from "@/entities/person/mock";
import type { Sop } from "@/entities/sop/model";
import { formatRateUnitPerOne, type SopTariff } from "@/entities/tariff/model";
import { formatDate, formatMoney } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { Hint } from "@/shared/ui/Hint";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { MoneyCell } from "@/shared/ui/Table";

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
 * Карточка утверждения / жизненного цикла тарифа.
 * Здесь — нетиповые операции: архив, восстановление, снятие утверждения;
 * «Утвердить» тоже доступна (дублирует очередь черновиков в списке).
 */
export function TariffApprovalCard({
  tariff,
  sop,
  canApprove,
  canManage,
  onApprove,
  onRejectDraft,
  onUnapprove,
  onArchive,
  onRestore,
}: {
  tariff: SopTariff;
  sop: Sop | undefined;
  canApprove: boolean;
  canManage: boolean;
  onApprove: () => void;
  onRejectDraft: () => void;
  onUnapprove: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const { state } = useStore();
  return (
    <div className="space-y-3">
      <Panel>
        <PanelHeader
          title={sop ? `${sop.code} · ${sop.name}` : tariff.sopId}
          subtitle={`${getDivisionName(tariff.divisionId, state.divisions)} · ${tariff.jobTitle ?? "Все должности"}`}
          actions={<StatusBadge status={tariff.status} />}
        />
        <PanelBody>
          <dl>
            <DefinitionRow label="Ставка">
              <MoneyCell emphasis={tariff.status === "active"} muted={tariff.status === "archived"}>
                {formatMoney(tariff.rate)}
              </MoneyCell>
              <span className="ml-1.5 text-2xs text-ink-500">
                {formatRateUnitPerOne(tariff.rateUnit)}
              </span>
            </DefinitionRow>
            <DefinitionRow label="Период действия">
              <span className="tabular">
                {formatDate(tariff.validFrom)} —{" "}
                {tariff.validTo ? formatDate(tariff.validTo) : "бессрочно"}
              </span>
            </DefinitionRow>
            <DefinitionRow label="Утвердил">
              {tariff.approvedByPersonId ? getPersonName(tariff.approvedByPersonId, state.persons) : "—"}
            </DefinitionRow>
            <DefinitionRow label="Создан / изменён">
              <span className="tabular">
                {formatDate(tariff.createdAt)} / {formatDate(tariff.updatedAt)}
              </span>
            </DefinitionRow>
          </dl>

          {tariff.status === "draft" ? (
            <Hint tone="info" className="mt-3">
              Черновик не участвует в расчёте. После утверждения управляющим ставка начнёт
              применяться к фактам в окне действия.
            </Hint>
          ) : null}
          {tariff.status === "archived" ? (
            <Hint tone="warning" className="mt-3">
              Архивный тариф не задаёт новые суммы вне своего закрытого окна. Восстановление
              вернёт его в черновик — потребуется повторное утверждение.
            </Hint>
          ) : null}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title="Операции жизненного цикла"
          subtitle="Нетиповые действия и утверждение — в карточке; утверждение черновика также есть в списке"
        />
        <PanelBody>
          <div className="flex flex-wrap gap-2">
            {tariff.status === "draft" ? (
              <>
                {canApprove ? (
                  <Button variant="success" onClick={onApprove}>
                    <Check size={13} />
                    Утвердить
                  </Button>
                ) : (
                  <span className="text-xs text-ink-500">Утверждение доступно управляющему</span>
                )}
                {canManage ? (
                  <Button variant="outline" onClick={onRejectDraft}>
                    <Trash2 size={13} />
                    Удалить черновик
                  </Button>
                ) : null}
              </>
            ) : null}

            {tariff.status === "active" ? (
              <>
                {canApprove ? (
                  <Button variant="outline" onClick={onUnapprove}>
                    <Undo2 size={13} />
                    Снять утверждение
                  </Button>
                ) : null}
                {canManage ? (
                  <Button
                    variant="warning"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Перевести тариф в архив? Он перестанет применяться к новым расчётам в открытом окне.",
                        )
                      ) {
                        onArchive();
                      }
                    }}
                  >
                    <Archive size={13} />
                    В архив
                  </Button>
                ) : null}
              </>
            ) : null}

            {tariff.status === "archived" && canManage ? (
              <Button
                variant="success"
                onClick={() => {
                  if (
                    window.confirm(
                      "Восстановить тариф из архива? Он станет черновиком и снова потребует утверждения.",
                    )
                  ) {
                    onRestore();
                  }
                }}
              >
                <RotateCcw size={13} />
                Из архива
              </Button>
            ) : null}
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
