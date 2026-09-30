import { Badge, type Tone } from "./Badge";

/**
 * Единая цветовая семантика модуля:
 *  зелёный  — оплачено / тариф задан / подтверждено;
 *  янтарный — тариф не задан / требует внимания / на проверке;
 *  красный  — отклонено / ошибка / спор;
 *  синий    — нейтральные состояния и ссылки.
 */
const MAP: Record<string, { label: string; tone: Tone }> = {
  // СОП
  draft: { label: "Черновик", tone: "neutral" },
  in_review: { label: "На согласовании", tone: "warning" },
  active: { label: "Действует", tone: "success" },
  archived: { label: "Архив", tone: "muted" },

  // Уровни СОП
  L1_division: { label: "L1", tone: "neutral" },
  L2_process: { label: "L2", tone: "info" },
  L3_operation: { label: "L3", tone: "success" },

  // Производственный факт
  done: { label: "Выполнено", tone: "success" },
  done_with_deviations: { label: "Выполнено с отклонениями", tone: "warning" },
  partially_done: { label: "Частично выполнено", tone: "danger" },
  not_done: { label: "Не выполнено", tone: "danger" },

  // Табельная позиция
  auto_generated: { label: "Сформировано автоматически", tone: "info" },
  confirmed: { label: "Подтверждено", tone: "success" },
  rejected: { label: "Отклонено", tone: "danger" },
  manually_adjusted: { label: "Скорректировано вручную", tone: "warning" },
  tariff_missing: { label: "Тариф не задан", tone: "warning" },

  // Табельная запись
  approved: { label: "Утверждено", tone: "success" },

  // Период
  open: { label: "Открыт", tone: "neutral" },
  period_in_review: { label: "На проверке", tone: "warning" },
  closed: { label: "Закрыт", tone: "muted" },

  // Начисления
  accrued: { label: "Начислено", tone: "success" },
  disputed: { label: "Оспорено", tone: "danger" },
  cancelled: { label: "Отменено", tone: "muted" },

  // Персонал
  working: { label: "Работает", tone: "success" },
  vacation: { label: "Отпуск", tone: "info" },
  sick_leave: { label: "Больничный", tone: "warning" },
  dismissed: { label: "Уволен", tone: "muted" },

  // План работ
  planned: { label: "В плане", tone: "info" },
  in_progress: { label: "В работе", tone: "warning" },
  completed: { label: "Выполнено", tone: "success" },
  skipped: { label: "Не выполнено", tone: "danger" },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const item = MAP[status] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={item.tone}>{label ?? item.label}</Badge>;
}
