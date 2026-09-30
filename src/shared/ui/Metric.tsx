import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

type MetricTone = "neutral" | "success" | "warning" | "danger" | "accent";

const toneClass: Record<MetricTone, string> = {
  neutral: "border-line bg-white",
  success: "border-paid-line bg-paid-soft",
  warning: "border-pending-line bg-pending-soft",
  danger: "border-reject-line bg-reject-soft",
  accent: "border-accent-line bg-accent-soft",
};

const valueClass: Record<MetricTone, string> = {
  neutral: "text-ink-900",
  success: "text-paid",
  warning: "text-pending",
  danger: "text-reject",
  accent: "text-accent",
};

export function Metric({
  label,
  value,
  hint,
  tone = "neutral",
  size = "md",
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: MetricTone;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("rounded border px-3 py-2", toneClass[tone], className)}>
      <p className="text-2xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p
        className={cn(
          "tabular mt-1 font-semibold",
          size === "lg" ? "text-xl" : "text-base",
          valueClass[tone],
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-2xs leading-snug text-ink-500">{hint}</p> : null}
    </div>
  );
}
