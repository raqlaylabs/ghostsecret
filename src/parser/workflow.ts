import fs from "node:fs";
import yaml from "js-yaml";
import type {
  WorkflowFile,
  WorkflowJob,
  WorkflowStep,
  TriggerEvent,
} from "../types.js";

export function parseWorkflow(filePath: string): WorkflowFile {
  const rawContent = fs.readFileSync(filePath, "utf-8");
  const doc = yaml.load(rawContent) as Record<string, unknown> | null;

  if (!doc || typeof doc !== "object") {
    return { filePath, triggers: [], jobs: [], rawContent };
  }

  const name = typeof doc.name === "string" ? doc.name : undefined;
  const triggers = parseTriggers(doc.on ?? doc.true);
  const jobs = parseJobs(doc.jobs, rawContent);
  const env = parseEnv(doc.env);

  return { filePath, name, triggers, jobs, env, rawContent };
}

function parseTriggers(on: unknown): TriggerEvent[] {
  if (on == null) return [];

  // on: push
  if (typeof on === "string") {
    return [{ event: on }];
  }

  // on: [push, pull_request]
  if (Array.isArray(on)) {
    return on.map((e) => ({ event: String(e) }));
  }

  // on: { pull_request: { branches: [main], types: [opened] } }
  if (typeof on === "object") {
    const record = on as Record<string, unknown>;
    return Object.entries(record).map(([event, config]) => {
      const trigger: TriggerEvent = { event };
      if (config && typeof config === "object") {
        const cfg = config as Record<string, unknown>;
        if (Array.isArray(cfg.branches)) {
          trigger.branches = cfg.branches.map(String);
        }
        if (Array.isArray(cfg.types)) {
          trigger.types = cfg.types.map(String);
        }
      }
      return trigger;
    });
  }

  return [];
}

function parseJobs(
  jobs: unknown,
  rawContent: string
): WorkflowJob[] {
  if (!jobs || typeof jobs !== "object") return [];

  const lines = rawContent.split("\n");
  const record = jobs as Record<string, unknown>;

  return Object.entries(record).map(([id, jobDef]) => {
    const job: WorkflowJob = { id, steps: [] };
    if (!jobDef || typeof jobDef !== "object") return job;

    const def = jobDef as Record<string, unknown>;
    if (typeof def.name === "string") job.name = def.name;
    if (typeof def["runs-on"] === "string") job.runsOn = def["runs-on"];
    if (typeof def.if === "string") job.if = def.if;
    job.env = parseEnv(def.env);

    if (Array.isArray(def.steps)) {
      job.steps = def.steps.map((stepDef: unknown, index: number) =>
        parseStep(stepDef, lines, id, index, rawContent)
      );
    }

    return job;
  });
}

function parseStep(
  stepDef: unknown,
  lines: string[],
  _jobId: string,
  stepIndex: number,
  rawContent: string
): WorkflowStep {
  const step: WorkflowStep = { rawContent: "", lineNumber: 0 };
  if (!stepDef || typeof stepDef !== "object") return step;

  const def = stepDef as Record<string, unknown>;
  if (typeof def.name === "string") step.name = def.name;
  if (typeof def.uses === "string") step.uses = def.uses;
  if (typeof def.run === "string") step.run = def.run;
  if (typeof def.if === "string") step.if = def.if;
  step.env = parseEnv(def.env);
  step.with = parseEnv(def.with);

  // Find line number for this step
  step.lineNumber = findStepLine(def, lines, stepIndex, rawContent);

  // Extract raw content for this step
  step.rawContent = extractStepRaw(lines, step.lineNumber);

  return step;
}

/**
 * Find the line where a step starts by searching for its identifying marker
 * (name, uses, or run) in the raw YAML lines. We track a search offset to
 * handle multiple steps that share the same marker text.
 */
let stepSearchOffset = 0;

function findStepLine(
  def: Record<string, unknown>,
  lines: string[],
  stepIndex: number,
  _rawContent: string
): number {
  // Reset offset when starting a new job's steps
  if (stepIndex === 0) {
    stepSearchOffset = 0;
  }

  // Build candidate patterns to search for
  const patterns: string[] = [];
  if (typeof def.name === "string") {
    patterns.push(`- name: ${def.name}`, `- name: "${def.name}"`, `- name: '${def.name}'`);
  }
  if (typeof def.uses === "string") {
    patterns.push(`- uses: ${def.uses}`, `- uses: "${def.uses}"`, `- uses: '${def.uses}'`);
  }
  if (typeof def.run === "string") {
    patterns.push("- run:");
  }

  for (let i = stepSearchOffset; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    for (const pattern of patterns) {
      if (trimmed.startsWith(pattern) || trimmed === pattern) {
        stepSearchOffset = i + 1;
        return i + 1; // 1-based line numbers
      }
    }
  }

  return 0;
}

/**
 * Extract the raw YAML for a step starting from its first line,
 * ending before the next step (line starting with `- ` at same indent) or
 * a less-indented line.
 */
function extractStepRaw(lines: string[], startLine1Based: number): string {
  if (startLine1Based <= 0) return "";
  const startIdx = startLine1Based - 1;
  const firstLine = lines[startIdx];
  const indent = firstLine.search(/\S/);

  const resultLines = [firstLine];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    // Empty lines are included
    if (line.trim() === "") {
      resultLines.push(line);
      continue;
    }
    const lineIndent = line.search(/\S/);
    // If we hit same or lesser indent with a `- ` list marker, stop
    if (lineIndent <= indent && line.trimStart().startsWith("- ")) break;
    // If indent is less than our step's content indent, stop
    if (lineIndent < indent) break;
    resultLines.push(line);
  }

  return resultLines.join("\n");
}

function parseEnv(env: unknown): Record<string, string> | undefined {
  if (!env || typeof env !== "object") return undefined;
  const record = env as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    result[key] = String(value);
  }
  return result;
}
