import { useMemo, useState } from "react";
import { useStore } from "@/app/store/StoreProvider";
import {
  selectDayTemplates,
} from "@/app/store/selectors";
import { listActiveTariffableL3 } from "@/entities/sop/helpers";
import {
  PLAN_TEMPLATE_STATUS_LABEL,
  type DayPlanTemplate,
  type PlanTemplateStatus,
} from "@/entities/workPlan/model";
import { findApplicableTariff } from "@/features/payroll/applyTariff";
import { DEMO_TODAY } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field, NumberInput, Select, TextInput } from "@/shared/ui/Field";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/Table";
import { TARIFF_RATE_UNIT_LABEL } from "@/entities/tariff/model";
import { Plus, Trash2 } from "lucide-react";

type LineDraft = {
  key: string;
  sopId: string;
  objectLabel: string;
  plannedQuantity: string;
};

function emptyLine(sopId: string): LineDraft {
  return {
    key: `line-${Math.random().toString(36).slice(2, 8)}`,
    sopId,
    objectLabel: "",
    plannedQuantity: "1",
  };
}

/**
 * Вкладка «День»: список шаблонов рабочего дня и форма создания/редактирования.
 */
export function DayPlanTab({ divisionId }: { divisionId: string }) {
  const { state, dispatch, currentPerson } = useStore();
  const templates = useMemo(
    () => selectDayTemplates(state, divisionId),
    [state, divisionId],
  );
  const tariffable = listActiveTariffableL3(state.sops);
  const defaultSopId = tariffable[0]?.id ?? "";

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<PlanTemplateStatus>("active");
  const [lines, setLines] = useState<LineDraft[]>(() =>
    defaultSopId ? [emptyLine(defaultSopId)] : [],
  );
  const [error, setError] = useState<string | null>(null);

  function resetForm(template?: DayPlanTemplate | null) {
    if (template) {
      setEditingId(template.id);
      setName(template.name);
      setStatus(template.status === "draft" ? "draft" : "active");
      setLines(
        template.lines.map((l) => ({
          key: l.id,
          sopId: l.sopId,
          objectLabel: l.objectLabel,
          plannedQuantity: String(l.plannedQuantity),
        })),
      );
    } else {
      setEditingId(null);
      setName("");
      setStatus("active");
      setLines(defaultSopId ? [emptyLine(defaultSopId)] : []);
    }
    setError(null);
  }

  function submit() {
    if (!name.trim()) {
      setError("Укажите название дневного плана");
      return;
    }
    const payloadLines = lines.map((l, i) => {
      const qty = Number(l.plannedQuantity.replace(",", "."));
      return {
        sopId: l.sopId,
        objectLabel: l.objectLabel.trim(),
        plannedQuantity: qty,
        sortOrder: i + 1,
      };
    });
    for (const row of payloadLines) {
      if (!row.sopId) {
        setError("Выберите операцию СОП в каждой строке");
        return;
      }
      if (!row.objectLabel) {
        setError("Укажите объект операции в каждой строке");
        return;
      }
      if (!Number.isFinite(row.plannedQuantity) || row.plannedQuantity <= 0) {
        setError("Количество должно быть больше нуля");
        return;
      }
    }

    if (editingId) {
      dispatch({
        type: "dayPlan/update",
        templateId: editingId,
        payload: { name: name.trim(), status, lines: payloadLines },
      });
    } else {
      dispatch({
        type: "dayPlan/create",
        payload: {
          name: name.trim(),
          divisionId,
          createdByPersonId: currentPerson.id,
          status,
          lines: payloadLines,
        },
      });
    }
    resetForm(null);
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Panel>
        <PanelHeader
          title="Шаблоны дня"
          help="Именованный набор операций СОП на один рабочий день. Переиспользуется в плане недели."
        />
        <PanelBody className="p-0">
          {templates.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Нет дневных планов" description="Создайте первый справа." />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Название</TH>
                  <TH>Операций</TH>
                  <TH>Статус</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {templates.map((t) => (
                  <TR key={t.id}>
                    <TD className="font-medium">{t.name}</TD>
                    <TD className="tabular">{t.lines.length}</TD>
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
                            dispatch({ type: "dayPlan/archive", templateId: t.id })
                          }
                        >
                          В архив
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader
          title={editingId ? "Редактировать дневной план" : "Новый дневной план"}
          actions={
            editingId ? (
              <Button size="xs" variant="ghost" onClick={() => resetForm(null)}>
                Сбросить
              </Button>
            ) : null
          }
        />
        <PanelBody className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Название" required>
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Выпойка и кормление"
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-semibold uppercase tracking-wide text-ink-500">
                Операции СОП (L3)
              </span>
              <Button
                size="xs"
                variant="outline"
                disabled={!defaultSopId}
                onClick={() => setLines((prev) => [...prev, emptyLine(defaultSopId)])}
              >
                <Plus size={12} />
                Строка
              </Button>
            </div>

            {lines.length === 0 ? (
              <p className="rounded border border-dashed border-line px-3 py-4 text-xs text-ink-500">
                Пустой день — можно использовать как «выходной» в шаблоне недели.
              </p>
            ) : (
              <div className="space-y-2">
                {lines.map((line, idx) => {
                  const person = state.persons.find((p) => p.id === currentPerson.id);
                  const tariff = findApplicableTariff(
                    {
                      sopId: line.sopId,
                      divisionId,
                      jobTitle: person?.jobTitle ?? "",
                      date: DEMO_TODAY,
                    },
                    state.tariffs,
                  );
                  const unit = tariff?.rateUnit ?? "operation";
                  return (
                    <div
                      key={line.key}
                      className="grid gap-2 rounded border border-line bg-canvas/40 p-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_6.5rem_auto]"
                    >
                      <Field label={idx === 0 ? "СОП" : ""}>
                        <Select
                          value={line.sopId}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key ? { ...l, sopId: e.target.value } : l,
                              ),
                            )
                          }
                        >
                          {tariffable.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.code} · {s.name}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label={idx === 0 ? "Объект" : ""}>
                        <TextInput
                          value={line.objectLabel}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key
                                  ? { ...l, objectLabel: e.target.value }
                                  : l,
                              ),
                            )
                          }
                          placeholder="Группа / домик"
                        />
                      </Field>
                      <Field
                        label={idx === 0 ? `Кол-во (${TARIFF_RATE_UNIT_LABEL[unit]})` : ""}
                      >
                        <NumberInput
                          value={line.plannedQuantity}
                          min={0}
                          step={1}
                          onChange={(e) =>
                            setLines((prev) =>
                              prev.map((l) =>
                                l.key === line.key
                                  ? { ...l, plannedQuantity: e.target.value }
                                  : l,
                              ),
                            )
                          }
                        />
                      </Field>
                      <div className={idx === 0 ? "pt-5" : "pt-0 sm:pt-0"}>
                        <Button
                          size="xs"
                          variant="ghost"
                          aria-label="Удалить строку"
                          onClick={() =>
                            setLines((prev) => prev.filter((l) => l.key !== line.key))
                          }
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {error ? <p className="text-2xs text-reject">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={submit}>{editingId ? "Сохранить" : "Создать дневной план"}</Button>
            <Badge tone="neutral">{lines.length} опер.</Badge>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
