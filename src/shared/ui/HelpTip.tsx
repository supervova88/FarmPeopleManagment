import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * Иконка «?» с пояснением при наведении (CSS-тултип, не native title).
 * pointer-events: none — не перехватывает клики по соседним контролам.
 */
export function HelpTip({
  children,
  className,
  side = "bottom",
}: {
  children: ReactNode;
  className?: string;
  side?: "top" | "bottom" | "right";
}) {
  return (
    <span className={cn("relative inline-flex shrink-0 align-middle", className)}>
      <button
        type="button"
        className="peer inline-flex h-4 w-4 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-canvas hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        aria-label="Подсказка"
      >
        <CircleHelp size={13} strokeWidth={2} />
      </button>
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 w-64 rounded border border-line bg-white px-2.5 py-1.5 text-2xs leading-relaxed text-ink-700 opacity-0 shadow-overlay transition-opacity peer-hover:opacity-100 peer-focus:opacity-100 peer-focus-visible:opacity-100",
          side === "bottom" && "left-1/2 top-full mt-1.5 -translate-x-1/2",
          side === "top" && "bottom-full left-1/2 mb-1.5 -translate-x-1/2",
          side === "right" && "left-full top-1/2 ml-1.5 -translate-y-1/2",
        )}
      >
        {children}
      </span>
    </span>
  );
}
