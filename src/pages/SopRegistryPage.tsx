import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "@/app/store/StoreProvider";
import { selectTariffsBySop } from "@/app/store/selectors";
import { getSopChildrenFrom, indexSops } from "@/entities/sop/helpers";
import type { Sop } from "@/entities/sop/model";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { PageHeader } from "@/shared/ui/PageHeader";
import { SopDetailCard } from "@/widgets/sop/SopDetailCard";
import { SopFormModal } from "@/widgets/sop/SopFormModal";
import { SopLevelTable } from "@/widgets/sop/SopLevelTable";
import { SopTree } from "@/widgets/sop/SopTree";
import { TariffFormModal } from "@/widgets/tariff/TariffFormModal";

/**
 * Экран 1. Реестр СОП.
 * Слева дерево L1 → L2 → L3, справа таблица дочерних СОП выбранного узла
 * и карточка операции с отдельным блоком тарифов.
 */
export function SopRegistryPage() {
  const { state, role, dispatch } = useStore();
  const navigate = useNavigate();
  const params = useParams<{ sopId?: string }>();
  const sops = state.sops;

  const byId = useMemo(() => indexSops(sops), [sops]);
  const selectedId = params.sopId ?? sops.find((s) => s.level === "L1_division")?.id ?? "";
  const selected = byId.get(selectedId) ?? sops[0];
  const [tariffFormOpen, setTariffFormOpen] = useState(false);
  const [sopFormOpen, setSopFormOpen] = useState(false);
  const [editingSop, setEditingSop] = useState<Sop | null>(null);

  const canManageTariffs =
    role.id === "tariff_methodologist" || role.id === "direction_manager";
  const canCreateSop = canManageTariffs;

  function closeSopForm() {
    setSopFormOpen(false);
    setEditingSop(null);
  }

  function openCreateSop() {
    setEditingSop(null);
    setSopFormOpen(true);
  }

  function openEditSop(sop: Sop) {
    setEditingSop(sop);
    setSopFormOpen(true);
  }

  /** Для узлов L1/L2 показываем дочерние СОП, для L3 — саму операцию. */
  const tableItems = useMemo<Sop[]>(() => {
    if (!selected) return [];
    if (selected.level === "L3_operation") return [selected];
    return getSopChildrenFrom(sops, selected.id);
  }, [selected, sops]);

  const tableLevel = tableItems[0]?.level ?? selected?.level ?? "L1_division";

  const tariffCountBySopId = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of state.tariffs) {
      map.set(t.sopId, (map.get(t.sopId) ?? 0) + 1);
    }
    return map;
  }, [state.tariffs]);

  const sopTariffs = selected ? selectTariffsBySop(state, selected.id) : [];

  function openSop(sop: Sop) {
    navigate(`/sops/${sop.id}`);
  }

  if (!selected) {
    return (
      <>
        <PageHeader
          title="Реестр СОП"
          description="Дерево СОП пусто. Добавьте первый СОП уровня L1."
          actions={
            canCreateSop ? (
              <Button onClick={openCreateSop}>Добавить СОП</Button>
            ) : null
          }
        />
        <SopFormModal
          key={editingSop?.id ?? "create-empty"}
          open={sopFormOpen}
          onClose={closeSopForm}
          presetParent={null}
          editingSop={editingSop}
          onSaved={(id) => navigate(`/sops/${id}`)}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Реестр СОП"
        description="Иерархия стандартных операционных процедур: подразделение → процесс → операция. Оплачиваются только операции уровня L3, и только через отдельно заданный тариф."
        meta={
          <>
            <Badge tone="neutral">Всего СОП: {sops.length}</Badge>
            <Badge tone="info">
              Операций L3: {sops.filter((s) => s.level === "L3_operation").length}
            </Badge>
            <Badge tone="warning">
              Без тарифа:{" "}
              {
                sops.filter(
                  (s) =>
                    s.level === "L3_operation" &&
                    s.status === "active" &&
                    (tariffCountBySopId.get(s.id) ?? 0) === 0,
                ).length
              }
            </Badge>
            <Badge tone="muted">
              В архиве: {sops.filter((s) => s.status === "archived").length}
            </Badge>
          </>
        }
        actions={
          canCreateSop ? (
            <Button onClick={openCreateSop}>Добавить СОП</Button>
          ) : null
        }
      />

      <div className="flex gap-3">
        <Panel className="w-72 shrink-0 self-start">
          <PanelHeader title="Структура СОП" subtitle="L1 → L2 → L3" />
          <PanelBody className="max-h-[70vh] overflow-y-auto px-1 py-0">
            <SopTree sops={sops} selectedId={selected.id} onSelect={openSop} />
          </PanelBody>
        </Panel>

        <div className="min-w-0 flex-1 space-y-3">
          <Panel>
            <PanelHeader
              title={
                selected.level === "L3_operation"
                  ? "Выбранная операция"
                  : `Состав: ${selected.name}`
              }
              subtitle={
                selected.level === "L3_operation"
                  ? "Операция уровня L3 — единица тарификации"
                  : `${tableItems.length} записей уровня ниже`
              }
            />
            <PanelBody className="px-0 py-0">
              {tableItems.length === 0 ? (
                <p className="px-3 py-4 text-xs text-ink-500">Дочерние СОП отсутствуют.</p>
              ) : (
                <SopLevelTable
                  items={tableItems}
                  level={tableLevel}
                  selectedId={selected.id}
                  onOpen={openSop}
                  tariffCountBySopId={tariffCountBySopId}
                />
              )}
            </PanelBody>
          </Panel>

          <SopDetailCard
            sop={selected}
            sops={sops}
            tariffs={sopTariffs}
            canManageTariffs={canManageTariffs && selected.status === "active"}
            canEditSop={canCreateSop}
            onCreateTariff={() => setTariffFormOpen(true)}
            onEditSop={() => openEditSop(selected)}
            onArchiveSop={() => {
              if (
                window.confirm(
                  "Перевести СОП в архив? Вместе с ним будут архивированы все дочерние узлы.",
                )
              ) {
                dispatch({ type: "sop/archive", sopId: selected.id });
              }
            }}
            onRestoreSop={() => dispatch({ type: "sop/restore", sopId: selected.id })}
          />
        </div>
      </div>

      <TariffFormModal
        key={selected.id}
        open={tariffFormOpen}
        onClose={() => setTariffFormOpen(false)}
        presetSopId={selected.level === "L3_operation" ? selected.id : undefined}
      />

      <SopFormModal
        key={editingSop?.id ?? "create"}
        open={sopFormOpen}
        onClose={closeSopForm}
        presetParent={selected}
        editingSop={editingSop}
        onSaved={(id) => navigate(`/sops/${id}`)}
      />
    </>
  );
}
