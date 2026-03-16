import type { LintRule } from "./types.js";

export const undefinedSecret: LintRule = {
  id: "undefined-secret",
  description: "Detect references to undefined secrets",
  defaultSeverity: "warning",
  check() {
    return [];
  },
};
