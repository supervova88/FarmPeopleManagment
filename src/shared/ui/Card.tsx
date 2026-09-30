import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { HelpTip } from "./HelpTip";

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded border border-line bg-white shadow-panel", className)}>
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  subtitle,
  help,
  actions,
  icon,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  help?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex items-start justify-between gap-4 border-b border-line px-3 py-2",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        {icon ? <span className="mt-[2px] text-ink-500">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="inline-flex items-center gap-1 truncate text-[13px] font-semibold text-ink-900">
            {title}
            {help ? <HelpTip side="right">{help}</HelpTip> : null}
          </h2>
          {!help && subtitle ? <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </header>
  );
}

export function PanelBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-3 py-2.5", className)}>{children}</div>;
}
