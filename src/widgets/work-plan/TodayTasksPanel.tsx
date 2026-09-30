import { Check, ClipboardList, Pencil, Play, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "@/app/store/StoreProvider";
import { selectPlanItemsForPersonDay } from "@/app/store/selectors";
import { getSopNameFrom, indexSops } from "@/entities/sop/helpers";
import {
  isPlanItemOpen,
  WORK_PLAN_SOURCE_LABEL,
  WORK_PLAN_STATUS_LABEL,
  type WorkPlanItem,
} from "@/entities/workPlan/model";
import { DEMO_TODAY, formatDate } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { Hint } from "@/shared/ui/Hint";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { AddPlanModal } from "./AddPlanModal";
import { CompletePlanModal, EditPlanModal } from "./PlanTaskModals";

/**
 * Рабочий стол дня специалиста: задачи из плана, ручной подбор, исполнение.
 */
export function TodayTasksPanel({
  personId,
  canEditToday,
}: {
  personId: string;
  /** Специалист правит только сегодня; бригадир на своём экране не использует этот блок */
  canEditToday: boolean;
}) {
  const { state, dispatch, currentPerson } = useStore();
  const sopById = indexSops(state.sops);
  const items = useMemo(
    () => selectPlanItemsForPersonDay(state, personId, DEMO_TODAY),
    [state, personId],
  );

  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<WorkPlanItem | null>(null);
  const [completeItem, setCompleteItem] = useState<WorkPlanItem | null>(null);

  const openCount = items.filter((i) => isPlanItemOpen(i)).length;

  return (
    <>
      <Panel>
        <PanelHeader
          title="Задачи на сегодня"
          help={`${formatDate(DEMO_TODAY)} · план работ подразделения`}
          actions={
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone="info">{openCount} открыто</Badge>
              {canEditToday ? (
                <Button size="xs" variant="outline" onClick={() => setAddOpen(true)}>
                  <Plus size={12} />
                  Подобрать СОП
                </Button>
              ) : null}
            </div>
          }
          icon={<ClipboardList size={14} />}
        />
        <PanelBody className="space-y-2">
          {!canEditToday ? (
            <Hint tone="locked">
              Корректировать и закрывать задачи можно только в день исполнения ({formatDate(DEMO_TODAY)}).
            </Hint>
          ) : (
            <Hint tone="info">
              Возьмите задачу в работу, при необходимости скорректируйте объект или количество и
              подтвердите исполнение — тогда появится позиция в табеле. Бригадир примет факт при
              проверке табеля.
            </Hint>
          )}

          {items.length === 0 ? (
            <p className="py-3 text-xs text-ink-500">
              На сегодня задач в плане нет. Можно подобрать операцию СОП самостоятельно.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {items.map((item) => {
                const sop = sopById.get(item.sopId);
                const open = isPlanItemOpen(item);
                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded border border-line px-2.5 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-ink-900">
                        {sop?.code ?? ""} · {getSopNameFrom(state.sops, item.sopId)}
                      </p>
                      <p className="text-2xs text-ink-500">
                        {item.objectLabel} · план {item.plannedQuantity}
                        {" · "}
                        {WORK_PLAN_SOURCE_LABEL[item.source]}
                      </p>
                      <div className="mt-1">
                        <StatusBadge
                          status={item.status}
                          label={WORK_PLAN_STATUS_LABEL[item.status]}
                        />
                      </div>
                    </div>
                    {canEditToday && open ? (
                      <div className="flex flex-wrap justify-end gap-1">
                        {item.status === "planned" ? (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => dispatch({ type: "plan/take", planId: item.id })}
                          >
                            <Play size={11} />
                            В работу
                          </Button>
                        ) : null}
                        <Button size="xs" variant="ghost" onClick={() => setEditItem(item)}>
                          <Pencil size={11} />
                          Правка
                        </Button>
                        <Button size="xs" variant="success" onClick={() => setCompleteItem(item)}>
                          <Check size={11} />
                          Исполнено
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          title="Не выполнено"
                          onClick={() => dispatch({ type: "plan/skip", planId: item.id })}
                        >
                          <X size={11} />
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </PanelBody>
      </Panel>

      <AddPlanModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        personName={currentPerson.fullName}
        personId={personId}
        plannedDate={DEMO_TODAY}
        onSubmit={(payload) =>
          dispatch({
            type: "plan/create",
            payload: {
              ...payload,
              personId,
              plannedDate: DEMO_TODAY,
              source: "self_picked",
              createdByPersonId: currentPerson.id,
            },
          })
        }
      />

      <EditPlanModal
        open={editItem !== null}
        item={editItem}
        onClose={() => setEditItem(null)}
        onSubmit={(payload) => {
          if (!editItem) return;
          dispatch({ type: "plan/update", planId: editItem.id, payload });
        }}
      />

      <CompletePlanModal
        open={completeItem !== null}
        item={completeItem}
        onClose={() => setCompleteItem(null)}
        onSubmit={(payload) => {
          if (!completeItem) return;
          dispatch({ type: "plan/complete", planId: completeItem.id, payload });
        }}
      />
    </>
  );
}
