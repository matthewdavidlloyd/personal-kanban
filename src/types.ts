// Data model — see SPEC.md §Data model. This is the single source of truth
// for the shape persisted to store.json.

export type Priority = "urgent" | "high" | "medium" | "low";

export type WorkType = "review" | "coding" | "admin";

export interface PullRequest {
  number: number; // GitHub PR number
  url: string; // canonical https URL to the PR
}

export interface Card {
  id: string; // crypto.randomUUID()
  title: string;
  description: string;
  /** Short freeform status line shown on the card face (e.g. "needs self-review"). */
  note: string;
  priority: Priority;
  // No workType field — a card's work type IS the swimlane it lives in (its
  // Column.lanes key). Derive it via findCardLocation() in board.ts.
  /** Linked PRs, ordered by link order. Read-only breadcrumbs — never re-synced. */
  pullRequests: PullRequest[];
  createdAt: string; // ISO
  updatedAt: string; // ISO
  /** Informational breadcrumb of the last dispatch — NOT a live status. */
  agent?: {
    id: string; // short id from `claude --bg`, e.g. "900a7040"
    dispatchedAt: string; // ISO
  };
  /** Informational breadcrumb of the source issue — one-shot import, never re-synced. */
  github?: {
    number: number;
    url: string;
  };
}

export interface Column {
  id: string;
  name: string;
  // One ordered list per swimlane (work type). THIS is the card order per cell.
  lanes: Record<WorkType, string[]>;
}

export interface Settings {
  projectDir: string;
}

export interface BoardState {
  columns: Column[]; // ordered, left to right
  cards: Record<string, Card>;
  settings: Settings;
}
