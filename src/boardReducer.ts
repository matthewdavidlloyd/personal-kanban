import type { BoardState, Card, Priority, Settings } from "./types";

export type BoardAction =
  | { type: "hydrate"; state: BoardState }
  | {
      type: "addCard";
      columnId: string;
      title: string;
      description: string;
      priority: Priority;
    }
  | {
      type: "updateCard";
      cardId: string;
      title: string;
      description: string;
      priority: Priority;
    }
  | { type: "deleteCard"; cardId: string }
  | { type: "moveCard"; cardId: string; toColumnId: string; toIndex: number }
  | { type: "setCardAgent"; cardId: string; agent: NonNullable<Card["agent"]> }
  | { type: "clearCardAgent"; cardId: string }
  | { type: "updateSettings"; settings: Partial<Settings> };

function nowIso(): string {
  return new Date().toISOString();
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
        priority: action.priority,
        createdAt: now,
        updatedAt: now,
      };
      return {
        ...state,
        cards: { ...state.cards, [id]: card },
        columns: state.columns.map((c) =>
          c.id === action.columnId ? { ...c, cardIds: [...c.cardIds, id] } : c,
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
            priority: action.priority,
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
          cardIds: c.cardIds.filter((id) => id !== action.cardId),
        })),
      };
    }

    case "moveCard": {
      const { cardId, toColumnId, toIndex } = action;
      if (!state.cards[cardId]) return state;
      if (!state.columns.some((c) => c.id === toColumnId)) return state;
      // Remove from wherever it currently lives, then insert into the target.
      const withoutCard = state.columns.map((c) =>
        c.cardIds.includes(cardId)
          ? { ...c, cardIds: c.cardIds.filter((id) => id !== cardId) }
          : c,
      );
      return {
        ...state,
        columns: withoutCard.map((c) => {
          if (c.id !== toColumnId) return c;
          const next = [...c.cardIds];
          const idx = Math.max(0, Math.min(toIndex, next.length));
          next.splice(idx, 0, cardId);
          return { ...c, cardIds: next };
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

    case "updateSettings":
      return { ...state, settings: { ...state.settings, ...action.settings } };

    default:
      return state;
  }
}
