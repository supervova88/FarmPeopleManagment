import { Check, Coins, Eye, Filter, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/app/store/StoreProvider";
import { getDivisionName } from "@/entities/division/mock";
import { getPersonName } from "@/entities/person/mock";
import { indexSops, listL3Sops } from "@/entities/sop/helpers";
import {
  formatRateWithUnit,
  TARIFF_STATUS_LABEL,
  type TariffStatus,
} from "@/entities/tariff/model";
import { getTariffTimeline } from "@/features/payroll/applyTariff";
import { DEMO_TODAY, formatDate, formatMoney } from "@/shared/lib/utils";
import { AccessDenied } from "@/shared/ui/AccessDenied";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { Field, Select } from "@/shared/ui/Field";
import { Hint } from "@/shared/ui/Hint";
import { PageHeader } from "@/shared/ui/PageHeader";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { MoneyCell, Table, TBody, TD, TH, THead, TR } from "@/shared/ui/Table";
import { TariffFormModal } from "@/widgets/tariff/TariffFormModal";
import { TariffTimeline } from "@/widgets/tariff/TariffTimeline";

type PeriodFilter = "all" | "current" | "future" | "expired";

/**
 * Экран 2. Управление тарифами.
 * Список: типовая операция — утверждение черновика.
 * Нетиповые (архив / восстановить / снять утверждение) — в карточке /tariffs/:id.
 */
export function TariffsPage() {
  const { state, dispatch, role, currentPerson } = useStore();
  const navigate = useNavigate();
  const sopById = useMemo(() => indexSops(state.sops), [state.sops]);
  const l3Sops = useMemo(() => listL3Sops(state.sops), [state.sops]);

  const [divisionFilter, setDivisionFilter] = useState("all");
  const [sopFilter, setSopFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<TariffStatus | "all">("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [timelineKey, setTimelineKey] = useState<{ sopId: string; divisionId: string }>({
    sopId: "sop-1-2-2",
    divisionId: "div-calf",
  });

  const canCreate = role.id === "tariff_methodologist" || role.id === "direction_manager";
  const canApprove = role.id === "direction_manager";

  const filtered = useMemo(() => {
    return state.tariffs
      .filter((t) => (divisionFilter === "all" ? true : t.divisionId === divisionFilter))
      .filter((t) => (sopFilter === "all" ? true : t.sopId === sopFilter))
      .filter((t) => (statusFilter === "all" ? true : t.status === statusFilter))
      .filter((t) => {
        if (periodFilter === "all") return true;
        const started = t.validFrom <= DEMO_TODAY;
        const ended = t.validTo !== null && t.validTo < DEMO_TODAY;
        if (periodFilter === "current") return started && !ended;
        if (periodFilter === "future") return !started;
        return ended;
      })
      .sort((a, b) => {
        const an = sopById.get(a.sopId)?.code ?? "";
        const bn = sopById.get(b.sopId)?.code ?? "";
        if (an !== bn) return an.localeCompare(bn);
        if (a.divisionId !== b.divisionId) return a.divisionId.localeCompare(b.divisionId);
        return a.validFrom.localeCompare(b.validFrom);
      });
  }, [state.tariffs, divisionFilter, sopFilter, statusFilter, periodFilter, sopById]);

  const drafts = useMemo(
    () =>
      state.tariffs
        .filter((t) => t.status === "draft")
        .sort((a, b) => a.validFrom.localeCompare(b.validFrom)),
    [state.tariffs],
  );

  const draftCount = drafts.length;
  const sopsWithoutTariff = l3Sops.filter(
    (s) =>
      s.status === "active" &&
      s.isTariffable &&
      !state.tariffs.some((t) => t.sopId === s.id),
  );

  const timelineVersions = getTariffTimeline(
    timelineKey.sopId,
    timelineKey.divisionId,
    state.tariffs,
  );

  if (!canCreate) {
    return (
      <>
        <PageHeader title="Управление тарифами" />
        <AccessDenied allowed={["tariff_methodologist", "direction_manager"]} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Управление тарифами"
        description="Тариф — отдельная сущность: ставка в рублях за выбранную единицу (операция, час, голова, домик, секция). Ставка может отличаться по подразделениям и должностям и меняться версиями во времени."
        meta={
          <>
            <Badge tone="neutral">Всего тарифов: {state.tariffs.length}</Badge>
            <Badge tone="warning">Черновиков на утверждение: {draftCount}</Badge>
            <Badge tone="danger">Операций без тарифа: {sopsWithoutTariff.length}</Badge>
          </>
        }
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Coins size={13} />
            Создать тариф
          </Button>
        }
      />

      <div className="space-y-3">
        {!canApprove ? (
          <Hint tone="info">
            Роль «Методолог» создаёт черновики, архивирует и восстанавливает тарифы. Утвердить
            черновик или снять утверждение может только «Управляющий» — в очереди ниже или в
            карточке тарифа.
          </Hint>
        ) : null}

        {sopsWithoutTariff.length > 0 ? (
          <Hint tone="warning">
            Тарифицируемые операции без единого тарифа:{" "}
            <strong>{sopsWithoutTariff.map((s) => s.name).join(", ")}</strong>. Факты по ним
            фиксируются, но попадают в табель со статусом «Тариф не задан» и суммой «—».
          </Hint>
        ) : null}

        <Panel>
          <PanelHeader
            title="Очередь на утверждение"
            subtitle={
              draftCount === 0
                ? "Черновиков нет"
                : `${draftCount} черновик(ов) — типовая операция списка`
            }
          />
          <PanelBody className="px-0 py-0">
            {drafts.length === 0 ? (
              <p className="px-3 py-4 text-xs text-ink-500">Нет тарифов, ожидающих утверждения.</p>
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH className="w-32">Код СОП</TH>
                    <TH>Операция</TH>
                    <TH className="w-40">Подразделение</TH>
                    <TH align="right" className="w-28">
                      Ставка
                    </TH>
                    <TH className="w-44">С даты</TH>
                    <TH className="w-48" align="right">
                      Действия
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {drafts.map((t) => {
                    const sop = sopById.get(t.sopId);
                    return (
                      <TR key={t.id}>
                        <TD className="font-medium text-ink-700">{sop?.code}</TD>
                        <TD className="font-medium text-ink-900">{sop?.name}</TD>
                        <TD className="text-ink-600">{getDivisionName(t.divisionId, state.divisions)}</TD>
                        <TD align="right">
                          <MoneyCell muted>
                            {formatRateWithUnit(formatMoney(t.rate), t.rateUnit)}
                          </MoneyCell>
                        </TD>
                        <TD className="tabular text-ink-600">{formatDate(t.validFrom)}</TD>
                        <TD align="right">
                          <div className="flex justify-end gap-1">
                            {canApprove ? (
                              <Button
                                size="xs"
                                variant="success"
                                onClick={() =>
                                  dispatch({
                                    type: "tariff/approve",
                                    tariffId: t.id,
                                    approverPersonId: currentPerson.id,
                                  })
                                }
                              >
                                <Check size={11} />
                                Утвердить
                              </Button>
                            ) : (
                              <span className="text-2xs text-ink-500">Ожидает управляющего</span>
                            )}
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => navigate(`/tariffs/${t.id}`)}
                            >
                              <Eye size={11} />
                              Карточка
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => dispatch({ type: "tariff/reject", tariffId: t.id })}
                              title="Удалить черновик"
                            >
                              <Trash2 size={11} />
                            </Button>
                          </div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="Фильтры" icon={<Filter size={14} />} />
          <PanelBody className="grid grid-cols-4 gap-3">
            <Field label="Подразделение">
              <Select value={divisionFilter} onChange={(e) => setDivisionFilter(e.target.value)}>
                <option value="all">Все подразделения</option>
                {state.divisions
                  .filter((d) => d.status === "active")
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="СОП">
              <Select value={sopFilter} onChange={(e) => setSopFilter(e.target.value)}>
                <option value="all">Все операции</option>
                {l3Sops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Статус">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as TariffStatus | "all")}
              >
                <option value="all">Любой статус</option>
                {(Object.keys(TARIFF_STATUS_LABEL) as TariffStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {TARIFF_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Период действия" hint={`Относительно ${formatDate(DEMO_TODAY)}`}>
              <Select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
              >
                <option value="all">Любой</option>
                <option value="current">Действует сейчас</option>
                <option value="future">Начнёт действовать позже</option>
                <option value="expired">Срок истёк</option>
              </Select>
            </Field>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader
            title="Все тарифы"
            subtitle={`Показано ${filtered.length} из ${state.tariffs.length}. Архив и восстановление — в карточке.`}
          />
          <PanelBody className="px-0 py-0">
            <Table>
              <THead>
                <TR>
                  <TH className="w-32">Код СОП</TH>
                  <TH>Операция</TH>
                  <TH className="w-40">Подразделение</TH>
                  <TH className="w-44">Должность</TH>
                  <TH align="right" className="w-28">
                    Ставка
                  </TH>
                  <TH className="w-44">Период действия</TH>
                  <TH className="w-28">Статус</TH>
                  <TH className="w-36">Утвердил</TH>
                  <TH className="w-40" align="right">
                    Действия
                  </TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((t) => {
                  const sop = sopById.get(t.sopId);
                  const isTimelineTarget =
                    t.sopId === timelineKey.sopId && t.divisionId === timelineKey.divisionId;
                  return (
                    <TR
                      key={t.id}
                      selected={isTimelineTarget}
                      onClick={() => setTimelineKey({ sopId: t.sopId, divisionId: t.divisionId })}
                    >
                      <TD className="font-medium text-ink-700">{sop?.code}</TD>
                      <TD className="font-medium text-ink-900">{sop?.name}</TD>
                      <TD className="text-ink-600">{getDivisionName(t.divisionId, state.divisions)}</TD>
                      <TD className="text-ink-600">{t.jobTitle ?? "Все должности"}</TD>
                      <TD align="right">
                        <MoneyCell emphasis={t.status === "active"} muted={t.status === "archived"}>
                          {formatRateWithUnit(formatMoney(t.rate), t.rateUnit)}
                        </MoneyCell>
                      </TD>
                      <TD className="tabular text-ink-600">
                        {formatDate(t.validFrom)} — {t.validTo ? formatDate(t.validTo) : "бессрочно"}
                      </TD>
                      <TD>
                        <StatusBadge status={t.status} />
                      </TD>
                      <TD className="text-ink-600">
                        {t.approvedByPersonId ? getPersonName(t.approvedByPersonId, state.persons) : "—"}
                      </TD>
                      <TD align="right">
                        <div className="flex justify-end gap-1">
                          {t.status === "draft" && canApprove ? (
                            <Button
                              size="xs"
                              variant="success"
                              onClick={(e) => {
                                e.stopPropagation();
                                dispatch({
                                  type: "tariff/approve",
                                  tariffId: t.id,
                                  approverPersonId: currentPerson.id,
                                });
                              }}
                            >
                              <Check size={11} />
                              Утвердить
                            </Button>
                          ) : null}
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/tariffs/${t.id}`);
                            }}
                          >
                            <Eye size={11} />
                            Карточка
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-ink-500">
                По заданным фильтрам тарифов не найдено.
              </p>
            ) : null}
          </PanelBody>
        </Panel>

        <TariffTimeline
          sopId={timelineKey.sopId}
          divisionId={timelineKey.divisionId}
          versions={timelineVersions}
        />
      </div>

      <TariffFormModal open={formOpen} onClose={() => setFormOpen(false)} />
    </>
  );
}
