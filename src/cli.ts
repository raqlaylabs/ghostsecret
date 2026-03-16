#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { parseWorkflow } from "./parser/workflow.js";
import { extractSecrets } from "./parser/secrets.js";
import { getAllRules } from "./rules/index.js";
import { reportTerminal } from "./reporters/terminal.js";
import { reportJson } from "./reporters/json.js";
import type { AnalysisContext, WorkflowFile, SecretReference, LintResult } from "./types.js";

const program = new Command();

program
  .name("gh-secrets-check")
  .description("Lint GitHub Actions workflows for secret misuse")
  .version("0.1.0")
  .option("--path <dir>", "Path to repo root", ".")
  .option("--format <type>", "Output format: terminal | json", "terminal")
  .option("--ignore <rules>", "Comma-separated rule IDs to skip")
  .option("--strict", "Treat warnings as errors")
  .action((opts) => {
    const repoRoot = path.resolve(opts.path);
    const workflowDir = path.join(repoRoot, ".github", "workflows");

    // Find workflow files
    let files: string[] = [];
    if (fs.existsSync(workflowDir)) {
      files = fs
        .readdirSync(workflowDir)
        .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
        .map((f) => path.join(workflowDir, f));
    }

    if (files.length === 0) {
      console.log(`No workflow files found in ${workflowDir}/`);
      process.exit(0);
    }

    // Parse all workflows
    const workflows: WorkflowFile[] = [];
    const secretRefs: SecretReference[] = [];

    for (const file of files) {
      try {
        const wf = parseWorkflow(file);
        workflows.push(wf);
        const refs = extractSecrets(wf.rawContent, file, wf);
        secretRefs.push(...refs);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`Warning: failed to parse ${file}: ${msg}`);
      }
    }

    // Build context and run rules
    const context: AnalysisContext = { workflows, secretRefs };
    const ignoreSet = new Set(
      opts.ignore ? opts.ignore.split(",").map((s: string) => s.trim()) : []
    );
    const rules = getAllRules().filter((r) => !ignoreSet.has(r.id));

    let results: LintResult[] = [];
    for (const rule of rules) {
      results.push(...rule.check(context));
    }

    // --strict: upgrade warnings to errors
    if (opts.strict) {
      results = results.map((r) =>
        r.severity === "warning" ? { ...r, severity: "error" as const } : r
      );
    }

    // Report
    let exitCode: number;
    if (opts.format === "json") {
      exitCode = reportJson(results);
    } else {
      exitCode = reportTerminal(results);
    }

    process.exit(exitCode);
  });

program.parse();
