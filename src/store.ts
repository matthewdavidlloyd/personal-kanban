import { load, type Store } from "@tauri-apps/plugin-store";
import type { BoardState } from "./types";
import { createSeedState } from "./seed";
import { DEFAULT_PRIORITY } from "./priority";

// Backfill fields added after a store.json was first written, so older saved
// boards stay valid without a formal migration (SPEC: no migrations for v1).
function normalize(state: BoardState): BoardState {
  const cards = Object.fromEntries(
    Object.entries(state.cards).map(([id, card]) => [
      id,
      { ...card, priority: card.priority ?? DEFAULT_PRIORITY },
    ]),
  );
  return { ...state, cards };
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
