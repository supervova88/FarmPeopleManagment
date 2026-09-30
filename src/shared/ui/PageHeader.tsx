import type { ReactNode } from "react";
import { HelpTip } from "./HelpTip";

export function PageHeader({
  title,
  description,
  help,
  actions,
  meta,
}: {
  title: string;
  /** Устаревший длинный текст — предпочтительно help (?). */
  description?: ReactNode;
  /** Пояснение в иконке «?» рядом с заголовком */
  help?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-6 border-b border-line pb-3">
      <div className="min-w-0">
        <h1 className="inline-flex items-center gap-1.5 text-base font-semibold text-ink-950">
          {title}
          {help ? <HelpTip side="right">{help}</HelpTip> : null}
        </h1>
        {!help && description ? (
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-600">{description}</p>
        ) : null}
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
