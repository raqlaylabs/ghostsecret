import type { LintRule } from "./types.js";
import { levenshteinDistance } from "../utils/levenshtein.js";

export const undefinedSecret: LintRule = {
  id: "undefined-secret",
  description: "Detect references to undefined secrets",
  defaultSeverity: "error",

  check(context) {
    if (!context.repoSecrets) return [];

    const defined = new Set(context.repoSecrets);

    return context.secretRefs.flatMap((ref) => {
      if (defined.has(ref.name)) return [];

      // Fuzzy match for typo suggestions
      let suggestedFix: string;
      const closest = findClosest(ref.name, context.repoSecrets!);
      if (closest) {
        suggestedFix = `Did you mean "${closest}"?`;
      } else {
        suggestedFix =
          "Add this secret in repo Settings → Secrets and variables → Actions";
      }

      return [
        {
          ruleId: this.id,
          severity: this.defaultSeverity,
          message: `Secret "${ref.name}" is referenced but not defined in repository secrets`,
          filePath: ref.filePath,
          lineNumber: ref.lineNumber,
          secretName: ref.name,
          suggestedFix,
        },
      ];
    });
  },
};

function findClosest(
  name: string,
  candidates: string[]
): string | null {
  let best: string | null = null;
  let bestDist = Infinity;

  for (const candidate of candidates) {
    const dist = levenshteinDistance(name, candidate);
    if (dist <= 2 && dist < bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }

  return best;
}
