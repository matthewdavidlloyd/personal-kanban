// Pure helpers for the board's drag-and-drop ordering. Kept free of React and
// dnd-kit so the index math can be unit-tested in isolation.

// columnId -> ordered cardIds.
export type ItemMap = Record<string, string[]>;

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** The column an id belongs to — either a column id itself or a card's column. */
export function findColumn(items: ItemMap, id: string): string | null {
  if (id in items) return id;
  return Object.keys(items).find((col) => items[col].includes(id)) ?? null;
}

/**
 * Move `activeId` into the column of `overId` when they're in different
 * columns (the live cross-column preview during a drag). `overId` may be a card
 * id (insert at that card's position) or a column id (append to the end).
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
 * Finalize a same-column reorder on drop. `overId` may be a card id (drop onto
 * that card) or the column id (drop in the whitespace → move to the end).
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
