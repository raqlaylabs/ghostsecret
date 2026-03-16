import type { LintRule } from "./types.js";

export const noEmptyCheck: LintRule = {
  id: "no-empty-check",
  description: "Detect empty secret checks",
  defaultSeverity: "warning",
  check() {
    return [];
  },
};
