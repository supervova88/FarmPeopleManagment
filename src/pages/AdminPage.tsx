import { Building2, Pencil, Plus, Users } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useStore } from "@/app/store/StoreProvider";
import type { DivisionUpsertPayload, PersonUpsertPayload } from "@/app/store/actions";
import {
  DIVISION_STATUS_LABEL,
  type Division,
  type DivisionStatus,
} from "@/entities/division/model";
import {
  PERSON_STATUS_LABEL,
  ROLE_FULL_LABEL,
  ROLE_ORDER,
  ROLE_SHORT_LABEL,
  type Person,
  type PersonStatus,
  type RoleId,
} from "@/entities/person/model";
import { DEMO_TODAY, formatDate } from "@/shared/lib/utils";
import { AccessDenied } from "@/shared/ui/AccessDenied";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { Field, Select, TextInput } from "@/shared/ui/Field";
import { Hint } from "@/shared/ui/Hint";
import { Modal } from "@/shared/ui/Modal";
import { PageHeader } from "@/shared/ui/PageHeader";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/Table";

type AdminTab = "users" | "divisions";

const PERSON_STATUSES = Object.keys(PERSON_STATUS_LABEL) as PersonStatus[];
const DIVISION_STATUSES = Object.keys(DIVISION_STATUS_LABEL) as DivisionStatus[];

/**
 * Админка без авторизации: справочник сотрудников (с уровнем доступа)
 * и справочник подразделений.
 */
export function AdminPage() {
  const { state, dispatch, role } = useStore();
  const [tab, setTab] = useState<AdminTab>("users");
  const [personEdit, setPersonEdit] = useState<Person | null | "new">(null);
  const [divisionEdit, setDivisionEdit] = useState<Division | null | "new">(null);

  const sortedPersons = useMemo(
    () =>
      [...state.persons].sort((a, b) => a.fullName.localeCompare(b.fullName, "ru")),
    [state.persons],
  );
  const sortedDivisions = useMemo(
    () => [...state.divisions].sort((a, b) => a.code.localeCompare(b.code, "ru")),
    [state.divisions],
  );

  if (role.id !== "admin") {
    return (
      <>
        <PageHeader title="Пользователи и подразделения" />
        <AccessDenied allowed={["admin"]} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Пользователи и подразделения"
        description="Справочники демо: сотрудники с уровнем доступа в переключателе ролей и оргструктура. Пароли и вход не используются."
        meta={
          <>
            <Badge tone="info">Администратор</Badge>
            <Badge tone="neutral">{state.persons.length} сотрудников</Badge>
            <Badge tone="neutral">{state.divisions.length} подразделений</Badge>
          </>
        }
      />

      <div className="space-y-3">
        <Hint tone="info">
          Уровень доступа назначает, кто появится в переключателе ролей шапки. На одну роль — один
          человек. Сотрудник без уровня остаётся в справочнике и может быть исполнителем в табеле.
        </Hint>

        <div className="flex gap-1 border-b border-line">
          <TabButton active={tab === "users"} onClick={() => setTab("users")} icon={<Users size={13} />}>
            Пользователи
          </TabButton>
          <TabButton
            active={tab === "divisions"}
            onClick={() => setTab("divisions")}
            icon={<Building2 size={13} />}
          >
            Подразделения
          </TabButton>
        </div>

        {tab === "users" ? (
          <Panel>
            <PanelHeader
              title="Сотрудники"
              subtitle="ФИО, подразделение, должность и уровень доступа"
              actions={
                <Button size="sm" onClick={() => setPersonEdit("new")}>
                  <Plus size={13} />
                  Добавить
                </Button>
              }
            />
            <PanelBody className="px-0 py-0">
              <Table>
                <THead>
                  <TR>
                    <TH>ФИО</TH>
                    <TH className="w-28">Таб. №</TH>
                    <TH>Подразделение</TH>
                    <TH>Должность</TH>
                    <TH className="w-36">Уровень доступа</TH>
                    <TH className="w-28">Статус</TH>
                    <TH align="right" className="w-24">
                      Действия
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {sortedPersons.map((person) => {
                    const division = state.divisions.find((d) => d.id === person.divisionId);
                    return (
                      <TR key={person.id}>
                        <TD className="font-medium text-ink-900">{person.fullName}</TD>
                        <TD className="tabular text-ink-600">{person.personnelNumber}</TD>
                        <TD className="text-ink-600">{division?.name ?? person.divisionId}</TD>
                        <TD className="text-ink-600">{person.jobTitle}</TD>
                        <TD>
                          {person.accessRoleId ? (
                            <Badge tone="info">{ROLE_SHORT_LABEL[person.accessRoleId]}</Badge>
                          ) : (
                            <span className="text-2xs text-ink-400">нет</span>
                          )}
                        </TD>
                        <TD>
                          <StatusBadge status={person.status} />
                        </TD>
                        <TD align="right">
                          <Button size="sm" variant="ghost" onClick={() => setPersonEdit(person)}>
                            <Pencil size={12} />
                            Изменить
                          </Button>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </PanelBody>
          </Panel>
        ) : (
          <Panel>
            <PanelHeader
              title="Подразделения"
              subtitle="Оргструктура фермы; при создании открывается период августа 2026"
              actions={
                <Button size="sm" onClick={() => setDivisionEdit("new")}>
                  <Plus size={13} />
                  Добавить
                </Button>
              }
            />
            <PanelBody className="px-0 py-0">
              <Table>
                <THead>
                  <TR>
                    <TH className="w-28">Код</TH>
                    <TH>Наименование</TH>
                    <TH>Ферма</TH>
                    <TH>Руководитель</TH>
                    <TH className="w-28">Статус</TH>
                    <TH align="right" className="w-24">
                      Действия
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {sortedDivisions.map((division) => {
                    const head = state.persons.find((p) => p.id === division.headPersonId);
                    return (
                      <TR key={division.id}>
                        <TD className="tabular font-medium text-ink-900">{division.code}</TD>
                        <TD className="text-ink-900">{division.name}</TD>
                        <TD className="text-ink-600">{division.farmName}</TD>
                        <TD className="text-ink-600">{head?.fullName ?? division.headPersonId}</TD>
                        <TD>
                          <StatusBadge
                            status={division.status}
                            label={DIVISION_STATUS_LABEL[division.status]}
                          />
                        </TD>
                        <TD align="right">
                          <Button size="sm" variant="ghost" onClick={() => setDivisionEdit(division)}>
                            <Pencil size={12} />
                            Изменить
                          </Button>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </PanelBody>
          </Panel>
        )}
      </div>

      {personEdit !== null ? (
        <PersonFormModal
          key={personEdit === "new" ? "new-person" : personEdit.id}
          open
          person={personEdit === "new" ? null : personEdit}
          onClose={() => setPersonEdit(null)}
          onSave={(payload) => {
            if (personEdit === "new") {
              dispatch({ type: "person/create", payload });
            } else {
              dispatch({ type: "person/update", personId: personEdit.id, payload });
            }
            setPersonEdit(null);
          }}
        />
      ) : null}

      {divisionEdit !== null ? (
        <DivisionFormModal
          key={divisionEdit === "new" ? "new-division" : divisionEdit.id}
          open
          division={divisionEdit === "new" ? null : divisionEdit}
          onClose={() => setDivisionEdit(null)}
          onSave={(payload) => {
            if (divisionEdit === "new") {
              dispatch({ type: "division/create", payload });
            } else {
              dispatch({ type: "division/update", divisionId: divisionEdit.id, payload });
            }
            setDivisionEdit(null);
          }}
        />
      ) : null}
    </>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "-mb-px inline-flex items-center gap-1.5 border-b-2 border-accent px-3 py-2 text-xs font-semibold text-accent"
          : "inline-flex items-center gap-1.5 px-3 py-2 text-xs text-ink-500 hover:text-ink-800"
      }
    >
      {icon}
      {children}
    </button>
  );
}

function PersonFormModal({
  open,
  person,
  onClose,
  onSave,
}: {
  open: boolean;
  person: Person | null;
  onClose: () => void;
  onSave: (payload: PersonUpsertPayload) => void;
}) {
  const { state } = useStore();
  const activeDivisions = state.divisions.filter((d) => d.status === "active");
  const [fullName, setFullName] = useState(person?.fullName ?? "");
  const [personnelNumber, setPersonnelNumber] = useState(person?.personnelNumber ?? "");
  const [divisionId, setDivisionId] = useState(
    person?.divisionId ?? activeDivisions[0]?.id ?? "",
  );
  const [jobTitle, setJobTitle] = useState(person?.jobTitle ?? "");
  const [status, setStatus] = useState<PersonStatus>(person?.status ?? "working");
  const [hiredAt, setHiredAt] = useState(person?.hiredAt ?? DEMO_TODAY);
  const [accessRoleId, setAccessRoleId] = useState<string>(person?.accessRoleId ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!fullName.trim() || !personnelNumber.trim() || !jobTitle.trim() || !divisionId) {
      setError("Заполните ФИО, табельный номер, подразделение и должность.");
      return;
    }
    onSave({
      fullName,
      personnelNumber,
      divisionId,
      jobTitle,
      status,
      hiredAt,
      accessRoleId: (accessRoleId || null) as RoleId | null,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={person ? "Изменить сотрудника" : "Новый сотрудник"}
      subtitle="Без логина и пароля — только справочник и уровень доступа"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit}>Сохранить</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="ФИО" className="col-span-2">
          <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Табельный номер">
          <TextInput value={personnelNumber} onChange={(e) => setPersonnelNumber(e.target.value)} />
        </Field>
        <Field label="Дата приёма">
          <TextInput type="date" value={hiredAt} onChange={(e) => setHiredAt(e.target.value)} />
        </Field>
        <Field label="Подразделение">
          <Select value={divisionId} onChange={(e) => setDivisionId(e.target.value)}>
            {activeDivisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Должность">
          <TextInput value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
        </Field>
        <Field label="Статус">
          <Select value={status} onChange={(e) => setStatus(e.target.value as PersonStatus)}>
            {PERSON_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PERSON_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Уровень доступа" hint="Кто виден в переключателе ролей">
          <Select value={accessRoleId} onChange={(e) => setAccessRoleId(e.target.value)}>
            <option value="">Нет (только справочник)</option>
            {ROLE_ORDER.map((id) => (
              <option key={id} value={id}>
                {ROLE_FULL_LABEL[id]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {error ? <p className="mt-2 text-xs text-reject">{error}</p> : null}
    </Modal>
  );
}

function DivisionFormModal({
  open,
  division,
  onClose,
  onSave,
}: {
  open: boolean;
  division: Division | null;
  onClose: () => void;
  onSave: (payload: DivisionUpsertPayload) => void;
}) {
  const { state } = useStore();
  const [code, setCode] = useState(division?.code ?? "");
  const [name, setName] = useState(division?.name ?? "");
  const [farmName, setFarmName] = useState(division?.farmName ?? "Василево");
  const [parentId, setParentId] = useState(division?.parentId ?? "");
  const [headPersonId, setHeadPersonId] = useState(
    division?.headPersonId ?? state.persons[0]?.id ?? "",
  );
  const [status, setStatus] = useState<DivisionStatus>(division?.status ?? "active");
  const [error, setError] = useState<string | null>(null);

  const parentOptions = state.divisions.filter((d) => d.id !== division?.id);

  function submit() {
    if (!code.trim() || !name.trim() || !headPersonId) {
      setError("Заполните код, наименование и руководителя.");
      return;
    }
    onSave({
      code,
      name,
      farmName,
      parentId: parentId || null,
      headPersonId,
      status,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={division ? "Изменить подразделение" : "Новое подразделение"}
      subtitle={
        division
          ? undefined
          : `Будет создан открытый период «Август 2026» (${formatDate("2026-08-01")}–${formatDate("2026-08-31")})`
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit}>Сохранить</Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Код">
          <TextInput value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field label="Статус">
          <Select value={status} onChange={(e) => setStatus(e.target.value as DivisionStatus)}>
            {DIVISION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DIVISION_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Наименование" className="col-span-2">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Ферма / площадка">
          <TextInput value={farmName} onChange={(e) => setFarmName(e.target.value)} />
        </Field>
        <Field label="Родительское подразделение">
          <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Нет (верхний уровень)</option>
            {parentOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} · {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Руководитель" className="col-span-2">
          <Select value={headPersonId} onChange={(e) => setHeadPersonId(e.target.value)}>
            {state.persons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {error ? <p className="mt-2 text-xs text-reject">{error}</p> : null}
    </Modal>
  );
}
