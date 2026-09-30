import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/app/store/StoreProvider";
import {
  getDescendantIds,
  hasSopChildren,
  suggestNextSopCode,
} from "@/entities/sop/helpers";
import {
  SOP_LEVEL_LABEL,
  SOP_OPERATION_OBJECT_LABEL,
  type Sop,
  type SopLevel,
  type SopOperationObject,
} from "@/entities/sop/model";
import { uid } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Field, Select, Textarea, TextInput } from "@/shared/ui/Field";
import { Hint } from "@/shared/ui/Hint";
import { Modal } from "@/shared/ui/Modal";

const LEVELS: SopLevel[] = ["L1_division", "L2_process", "L3_operation"];
const OBJECTS = Object.keys(SOP_OPERATION_OBJECT_LABEL) as SopOperationObject[];

function defaultLevel(presetParent: Sop | null): SopLevel {
  if (!presetParent) return "L1_division";
  if (presetParent.level === "L1_division") return "L2_process";
  if (presetParent.level === "L2_process") return "L3_operation";
  return "L3_operation";
}

function defaultParentId(level: SopLevel, presetParent: Sop | null, sops: Sop[]): string | null {
  if (level === "L1_division") return null;
  if (presetParent) {
    if (level === "L2_process" && presetParent.level === "L1_division") return presetParent.id;
    if (level === "L3_operation" && presetParent.level === "L2_process") return presetParent.id;
    if (level === "L3_operation" && presetParent.level === "L1_division") {
      return sops.find((s) => s.level === "L2_process" && s.parentId === presetParent.id)?.id ?? null;
    }
    if (level === "L2_process" && presetParent.level === "L2_process") return presetParent.parentId;
    if (level === "L3_operation" && presetParent.level === "L3_operation") return presetParent.parentId;
  }
  if (level === "L2_process") {
    return sops.find((s) => s.level === "L1_division" && s.status === "active")?.id ?? null;
  }
  return sops.find((s) => s.level === "L2_process" && s.status === "active")?.id ?? null;
}

/**
 * Создание и редактирование СОП.
 * При создании код подставляется автоматически; при правке можно сменить уровень,
 * если у узла нет дочерних СОП.
 */
export function SopFormModal({
  open,
  onClose,
  onSaved,
  presetParent,
  editingSop,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (sopId: string) => void;
  presetParent: Sop | null;
  editingSop?: Sop | null;
}) {
  const { state, dispatch, currentPerson } = useStore();
  const sops = state.sops;
  const isEdit = Boolean(editingSop);
  const hasChildren = editingSop ? hasSopChildren(sops, editingSop.id) : false;
  const canChangeLevel = !isEdit || !hasChildren;

  const [level, setLevel] = useState<SopLevel>(() => defaultLevel(presetParent));
  const [parentId, setParentId] = useState<string>(() => defaultParentId(level, presetParent, sops) ?? "");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0");
  const [effectiveFrom, setEffectiveFrom] = useState("2026-08-01");
  const [methodSummary, setMethodSummary] = useState("");
  const [operationObject, setOperationObject] = useState<SopOperationObject>("animal");
  const [isTariffable, setIsTariffable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function applySuggestedCode(nextLevel: SopLevel, nextParentId: string | null) {
    setCode(suggestNextSopCode(sops, nextLevel, nextParentId));
    setCodeTouched(false);
  }

  useEffect(() => {
    if (!open) return;
    if (editingSop) {
      setLevel(editingSop.level);
      setParentId(editingSop.parentId ?? "");
      setCode(editingSop.code);
      setCodeTouched(true);
      setName(editingSop.name);
      setVersion(editingSop.version);
      setEffectiveFrom(editingSop.effectiveFrom);
      setMethodSummary(editingSop.methodSummary);
      setOperationObject(editingSop.operationObject ?? "animal");
      setIsTariffable(editingSop.isTariffable ?? true);
      setError(null);
      return;
    }
    const nextLevel = defaultLevel(presetParent);
    const nextParent = defaultParentId(nextLevel, presetParent, sops);
    setLevel(nextLevel);
    setParentId(nextParent ?? "");
    setCode(suggestNextSopCode(sops, nextLevel, nextParent));
    setCodeTouched(false);
    setName("");
    setVersion("1.0");
    setEffectiveFrom("2026-08-01");
    setMethodSummary("");
    setOperationObject("animal");
    setIsTariffable(true);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetParent?.id, editingSop?.id]);

  const blockedParentIds = useMemo(() => {
    if (!editingSop) return new Set<string>();
    return new Set([editingSop.id, ...getDescendantIds(sops, editingSop.id)]);
  }, [editingSop, sops]);

  const parentOptions = useMemo(() => {
    const base =
      level === "L2_process"
        ? sops.filter((s) => s.level === "L1_division")
        : level === "L3_operation"
          ? sops.filter((s) => s.level === "L2_process")
          : [];
    return base.filter(
      (s) => s.status === "active" && !blockedParentIds.has(s.id),
    );
  }, [level, sops, blockedParentIds]);

  function onLevelChange(next: SopLevel) {
    if (!canChangeLevel) return;
    const nextParent =
      next === "L1_division"
        ? null
        : defaultParentId(next, editingSop ?? presetParent, sops);
    // Если предложенный родитель недоступен — взять первого из списка
    let resolved = nextParent;
    if (next !== "L1_division") {
      const allowed = sops.filter(
        (s) =>
          s.status === "active" &&
          !blockedParentIds.has(s.id) &&
          ((next === "L2_process" && s.level === "L1_division") ||
            (next === "L3_operation" && s.level === "L2_process")),
      );
      if (!resolved || !allowed.some((s) => s.id === resolved)) {
        resolved = allowed[0]?.id ?? null;
      }
    }
    setLevel(next);
    setParentId(resolved ?? "");
    if (!codeTouched || isEdit) {
      // При смене уровня в правке предлагаем новый код, но не затираем, если уже трогали вручную в этой сессии после смены
      if (!codeTouched) {
        setCode(suggestNextSopCode(sops, next, resolved));
      }
    }
  }

  function onParentChange(nextParentId: string) {
    setParentId(nextParentId);
    if (!codeTouched) {
      setCode(suggestNextSopCode(sops, level, nextParentId || null));
    }
  }

  function submit() {
    const trimmedCode = code.trim();
    const trimmedName = name.trim();
    if (!trimmedCode) return setError("Укажите код СОП");
    if (!trimmedName) return setError("Укажите название");
    if (!effectiveFrom) return setError("Укажите дату вступления в силу");
    if (sops.some((s) => s.code === trimmedCode && s.id !== editingSop?.id)) {
      return setError("СОП с таким кодом уже есть");
    }
    if (editingSop && level !== editingSop.level && hasChildren) {
      return setError("Нельзя сменить уровень: у СОП есть дочерние узлы");
    }

    let resolvedParent: string | null = null;
    if (level !== "L1_division") {
      if (!parentId) return setError("Выберите родительский СОП");
      const parent = sops.find((s) => s.id === parentId);
      if (!parent) return setError("Родительский СОП не найден");
      if (parent.status === "archived") return setError("Родительский СОП в архиве");
      if (level === "L2_process" && parent.level !== "L1_division") {
        return setError("Для L2 родитель должен быть уровня L1");
      }
      if (level === "L3_operation" && parent.level !== "L2_process") {
        return setError("Для L3 родитель должен быть уровня L2");
      }
      if (blockedParentIds.has(parent.id)) {
        return setError("Нельзя выбрать себя или своего потомка как родителя");
      }
      resolvedParent = parent.id;
    }

    if (editingSop) {
      dispatch({
        type: "sop/update",
        payload: {
          id: editingSop.id,
          code: trimmedCode,
          name: trimmedName,
          level,
          parentId: resolvedParent,
          version: version.trim() || editingSop.version,
          ownerPersonId: currentPerson.id,
          effectiveFrom,
          methodSummary: methodSummary.trim(),
          ...(level === "L3_operation" ? { operationObject, isTariffable } : {}),
        },
      });
      onSaved(editingSop.id);
      onClose();
      return;
    }

    const id = uid("sop");
    dispatch({
      type: "sop/create",
      payload: {
        id,
        code: trimmedCode,
        name: trimmedName,
        level,
        parentId: resolvedParent,
        version: version.trim() || "1.0",
        ownerPersonId: currentPerson.id,
        effectiveFrom,
        methodSummary: methodSummary.trim(),
        ...(level === "L3_operation" ? { operationObject, isTariffable } : {}),
      },
    });
    onSaved(id);
    onClose();
  }

  return (
    <Modal
      open={open}
      title={isEdit ? "Редактировать СОП" : "Добавить СОП"}
      subtitle={
        isEdit
          ? "Можно сменить уровень (без дочерних узлов) и родителя. Изменения сразу в реестре."
          : "В прототипе СОП сразу получает статус «Действует» — без отдельного утверждения"
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit}>{isEdit ? "Сохранить" : "Создать СОП"}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field
          label="Уровень"
          required
          hint={
            isEdit && hasChildren
              ? "Смена уровня недоступна, пока есть дочерние СОП"
              : isEdit
                ? "Можно перенести на другой уровень и выбрать нового родителя"
                : undefined
          }
        >
          <Select
            value={level}
            disabled={!canChangeLevel}
            onChange={(e) => onLevelChange(e.target.value as SopLevel)}
          >
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {SOP_LEVEL_LABEL[l]}
              </option>
            ))}
          </Select>
        </Field>

        {level !== "L1_division" ? (
          <Field label="Родительский СОП" required>
            <Select value={parentId} onChange={(e) => onParentChange(e.target.value)}>
              <option value="">— выберите —</option>
              {parentOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Код"
            required
            hint={
              codeTouched
                ? "Код изменён вручную"
                : "Сформирован автоматически — можно скорректировать"
            }
          >
            <div className="flex gap-1.5">
              <TextInput
                className="min-w-0 flex-1"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setCodeTouched(true);
                }}
                placeholder={level === "L3_operation" ? "СОП-01.02.05" : "СОП-03"}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                title="Сформировать код заново"
                onClick={() => applySuggestedCode(level, parentId || null)}
              >
                Авто
              </Button>
            </div>
          </Field>
          <Field label="Версия">
            <TextInput value={version} onChange={(e) => setVersion(e.target.value)} />
          </Field>
        </div>

        <Field label="Название" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Краткое наименование" />
        </Field>

        <Field label="Дата вступления в силу" required>
          <TextInput type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
        </Field>

        <Field label="Методическое описание">
          <Textarea
            value={methodSummary}
            onChange={(e) => setMethodSummary(e.target.value)}
            placeholder="Кратко: что регулирует этот СОП"
          />
        </Field>

        {level === "L3_operation" ? (
          <>
            <Field label="Объект операции" required>
              <Select
                value={operationObject}
                onChange={(e) => setOperationObject(e.target.value as SopOperationObject)}
              >
                {OBJECTS.map((o) => (
                  <option key={o} value={o}>
                    {SOP_OPERATION_OBJECT_LABEL[o]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Тарифицируемость">
              <Select
                value={isTariffable ? "yes" : "no"}
                onChange={(e) => setIsTariffable(e.target.value === "yes")}
              >
                <option value="yes">Тарифицируется</option>
                <option value="no">Не тарифицируется</option>
              </Select>
              <Hint tone="info" className="mt-2">
                Единица нормирования фиксирована: один факт выполнения = одна оплачиваемая операция.
              </Hint>
            </Field>
          </>
        ) : null}

        {error ? <p className="text-xs text-reject">{error}</p> : null}
      </div>
    </Modal>
  );
}
