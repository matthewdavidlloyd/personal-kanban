import type {
  BoardState,
  Card,
  Priority,
  PullRequest,
  Settings,
  WorkType,
} from "./types";
import { WORK_TYPES } from "./workType";

export type BoardAction =
  | { type: "hydrate"; state: BoardState }
  | {
      type: "addCard";
      columnId: string;
      title: string;
      description: string;
      note: string;
      priority: Priority;
      workType: WorkType;
      github?: NonNullable<Card["github"]>;
    }
  | {
      type: "updateCard";
      cardId: string;
      title: string;
      description: string;
      note: string;
      priority: Priority;
      pullRequests: PullRequest[];
    }
  | { type: "deleteCard"; cardId: string }
  | {
      type: "moveCard";
      cardId: string;
      toColumnId: string;
      toWorkType: WorkType;
      toIndex: number;
    }
  | { type: "setCardAgent"; cardId: string; agent: NonNullable<Card["agent"]> }
  | { type: "clearCardAgent"; cardId: string }
  | { type: "clearCardGithub"; cardId: string }
  | { type: "updateSettings"; settings: Partial<Settings> };

function nowIso(): string {
  return new Date().toISOString();
}

/** Remove a card id from every swimlane of a column (returns the same lanes if absent). */
function removeFromLanes(
  lanes: Record<WorkType, string[]>,
  cardId: string,
): Record<WorkType, string[]> {
  let changed = false;
  const next = {} as Record<WorkType, string[]>;
  for (const wt of WORK_TYPES) {
    const lane = lanes[wt] ?? [];
    if (lane.includes(cardId)) {
      next[wt] = lane.filter((id) => id !== cardId);
      changed = true;
    } else {
      next[wt] = lane;
    }
  }
  return changed ? next : lanes;
}

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "hydrate":
      return action.state;

    case "addCard": {
      const id = crypto.randomUUID();
      const now = nowIso();
      const card: Card = {
        id,
        title: action.title,
        description: action.description,
        note: action.note,
        priority: action.priority,
        pullRequests: [],
        createdAt: now,
        updatedAt: now,
        ...(action.github ? { github: action.github } : {}),
      };
      return {
        ...state,
        cards: { ...state.cards, [id]: card },
        columns: state.columns.map((c) =>
          c.id === action.columnId
            ? {
                ...c,
                lanes: {
                  ...c.lanes,
                  [action.workType]: [...(c.lanes[action.workType] ?? []), id],
                },
              }
            : c,
        ),
      };
    }

    case "updateCard": {
      const existing = state.cards[action.cardId];
      if (!existing) return state;
      return {
        ...state,
        cards: {
          ...state.cards,
          [action.cardId]: {
            ...existing,
            title: action.title,
            description: action.description,
            note: action.note,
            priority: action.priority,
            pullRequests: action.pullRequests,
            updatedAt: nowIso(),
          },
        },
      };
    }

    case "deleteCard": {
      if (!state.cards[action.cardId]) return state;
      const cards = { ...state.cards };
      delete cards[action.cardId];
      return {
        ...state,
        cards,
        columns: state.columns.map((c) => ({
          ...c,
          lanes: removeFromLanes(c.lanes, action.cardId),
        })),
      };
    }

    case "moveCard": {
      const { cardId, toColumnId, toWorkType, toIndex } = action;
      if (!state.cards[cardId]) return state;
      if (!state.columns.some((c) => c.id === toColumnId)) return state;
      // Remove from wherever it currently lives (any column × swimlane), then
      // insert into the target cell.
      const withoutCard = state.columns.map((c) => ({
        ...c,
        lanes: removeFromLanes(c.lanes, cardId),
      }));
      return {
        ...state,
        columns: withoutCard.map((c) => {
          if (c.id !== toColumnId) return c;
          const lane = [...c.lanes[toWorkType]];
          const idx = Math.max(0, Math.min(toIndex, lane.length));
          lane.splice(idx, 0, cardId);
          return { ...c, lanes: { ...c.lanes, [toWorkType]: lane } };
        }),
      };
    }

    case "setCardAgent": {
      const existing = state.cards[action.cardId];
      if (!existing) return state;
      return {
        ...state,
        cards: {
          ...state.cards,
          [action.cardId]: { ...existing, agent: action.agent },
        },
      };
    }

    case "clearCardAgent": {
      const existing = state.cards[action.cardId];
      if (!existing || !existing.agent) return state;
      const { agent: _agent, ...rest } = existing;
      return {
        ...state,
        cards: { ...state.cards, [action.cardId]: rest },
      };
    }

    case "clearCardGithub": {
      const existing = state.cards[action.cardId];
      if (!existing || !existing.github) return state;
      const { github: _github, ...rest } = existing;
      return {
        ...state,
        cards: { ...state.cards, [action.cardId]: rest },
      };
    }

    case "updateSettings":
      return { ...state, settings: { ...state.settings, ...action.settings } };

    default:
      return state;
  }
}
