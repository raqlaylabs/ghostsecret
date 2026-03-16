import type { LintResult } from "../types.js";

export function reportJson(results: LintResult[]): number {
  console.log(JSON.stringify(results, null, 2));
  const errors = results.filter((r) => r.severity === "error").length;
  return errors > 0 ? 1 : 0;
}
