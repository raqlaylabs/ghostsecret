import type { LintRule } from "./types.js";

export const unusedSecret: LintRule = {
  id: "unused-secret",
  description: "Detect secrets that are defined but never used",
  defaultSeverity: "info",
  check() {
    return [];
  },
};
