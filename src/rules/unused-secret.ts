import type { LintRule } from "./types.js";

export const unusedSecret: LintRule = {
  id: "unused-secret",
  description: "Detect secrets that are defined but never used",
  defaultSeverity: "info",

  check(context) {
    if (!context.repoSecrets) return [];

    const referenced = new Set(context.secretRefs.map((r) => r.name));

    return context.repoSecrets.flatMap((secretName) => {
      if (referenced.has(secretName)) return [];

      return [
        {
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Secret "${secretName}" is defined in repository but never referenced in any workflow`,
          filePath: "",
          secretName,
          suggestedFix:
            "Remove unused secret from Settings → Secrets and variables → Actions, or verify it's used in workflow files not yet scanned",
        },
      ];
    });
  },
};
