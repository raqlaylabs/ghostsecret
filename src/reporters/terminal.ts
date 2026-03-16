import type { LintResult } from "../types.js";

export function reportTerminal(results: LintResult[]): void {
  console.log(`TODO: report ${results.length} results to terminal`);
}
