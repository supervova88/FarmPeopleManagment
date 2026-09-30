import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "success" | "danger" | "warning";
type Size = "xs" | "sm" | "md";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-blue-800 border border-transparent",
  secondary: "bg-steel-900 text-white hover:bg-steel-800 border border-transparent",
  outline: "border border-line-strong bg-white text-ink-800 hover:bg-canvas",
  ghost: "border border-transparent bg-transparent text-ink-700 hover:bg-line-soft",
  success: "bg-paid text-white hover:bg-green-800 border border-transparent",
  danger: "bg-reject text-white hover:bg-red-800 border border-transparent",
  warning: "bg-pending text-white hover:bg-amber-800 border border-transparent",
};

const sizes: Record<Size, string> = {
  xs: "h-6 px-2 text-2xs",
  sm: "h-7 px-2.5 text-xs",
  md: "h-8 px-3 text-xs",
};

export function Button({
  className,
  variant = "primary",
  size = "sm",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
