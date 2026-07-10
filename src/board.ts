// Small pure selectors over BoardState. A card's work type is not stored on the
// card — it's derived from which swimlane (Column.lanes key) the card lives in.

import type { BoardState, WorkType } from "./types";
import { WORK_TYPES } from "./workType";

export interface CardLocation {
  columnId: string;
  workType: WorkType;
  index: number;
}

/** Where a card currently sits (column × swimlane × position), or null if gone. */
export function findCardLocation(
  state: BoardState,
  cardId: string,
): CardLocation | null {
  for (const col of state.columns) {
    for (const workType of WORK_TYPES) {
      const idx = col.lanes[workType]?.indexOf(cardId) ?? -1;
      if (idx !== -1) return { columnId: col.id, workType, index: idx };
    }
  }
  return null;
}

/** A card's work type = the swimlane it's in. Null if the card isn't on the board. */
export function cardWorkType(
  state: BoardState,
  cardId: string,
): WorkType | null {
  return findCardLocation(state, cardId)?.workType ?? null;
}
