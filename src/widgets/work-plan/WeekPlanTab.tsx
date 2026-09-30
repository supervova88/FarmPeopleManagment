import { useMemo, useState } from "react";
import { useStore } from "@/app/store/StoreProvider";
import { selectDayTemplates, selectWeekTemplates } from "@/app/store/selectors";
import {
  emptyWeekSlots,
  PLAN_TEMPLATE_STATUS_LABEL,
  WEEKDAY_LABEL,
  WEEKDAYS,
  type PlanTemplateStatus,
  type WeekPlanSlot,
  type WeekPlanTemplate,
  type Weekday,
} from "@/entities/workPlan/model";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field, Select, TextInput } from "@/shared/ui/Field";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/Table";

/**
 * Вкладка «Неделя»: раскладка Пн–Вс из дневных планов.
 */
export function WeekPlanTab({ divisionId }: { divisionId: string }) {
  const { state, dispatch, currentPerson } = useStore();
  const dayTemplates = useMemo(
    () => selectDayTemplates(state, divisionId, true),
    [state, divisionId],
  );
  const weekTemplates = useMemo(
    () => selectWeekTemplates(state, divisionId),
    [state, divisionId],
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<PlanTemplateStatus>("active");
  const [slots, setSlots] = useState<WeekPlanSlot[]>(() => emptyWeekSlots());
  const [error, setError] = useState<string | null>(null);

  const dayById = useMemo(
    () => new Map(dayTemplates.map((d) => [d.id, d])),
    [dayTemplates],
  );

  function resetForm(template?: WeekPlanTemplate | null) {
    if (template) {
      setEditingId(template.id);
      setName(template.name);
      setStatus(template.status === "draft" ? "draft" : "active");
      const base = emptyWeekSlots();
      setSlots(
        base.map((s) => {
          const found = template.slots.find((x) => x.weekday === s.weekday);
          return { weekday: s.weekday, dayTemplateId: found?.dayTemplateId ?? null };
        }),
      );
    } else {
      setEditingId(null);
      setName("");
      setStatus("active");
      setSlots(emptyWeekSlots());
    }
    setError(null);
  }

  function setSlot(weekday: Weekday, dayTemplateId: string | null) {
    setSlots((prev) =>
      prev.map((s) => (s.weekday === weekday ? { ...s, dayTemplateId } : s)),
    );
  }

  function submit() {
    if (!name.trim()) {
      setError("Укажите название недельного плана");
      return;
    }
    if (editingId) {
      dispatch({
        type: "weekPlan/update",
        templateId: editingId,
        payload: { name: name.trim(), status, slots },
      });
    } else {
      dispatch({
        type: "weekPlan/create",
        payload: {
          name: name.trim(),
          divisionId,
          createdByPersonId: currentPerson.id,
          status,
          slots,
        },
      });
    }
    resetForm(null);
  }

  const preview = WEEKDAYS.map((weekday) => {
    const slot = slots.find((s) => s.weekday === weekday);
    const day = slot?.dayTemplateId ? dayById.get(slot.dayTemplateId) : null;
    return {
      weekday,
      dayName: day?.name ?? "Выходной",
      ops: day?.lines.length ?? 0,
      qty: day?.lines.reduce((acc, l) => acc + l.plannedQuantity, 0) ?? 0,
    };
  });

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Panel>
        <PanelHeader
          title="Шаблоны недели"
          help="Пн–Вс = выбранные дневные планы. Это ещё не календарь и не человек."
        />
        <PanelBody className="p-0">
          {weekTemplates.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Нет недельных планов"
                description="Сначала создайте дневные планы, затем соберите из них неделю."
              />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Название</TH>
                  <TH>Раб. дней</TH>
                  <TH>Статус</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {weekTemplates.map((t) => {
                  const workDays = t.slots.filter((s) => s.dayTemplateId).length;
                  return (
                    <TR key={t.id}>
                      <TD className="font-medium">{t.name}</TD>
                      <TD className="tabular">{workDays} / 7</TD>
                      <TD>
                        <StatusBadge
                          status={t.status}
                          label={PLAN_TEMPLATE_STATUS_LABEL[t.status]}
                        />
                      </TD>
                      <TD className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="xs" variant="outline" onClick={() => resetForm(t)}>
                            Изменить
                          </Button>
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() =>
                              dispatch({ type: "weekPlan/archive", templateId: t.id })
                            }
                          >
                            В архив
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
        <PanelHeader
          title={editingId ? "Редактировать недельный план" : "Новый недельный план"}
          actions={
            editingId ? (
              <Button size="xs" variant="ghost" onClick={() => resetForm(null)}>
                Сбросить
              </Button>
            ) : null
          }
        />
        <PanelBody className="space-y-3">
          {dayTemplates.length === 0 ? (
            <EmptyState
              title="Нет активных дневных планов"
              description="Создайте и активируйте дневной план на вкладке «День»."
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Название" required>
                  <TextInput
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Например: Стандарт 5/2"
                  />
                </Field>
                <Field label="Статус">
                  <Select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as PlanTemplateStatus)}
                  >
                    <option value="active">Активный</option>
                    <option value="draft">Черновик</option>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {WEEKDAYS.map((weekday) => {
                  const slot = slots.find((s) => s.weekday === weekday);
                  return (
                    <Field key={weekday} label={WEEKDAY_LABEL[weekday]}>
                      <Select
                        value={slot?.dayTemplateId ?? ""}
                        onChange={(e) =>
                          setSlot(weekday, e.target.value ? e.target.value : null)
                        }
                      >
                        <option value="">Выходной</option>
                        {dayTemplates.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.lines.length} опер.)
                          </option>
                        ))}
                      </Select>
                    </Field>
                  );
                })}
              </div>

              <div className="rounded border border-line bg-canvas/50 p-2">
                <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-500">
                  Превью недели
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.map((p) => (
                    <Badge key={p.weekday} tone={p.ops > 0 ? "info" : "muted"}>
                      {WEEKDAY_LABEL[p.weekday]}: {p.dayName}
                      {p.ops > 0 ? ` · ${p.ops} / ${p.qty}` : ""}
                    </Badge>
                  ))}
                </div>
              </div>

              {error ? <p className="text-2xs text-reject">{error}</p> : null}

              <Button onClick={submit}>
                {editingId ? "Сохранить" : "Создать недельный план"}
              </Button>
            </>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
