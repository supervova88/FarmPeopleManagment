import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils";

export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-xs", className)}>{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-canvas">{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({
  className,
  children,
  onClick,
  selected,
}: {
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-line-soft last:border-b-0",
        onClick && "cursor-pointer hover:bg-accent-soft/60",
        selected && "bg-accent-soft",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TH({
  className,
  children,
  align = "left",
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-b border-line px-2.5 py-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-500",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TD({
  className,
  children,
  align = "left",
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right" | "center" }) {
  return (
    <td
      className={cn(
        "px-2.5 py-1.5 align-top text-ink-800",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

/** Денежная ячейка: правое выравнивание, моноширинные цифры, «—» вместо null. */
export function MoneyCell({
  children,
  emphasis,
  muted,
  className,
}: {
  children: ReactNode;
  emphasis?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "tabular whitespace-nowrap",
        emphasis && "font-semibold text-ink-900",
        muted && "text-ink-400",
        className,
      )}
    >
      {children}
    </span>
  );
}
