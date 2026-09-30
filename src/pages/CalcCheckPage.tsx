import { Check, X } from "lucide-react";
import { useMemo } from "react";
import { getCalcCases } from "@/features/payroll/calcDemo";
import { Badge } from "@/shared/ui/Badge";
import { Panel, PanelBody, PanelHeader } from "@/shared/ui/Card";
import { Hint } from "@/shared/ui/Hint";
import { Metric } from "@/shared/ui/Metric";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Table, TBody, TD, TH, THead, TR } from "@/shared/ui/Table";

/**
 * Служебная страница: прогон расчётных функций на эталонных примерах.
 * Те же проверки печатаются в консоль браузера при старте приложения.
 */
export function CalcCheckPage() {
  const cases = useMemo(() => getCalcCases(), []);
  const passed = cases.filter((c) => c.passed).length;
  const allPassed = passed === cases.length;

  return (
    <>
      <PageHeader
        title="Проверка расчёта"
        description="Прогон чистых функций расчёта на эталонных примерах: применение тарифа по дате, формирование табельной позиции из факта, коэффициенты периода и итог к выплате."
        meta={
          <>
            <Badge tone={allPassed ? "success" : "danger"}>
              {passed} из {cases.length} проверок пройдено
            </Badge>
            <Badge tone="neutral">Те же результаты выводятся в консоль при старте</Badge>
          </>
        }
      />

      <div className="space-y-3">
        <Hint tone="info">
          Вся расчётная логика вынесена в чистые функции без побочных эффектов:{" "}
          <code className="rounded bg-white px-1">features/payroll/applyTariff.ts</code>,{" "}
          <code className="rounded bg-white px-1">buildTimesheet.ts</code>,{" "}
          <code className="rounded bg-white px-1">applyPayScheme.ts</code>,{" "}
          <code className="rounded bg-white px-1">calcCoefficients.ts</code>,{" "}
          <code className="rounded bg-white px-1">calcFinalPayout.ts</code>. Экраны только читают их
          результат и ничего не вычисляют в JSX.
        </Hint>

        <div className="grid grid-cols-3 gap-2">
          <Metric label="Всего проверок" value={cases.length} />
          <Metric label="Пройдено" value={passed} tone={allPassed ? "success" : "neutral"} />
          <Metric
            label="Не сошлось"
            value={cases.length - passed}
            tone={allPassed ? "neutral" : "danger"}
          />
        </div>

        <Panel>
          <PanelHeader title="Эталонные примеры" />
          <PanelBody className="px-0 py-0">
            <Table>
              <THead>
                <TR>
                  <TH className="w-10" align="center">
                    ✓
                  </TH>
                  <TH className="w-72">Проверка</TH>
                  <TH>Вход</TH>
                  <TH className="w-56">Ожидание</TH>
                  <TH className="w-56">Факт</TH>
                </TR>
              </THead>
              <TBody>
                {cases.map((c) => (
                  <TR key={c.id} className={c.passed ? undefined : "bg-reject-soft"}>
                    <TD align="center">
                      {c.passed ? (
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-paid text-white">
                          <Check size={10} />
                        </span>
                      ) : (
                        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-reject text-white">
                          <X size={10} />
                        </span>
                      )}
                    </TD>
                    <TD>
                      <p className="font-medium text-ink-900">{c.title}</p>
                      <p className="mt-0.5 text-2xs leading-snug text-ink-500">{c.rule}</p>
                    </TD>
                    <TD className="text-ink-600">{c.input}</TD>
                    <TD className="tabular text-ink-700">{c.expected}</TD>
                    <TD className={c.passed ? "tabular text-paid" : "tabular font-semibold text-reject"}>
                      {c.actual}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}
