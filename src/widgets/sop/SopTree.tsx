import { ChevronDown, ChevronRight, FileText, Folder, ListTree } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getSopChildrenFrom } from "@/entities/sop/helpers";
import type { Sop } from "@/entities/sop/model";
import { cn } from "@/shared/lib/utils";

/** Дерево оргструктуры методологии: Подразделение → Процесс → Операция. */
export function SopTree({
  sops,
  selectedId,
  onSelect,
}: {
  sops: Sop[];
  selectedId: string | null;
  onSelect: (sop: Sop) => void;
}) {
  const roots = useMemo(() => sops.filter((s) => s.level === "L1_division"), [sops]);
  const knownIdsRef = useRef<Set<string>>(new Set(sops.map((s) => s.id)));
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(sops.filter((s) => s.level !== "L3_operation").map((s) => s.id)),
  );

  /** Раскрываем путь к выбранному узлу и родителей только что созданных СОП. */
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      const known = knownIdsRef.current;

      for (const s of sops) {
        if (!known.has(s.id)) {
          if (s.parentId) next.add(s.parentId);
          if (s.level !== "L3_operation") next.add(s.id);
        }
      }
      knownIdsRef.current = new Set(sops.map((s) => s.id));

      if (selectedId) {
        let current = sops.find((s) => s.id === selectedId);
        while (current?.parentId) {
          next.add(current.parentId);
          current = sops.find((s) => s.id === current!.parentId);
        }
      }
      return next;
    });
  }, [sops, selectedId]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNode(sop: Sop, depth: number) {
    const children = getSopChildrenFrom(sops, sop.id);
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(sop.id);
    const isSelected = selectedId === sop.id;
    const isArchived = sop.status === "archived";

    return (
      <li key={sop.id}>
        <div
          className={cn(
            "flex items-center gap-1 rounded px-1 py-1 text-xs transition-colors",
            isSelected ? "bg-accent-soft font-semibold text-accent" : "hover:bg-line-soft",
            isArchived && !isSelected && "opacity-55",
          )}
          style={{ paddingLeft: 4 + depth * 12 }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggle(sop.id)}
              className="shrink-0 rounded p-0.5 text-ink-400 hover:bg-line hover:text-ink-700"
              aria-label={isExpanded ? "Свернуть" : "Развернуть"}
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          ) : (
            <span className="w-[17px] shrink-0" />
          )}

          <span className="shrink-0 text-ink-400">
            {sop.level === "L1_division" ? (
              <Folder size={12} />
            ) : sop.level === "L2_process" ? (
              <ListTree size={12} />
            ) : (
              <FileText size={12} />
            )}
          </span>

          <button
            type="button"
            onClick={() => onSelect(sop)}
            className={cn(
              "min-w-0 flex-1 truncate text-left",
              isArchived && "line-through decoration-ink-400",
            )}
            title={`${sop.code} · ${sop.name}${isArchived ? " (архив)" : ""}`}
          >
            {sop.name}
            {isArchived ? <span className="ml-1 text-2xs font-normal text-ink-400">архив</span> : null}
          </button>
        </div>

        {hasChildren && isExpanded ? (
          <ul>{children.map((child) => renderNode(child, depth + 1))}</ul>
        ) : null}
      </li>
    );
  }

  return <ul className="py-1">{roots.map((root) => renderNode(root, 0))}</ul>;
}
