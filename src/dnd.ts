// Pure helpers for the board's drag-and-drop ordering. Kept free of React and
// dnd-kit so the index math can be unit-tested in isolation.

import type { WorkType } from "./types";
import { WORK_TYPES } from "./workType";

// The board's drop containers are cells (column × swimlane), keyed by a cell id.
// These ordering helpers treat the keys as opaque, so they work the same whether
// a key is a column id or a cell id.
// cellId -> ordered cardIds.
export type ItemMap = Record<string, string[]>;

const CELL_SEP = "::";

/** Encode a (columnId, workType) pair into the droppable id used on the board. */
export function cellId(columnId: string, workType: WorkType): string {
  return `${columnId}${CELL_SEP}${workType}`;
}

/** Decode a cell id back to its column and swimlane, or null if malformed. */
export function parseCellId(
  id: string,
): { columnId: string; workType: WorkType } | null {
  const at = id.lastIndexOf(CELL_SEP);
  if (at === -1) return null;
  const columnId = id.slice(0, at);
  const workType = id.slice(at + CELL_SEP.length);
  if (!columnId || !WORK_TYPES.includes(workType as WorkType)) return null;
  return { columnId, workType: workType as WorkType };
}

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** The cell an id belongs to — either a cell id itself or the cell of a card. */
export function findColumn(items: ItemMap, id: string): string | null {
  if (id in items) return id;
  return Object.keys(items).find((col) => items[col].includes(id)) ?? null;
}

/**
 * Move `activeId` into the cell of `overId` when they're in different cells (the
 * live cross-cell preview during a drag). `overId` may be a card id (insert at
 * that card's position) or a cell id (append to the end).
 * Returns the same map unchanged when there's nothing to do.
 */
export function moveBetweenColumns(
  items: ItemMap,
  activeId: string,
  overId: string,
): ItemMap {
  const activeCol = findColumn(items, activeId);
  const overCol = findColumn(items, overId);
  if (!activeCol || !overCol || activeCol === overCol) return items;

  const overItems = items[overCol];
  const insertAt = overId in items ? overItems.length : overItems.indexOf(overId);
  const index = insertAt < 0 ? overItems.length : insertAt;
  return {
    ...items,
    [activeCol]: items[activeCol].filter((id) => id !== activeId),
    [overCol]: [
      ...overItems.slice(0, index),
      activeId,
      ...overItems.slice(index),
    ],
  };
}

/**
 * Finalize a same-cell reorder on drop. `overId` may be a card id (drop onto
 * that card) or the cell id (drop in the whitespace → move to the end).
 * Returns the same map unchanged when there's nothing to do.
 */
export function reorderWithinColumn(
  items: ItemMap,
  activeId: string,
  overId: string,
): ItemMap {
  const activeCol = findColumn(items, activeId);
  const overCol = findColumn(items, overId);
  if (!activeCol || !overCol || activeCol !== overCol) return items;

  const oldIndex = items[activeCol].indexOf(activeId);
  const newIndex =
    overId in items ? items[overCol].length - 1 : items[overCol].indexOf(overId);
  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return items;

  return { ...items, [activeCol]: arrayMove(items[activeCol], oldIndex, newIndex) };
}
