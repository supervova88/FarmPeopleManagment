import type { Sop, SopLevel } from "./model";

/** Индекс по id — для частых lookup в UI и reducer. */
export function indexSops(sops: Sop[]): Map<string, Sop> {
  return new Map(sops.map((s) => [s.id, s]));
}

export function listL3Sops(sops: Sop[]): Sop[] {
  return sops.filter((s) => s.level === "L3_operation");
}

/** Действующие тарифицируемые L3 — для форм тарифа и фактов. */
export function listActiveTariffableL3(sops: Sop[]): Sop[] {
  return listL3Sops(sops).filter((s) => s.status === "active" && s.isTariffable);
}

export function getSopNameFrom(sops: Sop[], sopId: string): string {
  return indexSops(sops).get(sopId)?.name ?? sopId;
}

export function getSopChildrenFrom(sops: Sop[], parentId: string | null): Sop[] {
  return sops.filter((s) => s.parentId === parentId);
}

export function hasSopChildren(sops: Sop[], sopId: string): boolean {
  return sops.some((s) => s.parentId === sopId);
}

/** Все потомки узла (прямые и вложенные). */
export function getDescendantIds(sops: Sop[], rootId: string): string[] {
  const result: string[] = [];
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const child of getSopChildrenFrom(sops, id)) {
      result.push(child.id);
      queue.push(child.id);
    }
  }
  return result;
}

/** Путь от корня до СОП — для хлебных крошек в карточке. */
export function getSopPathFrom(sops: Sop[], sopId: string): string[] {
  const byId = indexSops(sops);
  const path: string[] = [];
  let current = byId.get(sopId);
  while (current) {
    path.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

/**
 * Следующий свободный код среди «братьев» того же уровня:
 * L1 → СОП-03, L2 под СОП-01 → СОП-01.04, L3 → СОП-01.02.03.
 */
export function suggestNextSopCode(
  sops: Sop[],
  level: SopLevel,
  parentId: string | null,
): string {
  if (level === "L1_division") {
    const siblings = sops.filter((s) => s.level === "L1_division");
    return `СОП-${nextSegment(siblings.map((s) => s.code), "СОП")}`;
  }

  const parent = parentId ? indexSops(sops).get(parentId) : undefined;
  if (!parent) return level === "L2_process" ? "СОП-01.01" : "СОП-01.01.01";

  const siblings = getSopChildrenFrom(sops, parent.id).filter((s) => s.level === level);
  return `${parent.code}.${nextSegment(
    siblings.map((s) => s.code),
    parent.code,
  )}`;
}

function nextSegment(codes: string[], parentOrRootPrefix: string): string {
  let max = 0;
  for (const code of codes) {
    let segment = code;
    if (parentOrRootPrefix === "СОП") {
      const m = /^СОП-(\d+)$/i.exec(code.trim());
      if (m) segment = m[1];
      else continue;
    } else if (code.startsWith(`${parentOrRootPrefix}.`)) {
      segment = code.slice(parentOrRootPrefix.length + 1);
      const dot = segment.indexOf(".");
      if (dot >= 0) segment = segment.slice(0, dot);
    } else {
      const lastDot = code.lastIndexOf(".");
      segment = lastDot >= 0 ? code.slice(lastDot + 1) : code;
    }
    const n = Number.parseInt(segment, 10);
    if (Number.isFinite(n)) max = Math.max(max, n);
  }
  return String(max + 1).padStart(2, "0");
}
