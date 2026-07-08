import { load, type Store } from "@tauri-apps/plugin-store";
import type { BoardState, Column } from "./types";
import { createSeedState } from "./seed";
import { DEFAULT_PRIORITY } from "./priority";
import { DEFAULT_WORK_TYPE } from "./workType";

// Backfill fields added after a store.json was first written, so older saved
// boards stay valid without a formal migration (SPEC: no migrations for v1).
function normalize(state: BoardState): BoardState {
  const cards = Object.fromEntries(
    Object.entries(state.cards).map(([id, card]) => [
      id,
      {
        ...card,
        priority: card.priority ?? DEFAULT_PRIORITY,
        workType: card.workType ?? DEFAULT_WORK_TYPE,
      },
    ]),
  );
  // Guard against columns saved without a cardIds array (would crash drag/move).
  let columns: Column[] = state.columns.map((c) => ({
    ...c,
    cardIds: Array.isArray(c.cardIds) ? c.cardIds : [],
  }));
  // Backfill the Waiting column for boards saved before it existed. Inject
  // after "in-progress" if present; otherwise before "done"; otherwise leave
  // custom layouts alone.
  if (!columns.some((c) => c.id === "waiting")) {
    const waiting: Column = { id: "waiting", name: "Waiting", cardIds: [] };
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
  const settings = { ...state.settings, projectDir: state.settings.projectDir ?? "" };
  return { ...state, cards, columns, settings };
}

// Single JSON file in the app data dir (~/Library/Application Support/<id>/).
const STORE_FILE = "store.json";
const BOARD_KEY = "board";

let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    // Default options: autoSave debounces disk writes by 100ms, so bursts of
    // mutations coalesce into a single write.
    storePromise = load(STORE_FILE);
  }
  return storePromise;
}

export async function loadBoardState(): Promise<BoardState> {
  const store = await getStore();
  const saved = await store.get<BoardState>(BOARD_KEY);
  if (saved && Array.isArray(saved.columns) && saved.cards && saved.settings) {
    return normalize(saved);
  }
  const seed = createSeedState();
  await store.set(BOARD_KEY, seed);
  return seed;
}

export async function saveBoardState(state: BoardState): Promise<void> {
  const store = await getStore();
  // With autoSave enabled the actual disk write is debounced/coalesced.
  await store.set(BOARD_KEY, state);
}
