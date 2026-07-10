import type { WorkType } from "./types";

// Order drives the swimlane rows top-to-bottom and the modal Type picker.
export const WORK_TYPES: WorkType[] = ["coding", "review", "admin"];

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  review: "Review",
  coding: "Coding",
  admin: "Admin",
};

export const DEFAULT_WORK_TYPE: WorkType = "coding";

// Relative vertical size of each swimlane row on the board. Coding gets the bias
// (½ the height; Review/Admin ¼ each) since it's where most cards live.
export const WORK_TYPE_ROW_WEIGHTS: Record<WorkType, number> = {
  coding: 2,
  review: 1,
  admin: 1,
};
