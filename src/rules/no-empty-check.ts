import type { LintRule } from "./types.js";

export const noEmptyCheck: LintRule = {
  id: "no-empty-check",
  description: "Detect secrets used without an empty-string guard",
  defaultSeverity: "info",

  check(context) {
    return context.secretRefs.flatMap((ref) => {
      // If the secret reference IS inside an if: expression, it's already a check
      if (ref.context === "if") return [];

      const workflow = context.workflows.find(
        (w) => w.filePath === ref.filePath
      );
      if (!workflow) return [];

      // Find the job and step this secret belongs to
      const job = ref.jobId
        ? workflow.jobs.find((j) => j.id === ref.jobId)
        : undefined;
      const step =
        job && ref.stepIndex != null ? job.steps[ref.stepIndex] : undefined;

      // Check if the step has an if: guard referencing this secret
      if (step?.if && step.if.includes(`secrets.${ref.name}`)) return [];

      // Check if the job has an if: guard referencing this secret
      if (job?.if && job.if.includes(`secrets.${ref.name}`)) return [];

      return [
        {
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Secret "${ref.name}" is used without an empty-string check. If this secret is unavailable (e.g., fork PRs, missing config), the step will run with an empty value and may fail with a misleading error.`,
          filePath: ref.filePath,
          lineNumber: ref.lineNumber,
          secretName: ref.name,
          suggestedFix: `Add a condition: if: \${{ secrets.${ref.name} != '' }}`,
        },
      ];
    });
  },
};
