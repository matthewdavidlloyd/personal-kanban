import type { WorkType } from "./types";

export const WORK_TYPES: WorkType[] = ["review", "coding", "admin"];

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  review: "Review",
  coding: "Coding",
  admin: "Admin",
};

export const DEFAULT_WORK_TYPE: WorkType = "coding";
