import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { useStore } from "@/app/store/StoreProvider";
import { AccessDenied } from "@/shared/ui/AccessDenied";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { PageHeader } from "@/shared/ui/PageHeader";
import { cn } from "@/shared/lib/utils";
import { CalcFilters } from "@/widgets/period/CalcFilters";
import { DayPlanTab } from "@/widgets/work-plan/DayPlanTab";
import { WeekPlanTab } from "@/widgets/work-plan/WeekPlanTab";
import { AssignmentsTab } from "@/widgets/work-plan/AssignmentsTab";

type TabId = "day" | "week" | "assign";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "day", label: "День" },
  { id: "week", label: "Неделя" },
  { id: "assign", label: "Назначения" },
];

/**
 * Бригадир: дневной план из СОП → неделя из дней → назначение специалисту.
 */
export function WorkPlansPage() {
  const { role, currentPerson, selectedDivisionId } = useStore();
  const canAccess = role.id === "foreman" || role.id === "direction_manager";
  const [tab, setTab] = useState<TabId>("day");

  const divisionId = useMemo(() => {
    if (role.id === "direction_manager") return selectedDivisionId || currentPerson.divisionId;
    return currentPerson.divisionId;
  }, [role.id, selectedDivisionId, currentPerson.divisionId]);

  if (!canAccess) {
    return (
      <>
        <PageHeader title="Планы работ" />
        <AccessDenied allowed={["foreman", "direction_manager"]} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Планы работ"
        help="Сначала настройте день из СОП, затем соберите неделю из дневных планов и назначьте специалисту. Специалист подтвердит план на экране «Мои операции»."
        meta={
          <>
            <Badge tone="info" icon={<ClipboardList size={10} />}>
              День → неделя → назначение
            </Badge>
            <Link
              to="/timesheet-calendar"
              className="text-xs font-medium text-accent hover:underline"
            >
              Календарный план →
            </Link>
          </>
        }
      />

      <CalcFilters />

      <div
        className="mb-3 inline-flex overflow-hidden rounded border border-line-strong bg-white"
        role="tablist"
        aria-label="Шаги планирования"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium transition-colors",
              tab === t.id ? "bg-accent text-white" : "text-ink-700 hover:bg-canvas",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "day" ? <DayPlanTab divisionId={divisionId} /> : null}
      {tab === "week" ? <WeekPlanTab divisionId={divisionId} /> : null}
      {tab === "assign" ? <AssignmentsTab divisionId={divisionId} /> : null}

      {tab !== "assign" ? (
        <div className="mt-3">
          <Button
            variant="outline"
            onClick={() => setTab(tab === "day" ? "week" : "assign")}
          >
            Далее: {tab === "day" ? "Неделя" : "Назначения"} →
          </Button>
        </div>
      ) : null}
    </>
  );
}
