import type { LintResult } from "../types.js";

export interface Reporter {
  name: string;
  report(results: LintResult[]): void;
}
