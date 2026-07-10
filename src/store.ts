import { load, type Store } from "@tauri-apps/plugin-store";
import type { BoardState } from "./types";
import { createSeedState } from "./seed";
import { normalizeBoardState } from "./migrate";

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
    return normalizeBoardState(saved);
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
