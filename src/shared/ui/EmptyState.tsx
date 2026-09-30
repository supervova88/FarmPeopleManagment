import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  tone = "neutral",
  icon,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "warning";
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded border border-dashed px-4 py-5",
        tone === "warning" ? "border-pending-line bg-pending-soft" : "border-line bg-canvas",
      )}
    >
      <div className="flex items-start gap-2">
        {icon ? (
          <span className={tone === "warning" ? "mt-[1px] text-pending" : "mt-[1px] text-ink-400"}>
            {icon}
          </span>
        ) : null}
        <div>
          <p
            className={cn(
              "text-xs font-semibold",
              tone === "warning" ? "text-pending" : "text-ink-800",
            )}
          >
            {title}
          </p>
          {description ? (
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-600">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="pl-6">{action}</div> : null}
    </div>
  );
}
