import type { LintResult } from "../types.js";

export function reportJson(results: LintResult[]): void {
  console.log(JSON.stringify(results, null, 2));
}
