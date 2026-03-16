import type { AnalysisContext, LintResult } from "../types.js";

export interface LintRule {
  id: string;
  description: string;
  defaultSeverity: "error" | "warning" | "info";
  check(context: AnalysisContext): LintResult[];
}
