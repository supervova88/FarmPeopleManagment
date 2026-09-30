import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/app/store/StoreProvider";
import {
  PAY_COMPONENT_KIND_LABEL,
  PAY_QUANTITY_UNIT_LABEL,
  PAY_SITE_LABEL,
  type BracketComponent,
  type FlatComponent,
  type PayComponent,
  type PayComponentKind,
  type PayQuantityUnit,
  type PayScheme,
  type PaySiteKey,
} from "@/entities/payScheme/model";
import { uid } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/Button";
import { Field, NumberInput, Select, TextInput } from "@/shared/ui/Field";
import { Hint } from "@/shared/ui/Hint";
import { Modal } from "@/shared/ui/Modal";

type FlatSource =
  | "animal_transfer_bull"
  | "animal_transfer_heifer"
  | "weight_gain"
  | "work_shift"
  | "checklist"
  | "period_flat";

type BracketSource = "heifer_weight" | "insem_sync_sexed" | "insem_sync_trad" | "insem_heat_trad";

type CompDraft = {
  key: string;
  kind: PayComponentKind;
  code: string;
  title: string;
  // flat
  rate: string;
  unit: PayQuantityUnit;
  flatSource: FlatSource;
  checklistKey: string;
  periodMetricKey: string;
  // bracket / band
  stepsText: string;
  bracketSource: BracketSource;
  // percent
  baseCodes: string;
  percentStepsText: string;
  // band
  metricKey: string;
};

const SITE_KEYS = Object.keys(PAY_SITE_LABEL) as PaySiteKey[];
const UNITS = Object.keys(PAY_QUANTITY_UNIT_LABEL) as PayQuantityUnit[];
const KINDS = Object.keys(PAY_COMPONENT_KIND_LABEL) as PayComponentKind[];

function emptyComp(kind: PayComponentKind = "flat"): CompDraft {
  return {
    key: uid("cmp"),
    kind,
    code: "",
    title: "",
    rate: "100",
    unit: "head",
    flatSource: "animal_transfer_bull",
    checklistKey: "bedding",
    periodMetricKey: "milk_cans_ok",
    stepsText: "null,95,300\n96,101,500\n102,null,750",
    bracketSource: "heifer_weight",
    baseCodes: "",
    percentStepsText: "survival_0_6_pct,100,100,0.5,true\nauditor_grade,5,5,0.5,true",
    metricKey: "hdr_pct",
  };
}

function parseBound(raw: string): number | null {
  const t = raw.trim().toLowerCase();
  if (t === "" || t === "null" || t === "∞" || t === "-") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseBracketSteps(text: string): { min: number | null; max: number | null; rate: number }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [a, b, c] = line.split(/[;,|\t]/).map((x) => x.trim());
      return { min: parseBound(a ?? ""), max: parseBound(b ?? ""), rate: Number((c ?? "0").replace(",", ".")) };
    })
    .filter((s) => Number.isFinite(s.rate));
}

function parseBandSteps(text: string): { min: number | null; max: number | null; amount: number }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [a, b, c] = line.split(/[;,|\t]/).map((x) => x.trim());
      return {
        min: parseBound(a ?? ""),
        max: parseBound(b ?? ""),
        amount: Number((c ?? "0").replace(",", ".")),
      };
    })
    .filter((s) => Number.isFinite(s.amount));
}

function parsePercentSteps(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[;,|\t]/).map((x) => x.trim());
      return {
        metricKey: parts[0] || "metric",
        min: parseBound(parts[1] ?? ""),
        max: parseBound(parts[2] ?? ""),
        percentOfBase: Number((parts[3] ?? "0").replace(",", ".")),
        skipIfMissing: (parts[4] ?? "true").toLowerCase() !== "false",
      };
    })
    .filter((s) => s.metricKey && Number.isFinite(s.percentOfBase));
}

function formatBracketSteps(steps: { min: number | null; max: number | null; rate: number }[]): string {
  return steps.map((s) => `${s.min ?? "null"},${s.max ?? "null"},${s.rate}`).join("\n");
}

function formatBandSteps(steps: { min: number | null; max: number | null; amount: number }[]): string {
  return steps.map((s) => `${s.min ?? "null"},${s.max ?? "null"},${s.amount}`).join("\n");
}

function formatPercentSteps(
  steps: {
    metricKey: string;
    min: number | null;
    max: number | null;
    percentOfBase: number;
    skipIfMissing: boolean;
  }[],
): string {
  return steps
    .map(
      (s) =>
        `${s.metricKey},${s.min ?? "null"},${s.max ?? "null"},${s.percentOfBase},${s.skipIfMissing}`,
    )
    .join("\n");
}

function flatSourceOf(c: FlatComponent): FlatSource {
  const i = c.input;
  if (i.source === "animal_transfer") {
    return i.animalType === "bull" ? "animal_transfer_bull" : "animal_transfer_heifer";
  }
  if (i.source === "weight_gain") return "weight_gain";
  if (i.source === "work_shift") return "work_shift";
  if (i.source === "checklist") return "checklist";
  return "period_flat";
}

function bracketSourceOf(c: BracketComponent): BracketSource {
  const i = c.input;
  if (i.source === "animal_transfer") return "heifer_weight";
  if (i.mode === "sync" && i.semenType === "sexed") return "insem_sync_sexed";
  if (i.mode === "sync") return "insem_sync_trad";
  return "insem_heat_trad";
}

function componentToDraft(c: PayComponent): CompDraft {
  const base = emptyComp(c.kind);
  base.key = c.id;
  base.code = c.code;
  base.title = c.title;
  if (c.kind === "flat") {
    base.rate = String(c.rate);
    base.unit = c.unit;
    base.flatSource = flatSourceOf(c);
    if (c.input.source === "checklist") base.checklistKey = c.input.itemKey;
    if (c.input.source === "period_flat") base.periodMetricKey = c.input.metricKey;
  } else if (c.kind === "bracket") {
    base.unit = c.unit;
    base.bracketSource = bracketSourceOf(c);
    base.stepsText = formatBracketSteps(c.steps);
  } else if (c.kind === "percentOfBase") {
    base.baseCodes = c.baseComponentCodes.join(", ");
    base.percentStepsText = formatPercentSteps(c.steps);
  } else {
    base.metricKey = c.metricKey;
    base.stepsText = formatBandSteps(c.steps);
  }
  return base;
}

function buildFlatInput(d: CompDraft): FlatComponent["input"] {
  switch (d.flatSource) {
    case "animal_transfer_bull":
      return { source: "animal_transfer", animalType: "bull" };
    case "animal_transfer_heifer":
      return { source: "animal_transfer", animalType: "heifer" };
    case "weight_gain":
      return { source: "weight_gain" };
    case "work_shift":
      return { source: "work_shift" };
    case "checklist":
      return { source: "checklist", itemKey: d.checklistKey.trim() || "item" };
    case "period_flat":
      return { source: "period_flat", metricKey: d.periodMetricKey.trim() || "metric" };
  }
}

function buildBracketInput(d: CompDraft): BracketComponent["input"] {
  switch (d.bracketSource) {
    case "heifer_weight":
      return { source: "animal_transfer", animalType: "heifer", measure: "weightKg" };
    case "insem_sync_sexed":
      return { source: "insemination", mode: "sync", semenType: "sexed", measure: "attemptNumber" };
    case "insem_sync_trad":
      return {
        source: "insemination",
        mode: "sync",
        semenType: "traditional",
        measure: "attemptNumber",
      };
    case "insem_heat_trad":
      return {
        source: "insemination",
        mode: "heat",
        semenType: "traditional",
        measure: "attemptNumber",
      };
  }
}

function draftToComponent(d: CompDraft): PayComponent | null {
  const code = d.code.trim();
  const title = d.title.trim();
  if (!code || !title) return null;
  const id = d.key.startsWith("cmp-") ? uid("psc") : d.key;

  if (d.kind === "flat") {
    const rate = Number(d.rate.replace(",", "."));
    if (!Number.isFinite(rate) || rate < 0) return null;
    return {
      kind: "flat",
      id,
      code,
      title,
      rate,
      unit: d.unit,
      input: buildFlatInput(d),
    };
  }
  if (d.kind === "bracket") {
    const steps = parseBracketSteps(d.stepsText);
    if (steps.length === 0) return null;
    return {
      kind: "bracket",
      id,
      code,
      title,
      unit: d.unit,
      input: buildBracketInput(d),
      steps,
    };
  }
  if (d.kind === "percentOfBase") {
    const baseComponentCodes = d.baseCodes
      .split(/[,;\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    const steps = parsePercentSteps(d.percentStepsText);
    if (baseComponentCodes.length === 0 || steps.length === 0) return null;
    return {
      kind: "percentOfBase",
      id,
      code,
      title,
      baseComponentCodes,
      steps,
    };
  }
  const steps = parseBandSteps(d.stepsText);
  if (steps.length === 0 || !d.metricKey.trim()) return null;
  return {
    kind: "bandFixed",
    id,
    code,
    title,
    metricKey: d.metricKey.trim(),
    steps,
  };
}

/**
 * Создание и редактирование схемы оплаты (черновик).
 * Правка действующей схемы снова переводит её в черновик.
 */
export function PaySchemeFormModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: PayScheme | null;
}) {
  const { state, dispatch } = useStore();
  const divisions = state.divisions.filter((d) => d.status === "active");

  const [name, setName] = useState("");
  const [regulationRef, setRegulationRef] = useState("");
  const [divisionId, setDivisionId] = useState(divisions[0]?.id ?? "");
  const [siteKey, setSiteKey] = useState<PaySiteKey>("calf_barn_1");
  const [jobTitle, setJobTitle] = useState("");
  const [components, setComponents] = useState<CompDraft[]>(() => [emptyComp()]);
  const [error, setError] = useState<string | null>(null);

  const jobTitles = useMemo(
    () =>
      Array.from(
        new Set(
          state.persons.filter((p) => p.divisionId === divisionId).map((p) => p.jobTitle),
        ),
      ).sort((a, b) => a.localeCompare(b, "ru")),
    [state.persons, divisionId],
  );

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setRegulationRef(editing.regulationRef);
      setDivisionId(editing.divisionId);
      setSiteKey(editing.siteKey);
      setJobTitle(editing.jobTitle ?? "");
      setComponents(
        editing.components.length > 0
          ? editing.components.map(componentToDraft)
          : [emptyComp()],
      );
    } else {
      setName("");
      setRegulationRef("п. ");
      setDivisionId(divisions[0]?.id ?? "");
      setSiteKey("calf_barn_1");
      setJobTitle("");
      setComponents([emptyComp()]);
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when modal opens / target changes
  }, [open, editing?.id]);

  function updateComp(key: string, patch: Partial<CompDraft>) {
    setComponents((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  function submit() {
    if (!name.trim()) return setError("Укажите название схемы");
    if (!divisionId) return setError("Выберите подразделение");
    const built: PayComponent[] = [];
    for (const d of components) {
      const c = draftToComponent(d);
      if (!c) {
        return setError(`Компонент «${d.title || d.code || d.key}»: заполните код, название и параметры`);
      }
      built.push(c);
    }
    const codes = built.map((c) => c.code);
    if (new Set(codes).size !== codes.length) {
      return setError("Коды компонентов должны быть уникальны внутри схемы");
    }

    const payload = {
      name: name.trim(),
      regulationRef: regulationRef.trim() || "—",
      divisionId,
      siteKey,
      jobTitle: jobTitle.trim() || null,
      components: built,
    };

    if (editing) {
      dispatch({ type: "payScheme/update", schemeId: editing.id, payload });
    } else {
      dispatch({ type: "payScheme/createDraft", payload });
    }
    onClose();
  }

  return (
    <Modal
      open={open}
      width="lg"
      title={editing ? "Изменить схему оплаты" : "Новая схема оплаты"}
      subtitle={
        editing?.status === "active"
          ? "После сохранения схема снова станет черновиком и потребует утверждения"
          : "Схема создаётся черновиком; в расчёт попадает только после утверждения управляющим"
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit}>{editing ? "Сохранить" : "Создать черновик"}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Название" required className="sm:col-span-2">
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Телятник №1 — индивидуальное содержание"
            />
          </Field>
          <Field label="Ссылка на положение" required>
            <TextInput
              value={regulationRef}
              onChange={(e) => setRegulationRef(e.target.value)}
              placeholder="п. 3.2.1"
            />
          </Field>
          <Field label="Площадка" required>
            <Select value={siteKey} onChange={(e) => setSiteKey(e.target.value as PaySiteKey)}>
              {SITE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {PAY_SITE_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Подразделение" required>
            <Select value={divisionId} onChange={(e) => setDivisionId(e.target.value)}>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Должность" hint="Пусто = любая должность на площадке">
            <Select value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}>
              <option value="">Любая</option>
              {jobTitles.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-semibold uppercase tracking-wide text-ink-500">
              Компоненты расчёта
            </span>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setComponents((prev) => [...prev, emptyComp()])}
            >
              <Plus size={12} />
              Компонент
            </Button>
          </div>

          <Hint tone="info">
            Шкала / фикс: строки <code className="rounded bg-white px-1">min,max,ставка</code> (
            <code className="rounded bg-white px-1">null</code> = без границы). % от базы:{" "}
            <code className="rounded bg-white px-1">метрика,min,max,доля,skip</code> (доля 0.5 =
            50%).
          </Hint>

          {components.map((c, idx) => (
            <div key={c.key} className="space-y-2 rounded border border-line bg-canvas/40 p-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-2xs font-semibold text-ink-500">#{idx + 1}</p>
                <Button
                  size="xs"
                  variant="ghost"
                  aria-label="Удалить компонент"
                  onClick={() => setComponents((prev) => prev.filter((x) => x.key !== c.key))}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Field label="Тип">
                  <Select
                    value={c.kind}
                    onChange={(e) =>
                      updateComp(c.key, { kind: e.target.value as PayComponentKind })
                    }
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {PAY_COMPONENT_KIND_LABEL[k]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Код" required>
                  <TextInput
                    value={c.code}
                    onChange={(e) => updateComp(c.key, { code: e.target.value })}
                    placeholder="bulls_sold"
                  />
                </Field>
                <Field label="Название" required>
                  <TextInput
                    value={c.title}
                    onChange={(e) => updateComp(c.key, { title: e.target.value })}
                    placeholder="Реализованные бычки"
                  />
                </Field>
              </div>

              {c.kind === "flat" ? (
                <div className="grid gap-2 sm:grid-cols-3">
                  <Field label="Источник">
                    <Select
                      value={c.flatSource}
                      onChange={(e) =>
                        updateComp(c.key, { flatSource: e.target.value as FlatSource })
                      }
                    >
                      <option value="animal_transfer_bull">Передача: бычок</option>
                      <option value="animal_transfer_heifer">Передача: тёлка</option>
                      <option value="weight_gain">Привес (ц)</option>
                      <option value="work_shift">Смена</option>
                      <option value="checklist">Чек-лист смены</option>
                      <option value="period_flat">Показатель периода</option>
                    </Select>
                  </Field>
                  <Field label="Ставка, ₽">
                    <NumberInput
                      value={c.rate}
                      min={0}
                      step={1}
                      onChange={(e) => updateComp(c.key, { rate: e.target.value })}
                    />
                  </Field>
                  <Field label="Ед.">
                    <Select
                      value={c.unit}
                      onChange={(e) =>
                        updateComp(c.key, { unit: e.target.value as PayQuantityUnit })
                      }
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {PAY_QUANTITY_UNIT_LABEL[u]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  {c.flatSource === "checklist" ? (
                    <Field label="Ключ пункта чек-листа" className="sm:col-span-3">
                      <TextInput
                        value={c.checklistKey}
                        onChange={(e) => updateComp(c.key, { checklistKey: e.target.value })}
                        placeholder="bedding / drinkers / bact_ok"
                      />
                    </Field>
                  ) : null}
                  {c.flatSource === "period_flat" ? (
                    <Field label="Ключ метрики периода" className="sm:col-span-3">
                      <TextInput
                        value={c.periodMetricKey}
                        onChange={(e) => updateComp(c.key, { periodMetricKey: e.target.value })}
                        placeholder="milk_cans_ok"
                      />
                    </Field>
                  ) : null}
                </div>
              ) : null}

              {c.kind === "bracket" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Источник шкалы">
                    <Select
                      value={c.bracketSource}
                      onChange={(e) =>
                        updateComp(c.key, { bracketSource: e.target.value as BracketSource })
                      }
                    >
                      <option value="heifer_weight">Тёлка по весу</option>
                      <option value="insem_sync_sexed">ИО синхр. сексированное</option>
                      <option value="insem_sync_trad">ИО синхр. традиционное</option>
                      <option value="insem_heat_trad">ИО по охоте традиционное</option>
                    </Select>
                  </Field>
                  <Field label="Ед.">
                    <Select
                      value={c.unit}
                      onChange={(e) =>
                        updateComp(c.key, { unit: e.target.value as PayQuantityUnit })
                      }
                    >
                      {UNITS.map((u) => (
                        <option key={u} value={u}>
                          {PAY_QUANTITY_UNIT_LABEL[u]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Ступени (min,max,ставка)" className="sm:col-span-2">
                    <textarea
                      className="min-h-[88px] w-full rounded border border-line bg-white px-2 py-1.5 font-mono text-xs text-ink-800"
                      value={c.stepsText}
                      onChange={(e) => updateComp(c.key, { stepsText: e.target.value })}
                    />
                  </Field>
                </div>
              ) : null}

              {c.kind === "percentOfBase" ? (
                <div className="grid gap-2">
                  <Field label="Коды базовых компонентов" hint="Через запятую">
                    <TextInput
                      value={c.baseCodes}
                      onChange={(e) => updateComp(c.key, { baseCodes: e.target.value })}
                      placeholder="heifers_transferred"
                    />
                  </Field>
                  <Field label="Правила % (метрика,min,max,доля,skip)">
                    <textarea
                      className="min-h-[72px] w-full rounded border border-line bg-white px-2 py-1.5 font-mono text-xs text-ink-800"
                      value={c.percentStepsText}
                      onChange={(e) => updateComp(c.key, { percentStepsText: e.target.value })}
                    />
                  </Field>
                </div>
              ) : null}

              {c.kind === "bandFixed" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Метрика">
                    <TextInput
                      value={c.metricKey}
                      onChange={(e) => updateComp(c.key, { metricKey: e.target.value })}
                      placeholder="hdr_pct"
                    />
                  </Field>
                  <Field label="Диапазоны (min,max,сумма)" className="sm:col-span-2">
                    <textarea
                      className="min-h-[72px] w-full rounded border border-line bg-white px-2 py-1.5 font-mono text-xs text-ink-800"
                      value={c.stepsText}
                      onChange={(e) => updateComp(c.key, { stepsText: e.target.value })}
                    />
                  </Field>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {error ? <p className="text-2xs text-reject">{error}</p> : null}
      </div>
    </Modal>
  );
}
