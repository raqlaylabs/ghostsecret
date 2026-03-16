import type { SecretReference, WorkflowFile } from "../types.js";

export function extractSecrets(
  content: string,
  filePath: string,
  workflow: WorkflowFile
): SecretReference[] {
  const refs: SecretReference[] = [];
  const lines = content.split("\n");

  // Match secrets.NAME within ${{ ... }} expressions.
  // We use a simple pattern that finds secrets.NAME anywhere in the content,
  // then verify it's inside a ${{ }} expression.
  const regex = /secrets\.([A-Za-z_][A-Za-z0-9_]*)/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1];
    const offset = match.index;

    // Verify this is inside a ${{ }} expression
    const before = content.lastIndexOf("${{", offset);
    if (before === -1) continue;
    const after = content.indexOf("}}", offset);
    if (after === -1) continue;
    // Make sure there's no }} between ${{ and our match (i.e., we're inside the expression)
    const between = content.slice(before + 3, offset);
    if (between.includes("}}")) continue;

    // Skip commented-out lines
    const lineStart = content.lastIndexOf("\n", offset) + 1;
    const lineText = content.slice(lineStart, offset);
    if (lineText.trimStart().startsWith("#")) continue;

    // Calculate line number and column
    const prefix = content.slice(0, offset);
    const lineNumber = prefix.split("\n").length;
    const lastNewline = prefix.lastIndexOf("\n");
    const column = offset - lastNewline; // 1-based column

    // Determine context by looking at surrounding lines
    const context = determineContext(lines, lineNumber - 1);

    // Determine jobId and stepIndex from workflow structure
    const { jobId, stepIndex } = findLocation(workflow, lineNumber);

    refs.push({
      name,
      filePath,
      lineNumber,
      column,
      context,
      jobId,
      stepIndex,
      triggers: workflow.triggers,
    });
  }

  return refs;
}

function determineContext(
  lines: string[],
  lineIdx: number
): SecretReference["context"] {
  const line = lines[lineIdx];
  if (!line) return "other";

  const trimmed = line.trimStart();

  // Direct if: field on this line
  if (trimmed.startsWith("if:")) return "if";

  // Check if this line is a key: value under env: or with:
  // Walk backwards to find the parent block
  const lineIndent = line.search(/\S/);

  for (let i = lineIdx - 1; i >= 0; i--) {
    const prev = lines[i];
    if (prev.trim() === "") continue;
    const prevIndent = prev.search(/\S/);

    // Parent key should be at a lesser indent
    if (prevIndent < lineIndent) {
      const prevTrimmed = prev.trimStart();
      if (prevTrimmed.startsWith("env:")) return "env";
      if (prevTrimmed.startsWith("with:")) return "with";
      if (prevTrimmed.startsWith("run:") || prevTrimmed.startsWith("run |") || prevTrimmed.startsWith("run:")) return "run";
      if (prevTrimmed.startsWith("if:")) return "if";
      break;
    }

    // Same indent means sibling — check if we're inside an env/with block
    if (prevIndent === lineIndent) {
      // Keep looking up for the parent
      continue;
    }
  }

  // Check if the secret is inline on an env/with/run/if line
  if (trimmed.startsWith("run:") || trimmed.startsWith("run |")) return "run";

  return "other";
}

function findLocation(
  workflow: WorkflowFile,
  lineNumber: number
): { jobId?: string; stepIndex?: number } {
  for (const job of workflow.jobs) {
    for (let i = 0; i < job.steps.length; i++) {
      const step = job.steps[i];
      if (step.lineNumber <= 0) continue;

      // Check if this line falls within this step's raw content range
      const stepEndLine =
        step.lineNumber + step.rawContent.split("\n").length - 1;

      if (lineNumber >= step.lineNumber && lineNumber <= stepEndLine) {
        return { jobId: job.id, stepIndex: i };
      }
    }

    // If not in any step, check if it's in the job's scope at all
    // by checking if it's between first and last step
    if (job.steps.length > 0) {
      const firstStep = job.steps[0];
      const lastStep = job.steps[job.steps.length - 1];
      const lastStepEnd =
        lastStep.lineNumber + lastStep.rawContent.split("\n").length - 1;
      if (
        firstStep.lineNumber > 0 &&
        lineNumber >= firstStep.lineNumber &&
        lineNumber <= lastStepEnd
      ) {
        return { jobId: job.id };
      }
    }
  }

  return {};
}
