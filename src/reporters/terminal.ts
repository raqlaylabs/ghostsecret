import chalk from "chalk";
import type { LintResult } from "../types.js";

const icons: Record<LintResult["severity"], string> = {
  error: chalk.red("✗"),
  warning: chalk.yellow("⚠"),
  info: chalk.blue("ℹ"),
};

export function reportTerminal(results: LintResult[]): number {
  if (results.length === 0) {
    console.log(chalk.green("✓ No issues found"));
    return 0;
  }

  // Group by filePath
  const grouped = new Map<string, LintResult[]>();
  for (const r of results) {
    let list = grouped.get(r.filePath);
    if (!list) {
      list = [];
      grouped.set(r.filePath, list);
    }
    list.push(r);
  }

  for (const [filePath, fileResults] of grouped) {
    console.log(chalk.bold(filePath));
    for (const r of fileResults) {
      const icon = icons[r.severity];
      const line = r.lineNumber != null ? chalk.dim(`line ${r.lineNumber}: `) : "";
      const secret = r.secretName ? chalk.bold(r.secretName) + " — " : "";
      console.log(`  ${icon} ${line}${secret}${r.message}`);
      if (r.suggestedFix) {
        console.log(`     ${chalk.dim("→ " + r.suggestedFix)}`);
      }
    }
    console.log();
  }

  const errors = results.filter((r) => r.severity === "error").length;
  const warnings = results.filter((r) => r.severity === "warning").length;
  const infos = results.filter((r) => r.severity === "info").length;
  console.log(
    `${results.length} issues (${errors} ${errors === 1 ? "error" : "errors"}, ${warnings} ${warnings === 1 ? "warning" : "warnings"}, ${infos} info)`
  );

  return errors > 0 ? 1 : 0;
}
