import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "@/app/store/StoreProvider";
import {
  selectAssignmentsForDivision,
  selectDayTemplates,
  selectWeekTemplates,
} from "@/app/store/selectors";
import { formatPersonShortName } from "@/entities/person/model";
import {
  mondayOfWeek,
  sundayOfWeek,
  weekRangeLabel,
} from "@/entities/timesheet/periodView";
import {
  WEEKDAY_LABEL,
  WEEK_PLAN_ASSIGNMENT_STATUS_LABEL,
  type Weekday,
} from "@/entities/workPlan/model";
import { formatDate, shiftDate } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Field, Select } from "@/shared/ui/Field";
import { Hint } from "@/shared/ui/Hint";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/Table";

/**
 * Вкладка «Назначения»: шаблон недели → специалист → календарная неделя.
 */
export function AssignmentsTab({ divisionId }: { divisionId: string }) {
  const { state, dispatch, currentPerson, periodView, setPeriodWeekStart } = useStore();

  const weekTemplates = useMemo(
    () => selectWeekTemplates(state, divisionId, true),
    [state, divisionId],
  );
  const dayTemplates = useMemo(
    () => selectDayTemplates(state, divisionId, true),
    [state, divisionId],
  );
  const assignments = useMemo(
    () => selectAssignmentsForDivision(state, divisionId),
    [state, divisionId],
  );

  const specialists = useMemo(
    () =>
      state.persons
        .filter(
          (p) =>
            p.divisionId === divisionId &&
            p.status === "working" &&
            (p.accessRoleId === null || p.accessRoleId === "specialist"),
        )
        .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru")),
    [state.persons, divisionId],
  );

  const [weekTemplateId, setWeekTemplateId] = useState(weekTemplates[0]?.id ?? "");
  const [personId, setPersonId] = useState(
    () => specialists.find((p) => p.accessRoleId === "specialist")?.id ?? specialists[0]?.id ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const weekStart = mondayOfWeek(periodView.weekStart);
  const weekEnd = sundayOfWeek(weekStart);

  const selectedWeek = weekTemplates.find((t) => t.id === weekTemplateId);
  const dayById = useMemo(
    () => new Map(dayTemplates.map((d) => [d.id, d])),
    [dayTemplates],
  );

  const previewDays = useMemo(() => {
    if (!selectedWeek) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const weekday = (i + 1) as Weekday;
      const date = shiftDate(weekStart, i);
      const slot = selectedWeek.slots.find((s) => s.weekday === weekday);
      const day = slot?.dayTemplateId ? dayById.get(slot.dayTemplateId) : null;
      return {
        weekday,
        date,
        dayName: day?.name ?? "Выходной",
        lines: day?.lines ?? [],
      };
    });
  }, [selectedWeek, weekStart, dayById]);

  function assign() {
    setOkMsg(null);
    if (!weekTemplateId) {
      setError("Выберите шаблон недели");
      return;
    }
    if (!personId) {
      setError("Выберите специалиста");
      return;
    }
    const before = (state.weekPlanAssignments ?? []).length;
    dispatch({
      type: "weekPlan/assign",
      payload: {
        weekTemplateId,
        personId,
        weekStart,
        assignedByPersonId: currentPerson.id,
      },
    });
    // Оптимистично: если reducer отклонил — длина не изменится после следующего рендера;
    // здесь проверяем по текущему state до диспатча условия локально.
    const overlap = (state.weekPlanAssignments ?? []).some(
      (a) =>
        a.personId === personId &&
        a.weekStart === weekStart &&
        (a.status === "assigned" || a.status === "acknowledged" || a.status === "rejected"),
    );
    if (overlap) {
      setError("На эту неделю у специалиста уже есть открытое назначение");
      return;
    }
    setError(null);
    setOkMsg(`План назначен на ${weekRangeLabel(weekStart)}`);
    void before;
  }

  return (
    <div className="space-y-3">
      <Panel>
        <PanelHeader
          title="Назначить план недели"
          help="Шаблон материализуется в задачи календарного плана. Оплата появится только после исполнения."
        />
        <PanelBody className="space-y-3">
          {weekTemplates.length === 0 ? (
            <EmptyState
              title="Нет активных шаблонов недели"
              description="Соберите недельный план на вкладке «Неделя»."
            />
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Шаблон недели" required>
                  <Select
                    value={weekTemplateId}
                    onChange={(e) => setWeekTemplateId(e.target.value)}
                  >
                    {weekTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Специалист" required>
                  <Select value={personId} onChange={(e) => setPersonId(e.target.value)}>
                    {specialists.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.fullName}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Неделя"
                  hint="Понедельник выбранной недели"
                  required
                >
                  <input
                    type="date"
                    className="h-[30px] w-full rounded border border-line-strong bg-white px-2 text-xs outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
                    value={weekStart}
                    onChange={(e) => {
                      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) return;
                      setPeriodWeekStart(e.target.value);
                    }}
                  />
                  <p className="mt-1 text-2xs text-ink-500">
                    {formatDate(weekStart)} – {formatDate(weekEnd)}
                  </p>
                </Field>
              </div>

              {previewDays.length > 0 ? (
                <div className="rounded border border-line overflow-hidden">
                  <Table>
                    <THead>
                      <TR>
                        <TH>День</TH>
                        <TH>Дата</TH>
                        <TH>Дневной план</TH>
                        <TH>СОП</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {previewDays.map((d) => (
                        <TR key={d.date}>
                          <TD>{WEEKDAY_LABEL[d.weekday]}</TD>
                          <TD className="tabular">{formatDate(d.date)}</TD>
                          <TD>{d.dayName}</TD>
                          <TD className="text-2xs text-ink-600">
                            {d.lines.length === 0
                              ? "—"
                              : d.lines
                                  .map((l) => {
                                    const sop = state.sops.find((s) => s.id === l.sopId);
                                    return `${sop?.code ?? l.sopId} × ${l.plannedQuantity}`;
                                  })
                                  .join("; ")}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>
              ) : null}

              {error ? <Hint tone="warning">{error}</Hint> : null}
              {okMsg ? <Hint tone="info">{okMsg}</Hint> : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={assign}>Назначить и запланировать</Button>
                <Link
                  to="/timesheet-calendar"
                  className="text-xs font-medium text-accent hover:underline"
                >
                  Открыть календарный план →
                </Link>
              </div>
            </>
          )}
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="Назначения подразделения" />
        <PanelBody className="p-0">
          {assignments.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Пока нет назначений" />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Специалист</TH>
                  <TH>Неделя</TH>
                  <TH>Шаблон</TH>
                  <TH>Статус</TH>
                  <TH>Задач</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {assignments.map((a) => {
                  const person = state.persons.find((p) => p.id === a.personId);
                  const tpl = state.weekPlanTemplates.find((t) => t.id === a.weekTemplateId);
                  const itemCount = state.planItems.filter(
                    (p) => p.assignmentId === a.id,
                  ).length;
                  const statusKey =
                    a.status === "assigned"
                      ? "in_review"
                      : a.status === "acknowledged"
                        ? "confirmed"
                        : a.status === "rejected"
                          ? "rejected"
                          : "archived";
                  return (
                    <TR key={a.id}>
                      <TD className="font-medium">
                        {person ? formatPersonShortName(person.fullName) : a.personId}
                      </TD>
                      <TD className="tabular">{weekRangeLabel(a.weekStart)}</TD>
                      <TD>{tpl?.name ?? a.weekTemplateId}</TD>
                      <TD>
                        <StatusBadge
                          status={statusKey}
                          label={WEEK_PLAN_ASSIGNMENT_STATUS_LABEL[a.status]}
                        />
                        {a.rejectComment ? (
                          <p className="mt-0.5 text-2xs text-reject">{a.rejectComment}</p>
                        ) : null}
                      </TD>
                      <TD className="tabular">
                        <Badge tone="neutral">{itemCount}</Badge>
                      </TD>
                      <TD className="text-right">
                        {a.status !== "cancelled" &&
                        !state.planItems.some(
                          (p) =>
                            p.assignmentId === a.id &&
                            (p.status === "completed" ||
                              p.status === "skipped" ||
                              p.status === "in_progress"),
                        ) ? (
                          <Button
                            size="xs"
                            variant="ghost"
                            onClick={() =>
                              dispatch({
                                type: "weekPlan/cancelAssignment",
                                assignmentId: a.id,
                              })
                            }
                          >
                            Отменить
                          </Button>
                        ) : null}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
