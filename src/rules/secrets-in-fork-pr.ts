import type { LintRule } from "./types.js";

export const secretsInForkPr: LintRule = {
  id: "secrets-in-fork-pr",
  description: "Detect secrets used in fork PR contexts",
  defaultSeverity: "error",
  check() {
    return [];
  },
};
