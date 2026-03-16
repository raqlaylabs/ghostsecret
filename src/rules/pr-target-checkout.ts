import type { LintRule } from "./types.js";
import type { WorkflowFile } from "../types.js";

const DANGEROUS_REFS = [
  "github.event.pull_request.head.ref",
  "github.event.pull_request.head.sha",
];

function hasUnsafeCheckout(workflow: WorkflowFile): boolean {
  for (const job of workflow.jobs) {
    for (const step of job.steps) {
      if (!step.uses || !step.uses.startsWith("actions/checkout")) continue;
      const ref = step.with?.ref;
      if (!ref) continue;
      if (DANGEROUS_REFS.some((d) => ref.includes(d))) return true;
    }
  }
  return false;
}

export const prTargetCheckout: LintRule = {
  id: "pr-target-checkout",
  description:
    "Detect dangerous pull_request_target + PR head checkout + secrets pattern",
  defaultSeverity: "error",

  check(context) {
    return context.workflows.flatMap((workflow) => {
      const hasPrTarget = workflow.triggers.some(
        (t) => t.event === "pull_request_target"
      );
      if (!hasPrTarget) return [];
      if (!hasUnsafeCheckout(workflow)) return [];

      const workflowSecrets = context.secretRefs.filter(
        (r) => r.filePath === workflow.filePath
      );
      if (workflowSecrets.length === 0) return [];

      return [
        {
          ruleId: this.id,
          severity: this.defaultSeverity,
          message:
            "Dangerous pattern: pull_request_target with PR head checkout and secrets. An attacker can submit a malicious PR that exfiltrates secrets.",
          filePath: workflow.filePath,
          suggestedFix:
            "Never checkout untrusted PR code in a pull_request_target workflow that has access to secrets. Use a two-workflow pattern: pull_request for untrusted code, then workflow_run for trusted operations with secrets.",
        },
      ];
    });
  },
};
