import { Info, Lock, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

type HintTone = "info" | "warning" | "locked";

const toneClass: Record<HintTone, string> = {
  info: "border-accent-line bg-accent-soft text-ink-700",
  warning: "border-pending-line bg-pending-soft text-ink-700",
  locked: "border-line bg-canvas text-ink-600",
};

const toneIcon: Record<HintTone, ReactNode> = {
  info: <Info size={13} className="text-accent" />,
  warning: <TriangleAlert size={13} className="text-pending" />,
  locked: <Lock size={13} className="text-ink-500" />,
};

/** Компактная пояснительная плашка для бизнес-правил прямо в интерфейсе. */
export function Hint({
  tone = "info",
  children,
  className,
}: {
  tone?: HintTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-1.5 rounded border px-2.5 py-1.5 text-xs leading-relaxed",
        toneClass[tone],
        className,
      )}
    >
      <span className="mt-[2px] shrink-0">{toneIcon[tone]}</span>
      <span>{children}</span>
    </div>
  );
}
