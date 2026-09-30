import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/shared/lib/utils";
import { HelpTip } from "./HelpTip";

const controlClass =
  "w-full rounded border border-line-strong bg-white px-2 py-1.5 text-xs text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:bg-canvas disabled:text-ink-400";

export function Field({
  label,
  hint,
  required,
  error,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  required?: boolean;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      {label ? (
        <span className="mb-1 flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-ink-500">
          {label}
          {required ? <span className="text-reject">*</span> : null}
          {/* tip вверх / вправо — не перекрывает контрол под лейблом */}
          {hint ? <HelpTip side="top">{hint}</HelpTip> : null}
        </span>
      ) : null}
      {children}
      {error ? <span className="mt-1 block text-2xs text-reject">{error}</span> : null}
    </label>
  );
}

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, className)} {...props} />;
}

export function NumberInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      inputMode="decimal"
      className={cn(controlClass, "tabular text-right", className)}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlClass, "pr-6", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} className={cn(controlClass, "resize-y leading-relaxed", className)} {...props} />;
}
