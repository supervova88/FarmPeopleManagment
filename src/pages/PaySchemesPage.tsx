import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "@/app/store/StoreProvider";
import { selectPaySchemes } from "@/app/store/selectors";
import { getDivisionName } from "@/entities/division/mock";
import {
  PAY_COMPONENT_KIND_LABEL,
  PAY_SCHEME_STATUS_LABEL,
  PAY_SITE_LABEL,
  type PayScheme,
  type PaySchemeStatus,
} from "@/entities/payScheme/model";
import { AccessDenied } from "@/shared/ui/AccessDenied";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Hint } from "@/shared/ui/Hint";
import { PageHeader } from "@/shared/ui/PageHeader";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/Table";
import { PaySchemeFormModal } from "@/widgets/pay-scheme/PaySchemeFormModal";

/**
 * CRUD схем оплаты по положению: создать / изменить / удалить черновик,
 * утвердить / снять / архивировать.
 */
export function PaySchemesPage() {
  const { state, role, dispatch, currentPerson } = useStore();
  const canAccess = role.id === "tariff_methodologist" || role.id === "direction_manager";
  const canEdit = canAccess;
  const canApprove = role.id === "direction_manager";
  const schemes = useMemo(() => selectPaySchemes(state), [state]);
  const [filter, setFilter] = useState<PaySchemeStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PayScheme | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visible = useMemo(() => {
    const list = filter === "all" ? schemes : schemes.filter((s) => s.status === filter);
    return [...list].sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [schemes, filter]);

  const drafts = schemes.filter((s) => s.status === "draft");

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(scheme: PayScheme) {
    setEditing(scheme);
    setFormOpen(true);
  }

  if (!canAccess) {
    return (
      <>
        <PageHeader title="Схемы оплаты" />
        <AccessDenied allowed={["tariff_methodologist", "direction_manager"]} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Схемы оплаты по положению"
        description="Настраиваемые схемы сделки: создайте черновик, задайте компоненты, утвердите. Правка действующей схемы снова требует утверждения."
        meta={
          <>
            <Badge tone="info">{schemes.length} схем</Badge>
            <Badge tone="neutral">{drafts.length} черновиков</Badge>
          </>
        }
        actions={
          canEdit ? (
            <Button onClick={openCreate}>
              <Plus size={14} />
              Создать схему
            </Button>
          ) : null
        }
      />

      <Hint tone="info" className="mb-3">
        CRUD: создать и изменить может методолог и управляющий; утверждает только управляющий.
        Удалить можно только черновик; действующую схему — в архив.
      </Hint>

      {drafts.length > 0 && canApprove ? (
        <Panel className="mb-3">
          <PanelHeader title="На утверждение" />
          <PanelBody className="space-y-2">
            {drafts.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-line px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-ink-900">{s.name}</p>
                  <p className="text-2xs text-ink-500">
                    {s.regulationRef} · {PAY_SITE_LABEL[s.siteKey]} · {s.components.length} комп.
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="xs" variant="outline" onClick={() => openEdit(s)}>
                    Изменить
                  </Button>
                  <Button
                    size="xs"
                    onClick={() =>
                      dispatch({
                        type: "payScheme/approve",
                        schemeId: s.id,
                        approverPersonId: currentPerson.id,
                      })
                    }
                  >
                    Утвердить
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => dispatch({ type: "payScheme/delete", schemeId: s.id })}
                  >
                    Удалить
                  </Button>
                </div>
              </div>
            ))}
          </PanelBody>
        </Panel>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-1">
        {(
          [
            ["all", "Все"],
            ["active", "Действующие"],
            ["draft", "Черновики"],
            ["archived", "Архив"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="xs"
            variant={filter === id ? "primary" : "outline"}
            onClick={() => setFilter(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      <Panel>
        <PanelHeader title="Реестр схем" />
        <PanelBody className="p-0">
          {visible.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Нет схем"
                description="Создайте первую схему кнопкой «Создать схему»."
              />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Название</TH>
                  <TH>Площадка</TH>
                  <TH>Подразделение</TH>
                  <TH>Должность</TH>
                  <TH>Компонентов</TH>
                  <TH>Статус</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {visible.map((s) => (
                  <SchemeRow
                    key={s.id}
                    scheme={s}
                    divisionName={getDivisionName(s.divisionId, state.divisions)}
                    canEdit={canEdit}
                    canApprove={canApprove}
                    expanded={expandedId === s.id}
                    onToggle={() => setExpandedId((id) => (id === s.id ? null : s.id))}
                    onEdit={() => openEdit(s)}
                    onApprove={() =>
                      dispatch({
                        type: "payScheme/approve",
                        schemeId: s.id,
                        approverPersonId: currentPerson.id,
                      })
                    }
                    onDelete={() => {
                      if (window.confirm(`Удалить черновик «${s.name}»?`)) {
                        dispatch({ type: "payScheme/delete", schemeId: s.id });
                      }
                    }}
                    onArchive={() => dispatch({ type: "payScheme/archive", schemeId: s.id })}
                    onUnapprove={() => dispatch({ type: "payScheme/unapprove", schemeId: s.id })}
                    onRestore={() => dispatch({ type: "payScheme/restore", schemeId: s.id })}
                  />
                ))}
              </TBody>
            </Table>
          )}
        </PanelBody>
      </Panel>

      {expandedId ? (
        <div className="mt-3">
          {(() => {
            const s = schemes.find((x) => x.id === expandedId);
            if (!s) return null;
            return (
              <Panel>
                <PanelHeader
                  title={s.name}
                  help={`${s.regulationRef} · ${PAY_SITE_LABEL[s.siteKey]}`}
                  actions={
                    canEdit && s.status !== "archived" ? (
                      <Button size="xs" variant="outline" onClick={() => openEdit(s)}>
                        Изменить
                      </Button>
                    ) : null
                  }
                />
                <PanelBody className="p-0">
                  <Table>
                    <THead>
                      <TR>
                        <TH>Код</TH>
                        <TH>Компонент</TH>
                        <TH>Тип</TH>
                        <TH>Параметры</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {s.components.map((c) => (
                        <TR key={c.id}>
                          <TD className="tabular text-2xs text-ink-500">{c.code}</TD>
                          <TD className="font-medium">{c.title}</TD>
                          <TD>
                            <Badge tone="neutral">{PAY_COMPONENT_KIND_LABEL[c.kind]}</Badge>
                          </TD>
                          <TD className="text-2xs text-ink-600">{describeComponent(c)}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </PanelBody>
              </Panel>
            );
          })()}
        </div>
      ) : null}

      <p className="mt-3 text-2xs text-ink-500">
        Демо:{" "}
        <Link to="/payout/per-petrova" className="text-accent underline">
          расчёт Петровой
        </Link>
        ,{" "}
        <Link to="/payout/per-ivanov" className="text-accent underline">
          Иванова
        </Link>
        .
      </p>

      <PaySchemeFormModal
        open={formOpen}
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
      />
    </>
  );
}

function describeComponent(c: PayScheme["components"][number]): string {
  if (c.kind === "flat") return `${c.rate} ₽ / ${c.unit}`;
  if (c.kind === "bracket") return `${c.steps.length} ступеней шкалы`;
  if (c.kind === "percentOfBase")
    return `% от [${c.baseComponentCodes.join(", ")}], ${c.steps.length} правил`;
  return `${c.steps.length} диапазонов · ${c.metricKey}`;
}

function SchemeRow({
  scheme,
  divisionName,
  canEdit,
  canApprove,
  expanded,
  onToggle,
  onEdit,
  onApprove,
  onDelete,
  onArchive,
  onUnapprove,
  onRestore,
}: {
  scheme: PayScheme;
  divisionName: string;
  canEdit: boolean;
  canApprove: boolean;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onApprove: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onUnapprove: () => void;
  onRestore: () => void;
}) {
  return (
    <TR>
      <TD>
        <button type="button" onClick={onToggle} className="text-left hover:underline">
          <p className="font-medium text-ink-900">{scheme.name}</p>
          <p className="text-2xs text-ink-500">
            {scheme.regulationRef}
            {expanded ? " · свернуть" : " · состав"}
          </p>
        </button>
      </TD>
      <TD className="text-xs">{PAY_SITE_LABEL[scheme.siteKey]}</TD>
      <TD className="text-xs">{divisionName}</TD>
      <TD className="text-xs">{scheme.jobTitle ?? "любая"}</TD>
      <TD className="tabular">{scheme.components.length}</TD>
      <TD>
        <StatusBadge status={scheme.status} label={PAY_SCHEME_STATUS_LABEL[scheme.status]} />
      </TD>
      <TD className="text-right">
        <div className="flex flex-wrap justify-end gap-1">
          {canEdit && scheme.status !== "archived" ? (
            <Button size="xs" variant="outline" onClick={onEdit}>
              Изменить
            </Button>
          ) : null}
          {scheme.status === "draft" && canApprove ? (
            <Button size="xs" onClick={onApprove}>
              Утвердить
            </Button>
          ) : null}
          {scheme.status === "draft" && canEdit ? (
            <Button size="xs" variant="ghost" onClick={onDelete}>
              Удалить
            </Button>
          ) : null}
          {scheme.status === "active" && canApprove ? (
            <>
              <Button size="xs" variant="outline" onClick={onArchive}>
                В архив
              </Button>
              <Button size="xs" variant="ghost" onClick={onUnapprove}>
                Снять
              </Button>
            </>
          ) : null}
          {scheme.status === "archived" && canApprove ? (
            <Button size="xs" variant="outline" onClick={onRestore}>
              Из архива
            </Button>
          ) : null}
        </div>
      </TD>
    </TR>
  );
}
