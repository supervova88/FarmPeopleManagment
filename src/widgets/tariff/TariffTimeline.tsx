import { ArrowRight, Clock } from "lucide-react";
import { useStore } from "@/app/store/StoreProvider";
import { getDivisionName } from "@/entities/division/mock";
import { getSopNameFrom } from "@/entities/sop/helpers";
import { formatRateUnitPerOne, type SopTariff } from "@/entities/tariff/model";
import { cn, DEMO_TODAY, formatDate, formatMoney, previousDay } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { Hint } from "@/shared/ui/Hint";
import { StatusBadge } from "@/shared/ui/StatusBadge";

const dotClass: Record<SopTariff["status"], string> = {
  active: "bg-paid border-paid",
  archived: "bg-line-strong border-line-strong",
  draft: "bg-white border-pending",
};

/**
 * Временная шкала версий тарифа по одному СОП и подразделению.
 * Наглядно показывает правило: новая версия закрывает предыдущую днём раньше
 * своей даты начала, и та уходит в архив.
 */
export function TariffTimeline({
  sopId,
  divisionId,
  versions,
}: {
  sopId: string;
  divisionId: string;
  versions: SopTariff[];
}) {
  const { state } = useStore();
  const sopName = getSopNameFrom(state.sops, sopId);
  return (
    <Panel>
      <PanelHeader
        title="История версий тарифа"
        subtitle={`${sopName} · ${getDivisionName(divisionId, state.divisions)}`}
        icon={<Clock size={14} />}
      />
      <PanelBody>
        {versions.length === 0 ? (
          <p className="text-xs text-ink-500">
            Выберите СОП и подразделение в таблице выше, чтобы увидеть историю версий тарифа.
          </p>
        ) : (
          <>
            <ol className="relative space-y-3 border-l border-line pl-5">
              {versions.map((version, index) => {
                const next = versions[index + 1];
                const isCurrent =
                  version.status === "active" &&
                  version.validFrom <= DEMO_TODAY &&
                  (version.validTo === null || version.validTo >= DEMO_TODAY);

                return (
                  <li key={version.id} className="relative">
                    <span
                      className={cn(
                        "absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2",
                        dotClass[version.status],
                      )}
                    />
                    <div
                      className={cn(
                        "rounded border px-2.5 py-2",
                        isCurrent ? "border-paid-line bg-paid-soft" : "border-line bg-white",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="tabular text-sm font-semibold text-ink-900">
                          {formatMoney(version.rate)}
                        </span>
                        <span className="text-2xs text-ink-500">
                          {formatRateUnitPerOne(version.rateUnit)}
                        </span>
                        <StatusBadge status={version.status} />
                        {isCurrent ? <Badge tone="success">Действует сейчас</Badge> : null}
                        {version.jobTitle ? (
                          <Badge tone="info">Должность: {version.jobTitle}</Badge>
                        ) : null}
                      </div>
                      <p className="tabular mt-1 text-xs text-ink-600">
                        {formatDate(version.validFrom)} —{" "}
                        {version.validTo ? formatDate(version.validTo) : "бессрочно"}
                      </p>
                      {next ? (
                        <p className="mt-1 flex items-center gap-1 text-2xs text-ink-500">
                          <ArrowRight size={11} />
                          Закрыт днём до начала следующей версии ({formatDate(previousDay(next.validFrom))})
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>

            <Hint tone="info" className="mt-3">
              При утверждении тарифа с более поздней датой начала предыдущая действующая версия
              автоматически получает дату окончания «день до новой даты начала минус один день» и
              остаётся действующей до этой даты, после чего переходит в архив. Операции прошлых
              месяцев сохраняют ту ставку, которая действовала на дату факта.
            </Hint>
          </>
        )}
      </PanelBody>
    </Panel>
  );
}
