import { ArrowLeft, Lock } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "@/app/store/StoreProvider";
import {
  isPeriodLocked,
  selectEntryForPerson,
  selectLinesByEntry,
  selectPayoutBreakdown,
  selectPeriod,
} from "@/app/store/selectors";
import { getDivisionName } from "@/entities/division/mock";
import { PERSON_STATUS_LABEL } from "@/entities/person/model";
import { TIMESHEET_ENTRY_STATUS_LABEL } from "@/entities/timesheet/model";
import { formatDate } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/Badge";
import { Panel, PanelBody } from "@/shared/ui/Card";
import { Hint } from "@/shared/ui/Hint";
import { PageHeader } from "@/shared/ui/PageHeader";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { OperationsTable } from "@/widgets/payout/OperationsTable";
import { PayoutRibbon } from "@/widgets/payout/PayoutRibbon";

/**
 * Экран 6. Детальная карточка расчёта одного физлица за период.
 */
export function PayoutDetailPage() {
  const { state, role, currentPerson, periodView } = useStore();
  const { personId } = useParams<{ personId: string }>();

  const person = personId ? state.persons.find((p) => p.id === personId) : undefined;
  const entry = person ? selectEntryForPerson(state, person.id, periodView.monthKey) : undefined;
  const breakdown = entry ? selectPayoutBreakdown(state, entry.id) : null;
  const period = entry ? selectPeriod(state, entry.periodId) : undefined;
  const locked = isPeriodLocked(period);

  // Специалист видит только собственный расчёт
  const isForeignCard = role.id === "specialist" && person?.id !== currentPerson.id;

  if (!person || !entry || !breakdown) {
    return (
      <>
        <PageHeader title="Детальная карточка расчёта" />
        <Panel>
          <PanelBody>
            <p className="text-xs text-ink-600">
              Расчёт за период не найден: у сотрудника нет табельной записи.
            </p>
          </PanelBody>
        </Panel>
      </>
    );
  }

  if (isForeignCard) {
    return (
      <>
        <PageHeader title="Детальная карточка расчёта" />
        <Panel>
          <PanelBody className="flex items-start gap-3 py-6">
            <Lock size={18} className="mt-[1px] text-pending" />
            <div>
              <p className="text-sm font-semibold text-ink-900">Чужой расчёт недоступен</p>
              <p className="mt-1 text-xs text-ink-600">
                Роль «Специалист» видит только свои начисления.{" "}
                <Link to={`/payout/${currentPerson.id}`} className="font-medium text-accent underline">
                  Открыть свой расчёт
                </Link>
              </p>
            </div>
          </PanelBody>
        </Panel>
      </>
    );
  }

  const lines = selectLinesByEntry(state, entry.id);

  return (
    <>
      <PageHeader
        title={`Расчёт: ${person.fullName}`}
        description="Полная раскладка сдельного расчёта за период: от списка выполненных операций до итоговой суммы к выплате."
        meta={
          <>
            <Badge tone="info">Табельный №{person.personnelNumber}</Badge>
            <Badge tone="neutral">{person.jobTitle}</Badge>
            <Badge tone="neutral">{getDivisionName(person.divisionId, state.divisions)}</Badge>
            <StatusBadge status={person.status} label={PERSON_STATUS_LABEL[person.status]} />
            <Badge tone="neutral">
              {period?.periodLabel} · {formatDate(period?.dateFrom)} — {formatDate(period?.dateTo)}
            </Badge>
            <StatusBadge
              status={entry.status}
              label={`Табельная запись: ${TIMESHEET_ENTRY_STATUS_LABEL[entry.status]}`}
            />
          </>
        }
        actions={
          <Link
            to={role.id === "specialist" ? "/my-operations" : "/timesheet"}
            className="inline-flex h-7 items-center gap-1.5 rounded border border-line-strong bg-white px-2.5 text-xs font-medium text-ink-800 transition-colors hover:bg-canvas"
          >
            <ArrowLeft size={13} />
            Назад
          </Link>
        }
      />

      <div className="space-y-3">
        {locked ? (
          <Hint tone="locked">
            Период утверждён — расчёт зафиксирован и недоступен для правок.
          </Hint>
        ) : null}

        <PayoutRibbon
          breakdown={breakdown}
          operationsSlot={<OperationsTable lines={lines} compact />}
        />
      </div>
    </>
  );
}
