// Data model — see SPEC.md §Data model. This is the single source of truth
// for the shape persisted to store.json.

export type Priority = "urgent" | "high" | "medium" | "low";

export type WorkType = "review" | "coding" | "admin";

export interface Card {
  id: string; // crypto.randomUUID()
  title: string;
  description: string;
  priority: Priority;
  workType: WorkType;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  /** Informational breadcrumb of the last dispatch — NOT a live status. */
  agent?: {
    id: string; // short id from `claude --bg`, e.g. "900a7040"
    dispatchedAt: string; // ISO
  };
}

export interface Column {
  id: string;
  name: string;
  cardIds: string[]; // ordered — this IS the card order
}

export interface Settings {
  projectDir: string;
}

export interface BoardState {
  columns: Column[]; // ordered, left to right
  cards: Record<string, Card>;
  settings: Settings;
}
