import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { buildDemoRoles, type DemoRole, type Person, type RoleId } from "@/entities/person/model";
import {
  defaultPeriodView,
  firstWeekStartForMonth,
  mondayOfWeek,
  monthKeyFromIso,
  monthNeedsEnsure,
  type PeriodGranularity,
  type PeriodViewState,
} from "@/entities/timesheet/periodView";
import type { AppAction } from "./actions";
import { fetchAppState, postAppAction } from "./api";
import type { AppState } from "./reducer";

interface StoreValue {
  state: AppState;
  dispatch: (action: AppAction) => void;
  role: DemoRole;
  currentPerson: Person;
  /** Роли, доступные в переключателе шапки */
  demoRoles: DemoRole[];
  /** Клиентский фильтр расчётного периода (месяц / неделя) */
  periodView: PeriodViewState;
  setPeriodGranularity: (granularity: PeriodGranularity) => void;
  setPeriodMonthKey: (monthKey: string) => void;
  setPeriodWeekStart: (weekStart: string) => void;
  /** Выбранное подразделение в разделе «Расчёт» (клиентское) */
  selectedDivisionId: string;
  setSelectedDivisionId: (divisionId: string) => void;
  ready: boolean;
  error: string | null;
}

const StoreContext = createContext<StoreValue | null>(null);

function resolvePerson(state: AppState, role: DemoRole): Person {
  return state.persons.find((p) => p.id === role.personId) ?? state.persons[0]!;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [periodView, setPeriodView] = useState<PeriodViewState>(defaultPeriodView);
  const [selectedDivisionId, setSelectedDivisionIdState] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    fetchAppState()
      .then((next) => {
        if (!cancelled) {
          setState(next);
          setError(null);
          const demoRoles = buildDemoRoles(next.persons);
          const role =
            demoRoles.find((r) => r.id === next.currentRoleId) ?? demoRoles[0];
          if (role) {
            const person = next.persons.find((p) => p.id === role.personId) ?? next.persons[0];
            if (person) setSelectedDivisionIdState(person.divisionId);
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dispatch = useCallback((action: AppAction) => {
    setPending((n) => n + 1);
    postAppAction(action)
      .then((next) => {
        setState(next);
        setError(null);
        if (action.type === "role/set") {
          const demoRoles = buildDemoRoles(next.persons);
          const role = demoRoles.find((r) => r.id === action.roleId) ?? demoRoles[0];
          if (role) {
            const person = next.persons.find((p) => p.id === role.personId) ?? next.persons[0];
            if (person) setSelectedDivisionIdState(person.divisionId);
          }
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        setPending((n) => Math.max(0, n - 1));
      });
  }, []);

  const ensureMonthIfNeeded = useCallback(
    (monthKey: string, current: AppState | null) => {
      if (!current || !/^\d{4}-\d{2}$/.test(monthKey)) return;
      const divisionIds = current.divisions.map((d) => d.id);
      if (!monthNeedsEnsure(current.periods, divisionIds, monthKey)) return;
      dispatch({ type: "period/ensureMonth", monthKey });
    },
    [dispatch],
  );

  const setPeriodGranularity = useCallback((granularity: PeriodGranularity) => {
    setPeriodView((prev) => ({ ...prev, granularity }));
  }, []);

  const setPeriodMonthKey = useCallback(
    (monthKey: string) => {
      if (!/^\d{4}-\d{2}$/.test(monthKey)) return;
      setPeriodView((prev) => {
        const weekStart = state
          ? firstWeekStartForMonth(monthKey, state.periods)
          : firstWeekStartForMonth(monthKey, []);
        return { ...prev, monthKey, weekStart };
      });
      ensureMonthIfNeeded(monthKey, state);
    },
    [state, ensureMonthIfNeeded],
  );

  const setPeriodWeekStart = useCallback(
    (pickedDate: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(pickedDate)) return;
      const weekStart = mondayOfWeek(pickedDate);
      const monthKey = monthKeyFromIso(pickedDate);
      setPeriodView((prev) => ({
        ...prev,
        weekStart,
        monthKey,
        granularity: "week",
      }));
      ensureMonthIfNeeded(monthKey, state);
    },
    [state, ensureMonthIfNeeded],
  );

  const setSelectedDivisionId = useCallback((divisionId: string) => {
    setSelectedDivisionIdState(divisionId);
  }, []);

  const value = useMemo<StoreValue | null>(() => {
    if (!state) return null;
    const demoRoles = buildDemoRoles(state.persons);
    const role =
      demoRoles.find((r) => r.id === state.currentRoleId) ??
      demoRoles[0] ??
      ({
        id: "specialist" as RoleId,
        personId: state.persons[0]?.id ?? "",
        title: "Специалист",
        shortTitle: "Специалист",
      } satisfies DemoRole);
    const currentPerson = resolvePerson(state, role);
    const divisionId =
      selectedDivisionId ||
      currentPerson.divisionId ||
      state.divisions[0]?.id ||
      "";

    return {
      state,
      dispatch,
      role,
      currentPerson,
      demoRoles,
      periodView,
      setPeriodGranularity,
      setPeriodMonthKey,
      setPeriodWeekStart,
      selectedDivisionId: divisionId,
      setSelectedDivisionId,
      ready: true,
      error,
    };
  }, [
    state,
    dispatch,
    error,
    periodView,
    setPeriodGranularity,
    setPeriodMonthKey,
    setPeriodWeekStart,
    selectedDivisionId,
    setSelectedDivisionId,
  ]);

  if (error && !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center">
        <div className="max-w-md space-y-2">
          <p className="text-lg font-semibold text-slate-900">Нет связи с API / SQLite</p>
          <p className="text-sm text-slate-600">
            Запустите сервер командой <code className="rounded bg-slate-200 px-1">npm run api</code>{" "}
            или <code className="rounded bg-slate-200 px-1">npm run dev:full</code>.
          </p>
          <p className="text-xs text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        Загрузка данных из SQLite…
        {pending > 0 ? "…" : null}
      </div>
    );
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore должен вызываться внутри StoreProvider");
  return ctx;
}

export function useRoleId(): RoleId {
  return useStore().state.currentRoleId;
}
