import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg";
}) {
  if (!open) return null;

  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl" };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/45 p-8"
      onMouseDown={(e) => {
        // Клик по затемнению закрывает модалку; клик по карточке — нет
        if (e.target === e.currentTarget) onClose();
      }}
    >      <div
        className={cn(
          "w-full rounded border border-line bg-white shadow-overlay",
          widths[width],
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-400 transition-colors hover:bg-line-soft hover:text-ink-700"
            aria-label="Закрыть"
          >
            <X size={15} />
          </button>
        </header>
        <div className="px-4 py-3">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-line bg-canvas px-4 py-2.5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
