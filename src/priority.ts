import type { Priority } from "./types";

// Ordered most- to least-urgent (used for the picker; the board itself stays
// manually ordered — priority is a visual attribute, not a sort key).
export const PRIORITIES: Priority[] = ["urgent", "high", "medium", "low"];

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const DEFAULT_PRIORITY: Priority = "medium";
