import type { LintRule } from "./types.js";
import { secretsInForkPr } from "./secrets-in-fork-pr.js";
import { prTargetCheckout } from "./pr-target-checkout.js";
import { noEmptyCheck } from "./no-empty-check.js";
import { undefinedSecret } from "./undefined-secret.js";
import { unusedSecret } from "./unused-secret.js";

export function getAllRules(): LintRule[] {
  return [
    secretsInForkPr,
    prTargetCheckout,
    noEmptyCheck,
    undefinedSecret,
    unusedSecret,
  ];
}
