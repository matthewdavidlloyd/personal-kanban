// Load-time backfill/migration for store.json. Pure (no Tauri imports) so the
// board stays valid across shape changes without a formal migration framework
// (SPEC: no migrations for v1). Kept separate from store.ts for testability.

import type { BoardState, Card, Column, WorkType } from "./types";
import { DEFAULT_PRIORITY } from "./priority";
import { DEFAULT_WORK_TYPE, WORK_TYPES } from "./workType";

// Legacy shapes (pre-swimlanes): cards carried a per-card `workType`, and columns
// used a flat `cardIds` array. We read those once here to migrate, then drop them.
interface LegacyCard extends Card {
  workType?: WorkType;
}
interface LegacyColumn {
  id: string;
  name: string;
  cardIds?: string[];
  lanes?: Partial<Record<WorkType, string[]>>;
}

export function emptyLanes(): Record<WorkType, string[]> {
  return { review: [], coding: [], admin: [] };
}

/** Backfill fields and migrate the column shape for a loaded board. */
export function normalizeBoardState(state: BoardState): BoardState {
  const rawCards = state.cards as Record<string, LegacyCard>;

  // Backfill per-card fields; strip the now-redundant per-card workType (a card's
  // work type is the swimlane it lives in).
  const cards: Record<string, Card> = {};
  for (const [id, card] of Object.entries(rawCards)) {
    const { workType: _legacyWorkType, ...rest } = card;
    cards[id] = {
      ...rest,
      priority: rest.priority ?? DEFAULT_PRIORITY,
      note: rest.note ?? "",
      pullRequests: Array.isArray(rest.pullRequests) ? rest.pullRequests : [],
    };
  }

  const workTypeOf = (id: string): WorkType =>
    rawCards[id]?.workType ?? DEFAULT_WORK_TYPE;

  // Flat `cardIds` → one ordered list per swimlane, grouped by each card's old
  // workType (order preserved). Columns already in lane form are passed through,
  // with any missing swimlane array filled in.
  const toLanes = (col: LegacyColumn): Record<WorkType, string[]> => {
    if (col.lanes && typeof col.lanes === "object") {
      const lanes = emptyLanes();
      for (const wt of WORK_TYPES) {
        const lane = col.lanes[wt];
        lanes[wt] = Array.isArray(lane) ? lane : [];
      }
      return lanes;
    }
    const lanes = emptyLanes();
    for (const cardId of Array.isArray(col.cardIds) ? col.cardIds : []) {
      lanes[workTypeOf(cardId)].push(cardId);
    }
    return lanes;
  };

  let columns: Column[] = (state.columns as unknown as LegacyColumn[]).map(
    (c) => ({ id: c.id, name: c.name, lanes: toLanes(c) }),
  );

  // Backfill the Waiting column for boards saved before it existed. Inject after
  // "in-progress" if present; otherwise before "done"; otherwise leave custom
  // layouts alone.
  if (!columns.some((c) => c.id === "waiting")) {
    const waiting: Column = {
      id: "waiting",
      name: "Waiting",
      lanes: emptyLanes(),
    };
    const inProgressIdx = columns.findIndex((c) => c.id === "in-progress");
    const doneIdx = columns.findIndex((c) => c.id === "done");
    if (inProgressIdx !== -1) {
      columns = [
        ...columns.slice(0, inProgressIdx + 1),
        waiting,
        ...columns.slice(inProgressIdx + 1),
      ];
    } else if (doneIdx !== -1) {
      columns = [
        ...columns.slice(0, doneIdx),
        waiting,
        ...columns.slice(doneIdx),
      ];
    }
  }

  // A store missing settings.projectDir would make projectDir.trim() throw.
  const settings = {
    ...state.settings,
    projectDir: state.settings.projectDir ?? "",
  };
  return { columns, cards, settings };
}
