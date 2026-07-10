import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { boardReducer } from "./boardReducer";
import { loadBoardState, saveBoardState } from "./store";
import type {
  BoardState,
  Card,
  Priority,
  PullRequest,
  Settings,
  WorkType,
} from "./types";

interface BoardActions {
  addCard: (
    columnId: string,
    title: string,
    description: string,
    note: string,
    priority: Priority,
    workType: WorkType,
    github?: NonNullable<Card["github"]>,
  ) => void;
  updateCard: (
    cardId: string,
    title: string,
    description: string,
    note: string,
    priority: Priority,
    pullRequests: PullRequest[],
  ) => void;
  deleteCard: (cardId: string) => void;
  moveCard: (
    cardId: string,
    toColumnId: string,
    toWorkType: WorkType,
    toIndex: number,
  ) => void;
  setCardAgent: (cardId: string, agent: NonNullable<Card["agent"]>) => void;
  clearCardAgent: (cardId: string) => void;
  clearCardGithub: (cardId: string) => void;
  updateSettings: (settings: Partial<Settings>) => void;
}

interface BoardContextValue {
  state: BoardState;
  actions: BoardActions;
}

const BoardContext = createContext<BoardContextValue | null>(null);

export function BoardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    boardReducer,
    null as unknown as BoardState,
  );
  const [loaded, setLoaded] = useState(false);
  const hydratedRef = useRef(false);

  // Load persisted state once on startup (falls back to seed defaults).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const initial = await loadBoardState();
      if (cancelled) return;
      dispatch({ type: "hydrate", state: initial });
      hydratedRef.current = true;
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on every state change after the initial hydration.
  useEffect(() => {
    if (!hydratedRef.current) return;
    void saveBoardState(state);
  }, [state]);

  const actions = useMemo<BoardActions>(
    () => ({
      addCard: (columnId, title, description, note, priority, workType, github) =>
        dispatch({
          type: "addCard",
          columnId,
          title,
          description,
          note,
          priority,
          workType,
          github,
        }),
      updateCard: (cardId, title, description, note, priority, pullRequests) =>
        dispatch({
          type: "updateCard",
          cardId,
          title,
          description,
          note,
          priority,
          pullRequests,
        }),
      deleteCard: (cardId) => dispatch({ type: "deleteCard", cardId }),
      moveCard: (cardId, toColumnId, toWorkType, toIndex) =>
        dispatch({ type: "moveCard", cardId, toColumnId, toWorkType, toIndex }),
      setCardAgent: (cardId, agent) =>
        dispatch({ type: "setCardAgent", cardId, agent }),
      clearCardAgent: (cardId) => dispatch({ type: "clearCardAgent", cardId }),
      clearCardGithub: (cardId) => dispatch({ type: "clearCardGithub", cardId }),
      updateSettings: (settings) =>
        dispatch({ type: "updateSettings", settings }),
    }),
    [],
  );

  if (!loaded) {
    return <div className="app-loading">Loading…</div>;
  }

  return (
    <BoardContext.Provider value={{ state, actions }}>
      {children}
    </BoardContext.Provider>
  );
}

export function useBoard(): BoardContextValue {
  const ctx = useContext(BoardContext);
  if (!ctx) {
    throw new Error("useBoard must be used within a BoardProvider");
  }
  return ctx;
}
