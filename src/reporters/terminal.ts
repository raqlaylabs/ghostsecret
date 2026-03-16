import chalk from "chalk";
import path from "node:path";
import type { LintResult } from "../types.js";

const VERSION = "0.1.0";
const DIVIDER = chalk.gray("━".repeat(50));

const icons: Record<LintResult["severity"], string> = {
  error: chalk.red("✖"),
  warning: chalk.yellow("⚡"),
  info: chalk.blue("●"),
};

const ruleColor: Record<LintResult["severity"], (s: string) => string> = {
  error: chalk.red.bold,
  warning: chalk.yellow.bold,
  info: chalk.blue.bold,
};

interface SecretEntry {
  name: string;
  lineNumber?: number;
}

export function reportTerminal(results: LintResult[]): number {
  console.log(`  ${chalk.dim(`ghostsecret v${VERSION}`)}`);

  if (results.length === 0) {
    console.log();
    console.log(`  ${DIVIDER}`);
    console.log();
    console.log(`  ${chalk.gray("│")} ${chalk.green.bold("✔ All clear — no issues found")}`);
    console.log();
    return 0;
  }

  // Group by filePath → ruleId
  const byFile = new Map<string, Map<string, LintResult[]>>();
  for (const r of results) {
    let fileMap = byFile.get(r.filePath);
    if (!fileMap) {
      fileMap = new Map();
      byFile.set(r.filePath, fileMap);
    }
    let ruleList = fileMap.get(r.ruleId);
    if (!ruleList) {
      ruleList = [];
      fileMap.set(r.ruleId, ruleList);
    }
    ruleList.push(r);
  }

  for (const [filePath, ruleMap] of byFile) {
    const displayPath = path.basename(filePath);
    console.log();
    console.log(`  ${chalk.white.bold.underline(displayPath)}`);

    let first = true;
    for (const [_ruleId, ruleResults] of ruleMap) {
      if (!first) console.log();
      first = false;

      const severity = ruleResults[0].severity;
      const icon = icons[severity];
      const coloredRule = ruleColor[severity](ruleResults[0].ruleId);

      console.log();
      console.log(`    ${icon} ${coloredRule}`);
      console.log(`      ${ruleResults[0].message}`);

      // Collect secrets with deduplication and counts
      const entries: SecretEntry[] = ruleResults
        .filter((r) => r.secretName)
        .map((r) => ({ name: r.secretName!, lineNumber: r.lineNumber }));

      if (entries.length > 0) {
        // Build deduplicated secret display
        const counts = new Map<string, number>();
        for (const e of entries) {
          counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
        }
        const secretParts: string[] = [];
        for (const [name, count] of counts) {
          if (count > 1) {
            secretParts.push(`${chalk.cyan(name)} ${chalk.dim(`(×${count})`)}`);
          } else {
            secretParts.push(chalk.cyan(name));
          }
        }

        // Collect line numbers
        const lineNums = entries
          .filter((e) => e.lineNumber != null)
          .map((e) => String(e.lineNumber!));

        const label = chalk.dim("secrets:");
        const linesLabel = chalk.dim("lines:  ");

        console.log(`      ${label} ${secretParts.join("  ")}`);
        if (lineNums.length > 0) {
          console.log(`      ${linesLabel} ${chalk.dim(lineNums.join("  "))}`);
        }
      }

      // Show suggestion once per rule group
      const fix = ruleResults[0].suggestedFix;
      if (fix) {
        console.log(`      ${chalk.gray(`↳ ${fix}`)}`);
      }
    }
  }

  // Summary
  console.log();
  console.log(`  ${DIVIDER}`);
  console.log();

  const errors = results.filter((r) => r.severity === "error").length;
  const warnings = results.filter((r) => r.severity === "warning").length;
  const infos = results.filter((r) => r.severity === "info").length;

  const errStr = errors > 0 ? chalk.red.bold(`${errors} errors`) : chalk.green(`${errors} errors`);
  const warnStr = warnings > 0 ? chalk.yellow(`${warnings} warnings`) : chalk.dim(`${warnings} warnings`);
  const infoStr = infos > 0 ? chalk.blue(`${infos} info`) : chalk.dim(`${infos} info`);
  const bar = chalk.gray("│");

  console.log(`  ${bar} ${chalk.bold(`${results.length} issues`)}   ${errStr}   ${warnStr}   ${infoStr}`);
  console.log(`  ${bar}`);
  console.log(`  ${bar} ${chalk.gray("Run with --format json for CI-friendly output")}`);
  console.log();

  return errors > 0 ? 1 : 0;
}
