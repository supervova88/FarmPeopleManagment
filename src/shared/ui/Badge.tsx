import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

const tones: Record<Tone, string> = {
  neutral: "bg-line-soft text-ink-700 border-line",
  info: "bg-accent-soft text-accent border-accent-line",
  success: "bg-paid-soft text-paid border-paid-line",
  warning: "bg-pending-soft text-pending border-pending-line",
  danger: "bg-reject-soft text-reject border-reject-line",
  muted: "bg-transparent text-ink-500 border-line",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  icon,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-[1px] text-2xs font-medium leading-4",
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
