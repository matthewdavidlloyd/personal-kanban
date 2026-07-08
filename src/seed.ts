import type { BoardState } from "./types";

// Default board used on first launch (no store.json yet) and as the static
// content for the initial UI. Card order is the array order in each column.
export function createSeedState(): BoardState {
  const now = new Date().toISOString();
  return {
    columns: [
      { id: "backlog", name: "Backlog", cardIds: ["c1", "c2", "c3"] },
      { id: "in-progress", name: "In Progress", cardIds: ["c4"] },
      { id: "waiting", name: "Waiting", cardIds: [] },
      { id: "done", name: "Done", cardIds: ["c5"] },
    ],
    cards: {
      c1: {
        id: "c1",
        title: "Wire up drag and drop",
        description: "Use @dnd-kit for reordering and cross-column moves.",
        priority: "high",
        workType: "coding",
        note: "",
        createdAt: now,
        updatedAt: now,
      },
      c2: {
        id: "c2",
        title: "Add settings modal",
        description: "One field: the project directory used for dispatches.",
        priority: "medium",
        workType: "coding",
        note: "",
        createdAt: now,
        updatedAt: now,
      },
      c3: {
        id: "c3",
        title: "Ship the icon",
        description: "",
        priority: "low",
        workType: "admin",
        note: "",
        createdAt: now,
        updatedAt: now,
      },
      c4: {
        id: "c4",
        title: "Persist the board to disk",
        description: "tauri-plugin-store, single store.json in app data dir.",
        priority: "urgent",
        workType: "coding",
        note: "",
        createdAt: now,
        updatedAt: now,
        agent: { id: "900a7040", dispatchedAt: now },
      },
      c5: {
        id: "c5",
        title: "Scaffold the Tauri app",
        description: "React + TS template, three plugins registered.",
        priority: "medium",
        workType: "coding",
        note: "",
        createdAt: now,
        updatedAt: now,
      },
    },
    settings: {
      projectDir: "",
    },
  };
}
