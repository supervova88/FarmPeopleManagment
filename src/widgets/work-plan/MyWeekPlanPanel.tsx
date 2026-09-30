import { Check, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "@/app/store/StoreProvider";
import {
  selectAssignmentsForPerson,
  selectPlanItemsForPersonRange,
} from "@/app/store/selectors";
import { getSopNameFrom } from "@/entities/sop/helpers";
import { mondayOfWeek, sundayOfWeek, weekRangeLabel } from "@/entities/timesheet/periodView";
import {
  WEEKDAY_LABEL,
  WEEK_PLAN_ASSIGNMENT_STATUS_LABEL,
  type Weekday,
} from "@/entities/workPlan/model";
import { DEMO_TODAY, formatDate, shiftDate } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { Field, Textarea } from "@/shared/ui/Field";
import { Hint } from "@/shared/ui/Hint";
import { StatusBadge } from "@/shared/ui/StatusBadge";

/**
 * Недельный план специалиста: подтверждение назначения и лента Пн–Вс.
 */
export function MyWeekPlanPanel({ personId }: { personId: string }) {
  const { state, dispatch } = useStore();
  const assignments = useMemo(
    () => selectAssignmentsForPerson(state, personId),
    [state, personId],
  );

  const focus =
    assignments.find((a) => a.status === "assigned") ??
    assignments.find(
      (a) =>
        a.weekStart <= DEMO_TODAY && sundayOfWeek(a.weekStart) >= DEMO_TODAY,
    ) ??
    assignments[0];

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);

  const weekStart = focus ? mondayOfWeek(focus.weekStart) : mondayOfWeek(DEMO_TODAY);
  const weekEnd = sundayOfWeek(weekStart);

  const items = useMemo(
    () =>
      focus
        ? selectPlanItemsForPersonRange(state, personId, weekStart, weekEnd).filter(
            (p) => !focus || p.assignmentId === focus.id || !p.assignmentId,
          )
        : selectPlanItemsForPersonRange(state, personId, weekStart, weekEnd),
    [state, personId, weekStart, weekEnd, focus],
  );

  const assignmentItems = useMemo(
    () =>
      focus
        ? state.planItems.filter((p) => p.assignmentId === focus.id)
        : [],
    [state.planItems, focus],
  );

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = shiftDate(weekStart, i);
      const weekday = (i + 1) as Weekday;
      const dayItems = (focus ? assignmentItems : items).filter(
        (p) => p.plannedDate === date,
      );
      return {
        weekday,
        date,
        isToday: date === DEMO_TODAY,
        items: dayItems.map((p) => ({
          ...p,
          sopName: getSopNameFrom(state.sops, p.sopId),
        })),
      };
    });
  }, [weekStart, assignmentItems, items, focus, state.sops]);

  if (!focus && items.length === 0) {
    return null;
  }

  function acknowledge() {
    if (!focus) return;
    dispatch({
      type: "weekPlan/acknowledge",
      assignmentId: focus.id,
      personId,
    });
  }

  function reject() {
    if (!focus) return;
    if (!rejectComment.trim()) {
      setRejectError("Укажите причину отклонения");
      return;
    }
    dispatch({
      type: "weekPlan/reject",
      assignmentId: focus.id,
      personId,
      comment: rejectComment.trim(),
    });
    setRejectOpen(false);
    setRejectComment("");
    setRejectError(null);
  }

  const tpl = focus
    ? state.weekPlanTemplates.find((t) => t.id === focus.weekTemplateId)
    : null;

  return (
    <Panel>
      <PanelHeader
        title="План рабочей недели"
        subtitle={
          focus
            ? `${weekRangeLabel(weekStart)}${tpl ? ` · ${tpl.name}` : ""}`
            : weekRangeLabel(weekStart)
        }
        actions={
          focus ? (
            <StatusBadge
              status={
                focus.status === "assigned"
                  ? "in_review"
                  : focus.status === "acknowledged"
                    ? "confirmed"
                    : focus.status === "rejected"
                      ? "rejected"
                      : "cancelled"
              }
              label={WEEK_PLAN_ASSIGNMENT_STATUS_LABEL[focus.status]}
            />
          ) : null
        }
      />
      <PanelBody className="space-y-3">
        {focus?.status === "assigned" ? (
          <div className="rounded border border-accent-line bg-accent-soft/60 px-3 py-2.5">
            <p className="text-xs font-semibold text-ink-900">
              Бригадир назначил вам план на неделю {weekRangeLabel(weekStart)}
            </p>
            <p className="mt-0.5 text-2xs text-ink-600">
              Подтвердите, что приняли задание. Исполнение задач на сегодня доступно и до
              подтверждения — оплата появится только после закрытия задачи.
            </p>
            {!rejectOpen ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Button size="sm" variant="success" onClick={acknowledge}>
                  <Check size={13} />
                  Подтвердить план
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
                  <X size={13} />
                  Отклонить
                </Button>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                <Field label="Причина отклонения" required error={rejectError}>
                  <Textarea
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                    placeholder="Например: не согласован объект или нагрузка"
                  />
                </Field>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="danger" onClick={reject}>
                    Отклонить план
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setRejectOpen(false);
                      setRejectError(null);
                    }}
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {focus?.status === "rejected" ? (
          <Hint tone="warning">
            План отклонён
            {focus.rejectComment ? `: ${focus.rejectComment}` : ""}. Задачи остаются в календаре —
            бригадир может отменить назначение или назначить заново.
          </Hint>
        ) : null}

        {focus?.status === "acknowledged" ? (
          <Hint tone="info">
            План подтверждён. Ниже — состав недели; сегодняшние задачи — в блоке «Задачи на сегодня».
          </Hint>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {days.map((day) => (
            <div
              key={day.date}
              className={
                day.isToday
                  ? "rounded border border-accent bg-accent-soft/40 p-2"
                  : "rounded border border-line bg-white p-2"
              }
            >
              <div className="mb-1.5 flex items-center justify-between gap-1">
                <span className="text-2xs font-semibold uppercase tracking-wide text-ink-500">
                  {WEEKDAY_LABEL[day.weekday]} · {formatDate(day.date)}
                </span>
                {day.isToday ? <Badge tone="info">Сегодня</Badge> : null}
              </div>
              {day.items.length === 0 ? (
                <p className="text-2xs text-ink-400">Выходной / нет задач</p>
              ) : (
                <ul className="space-y-1">
                  {day.items.map((item) => (
                    <li key={item.id} className="text-2xs leading-snug text-ink-800">
                      <span className="font-medium">{item.sopName}</span>
                      <span className="text-ink-500">
                        {" "}
                        · {item.objectLabel} · ×{item.plannedQuantity}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </PanelBody>
    </Panel>
  );
}
