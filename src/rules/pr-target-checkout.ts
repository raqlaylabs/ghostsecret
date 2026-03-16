import type { LintRule } from "./types.js";

export const prTargetCheckout: LintRule = {
  id: "pr-target-checkout",
  description: "Detect unsafe PR target checkouts",
  defaultSeverity: "error",
  check() {
    return [];
  },
};
