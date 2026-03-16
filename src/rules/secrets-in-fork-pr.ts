import type { LintRule } from "./types.js";

export const secretsInForkPr: LintRule = {
  id: "secrets-in-fork-pr",
  description:
    "Detect secrets used in workflows triggered by pull_request (empty on fork PRs)",
  defaultSeverity: "warning",

  check(context) {
    return context.secretRefs.flatMap((ref) => {
      // Find the workflow this secret belongs to
      const workflow = context.workflows.find(
        (w) => w.filePath === ref.filePath
      );
      if (!workflow) return [];

      // Only flag if pull_request is a trigger (not pull_request_target)
      const hasPrTrigger = workflow.triggers.some(
        (t) => t.event === "pull_request"
      );
      if (!hasPrTrigger) return [];

      return [
        {
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: "Secrets will be empty on fork PRs (trigger: pull_request)",
          filePath: ref.filePath,
          lineNumber: ref.lineNumber,
          secretName: ref.name,
          suggestedFix:
            "Split into two workflows: fork PRs (no secrets) + pull_request_target for trusted ops",
        },
      ];
    });
  },
};
