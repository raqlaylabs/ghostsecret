import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { parseWorkflow } from "../src/parser/workflow.js";
import { extractSecrets } from "../src/parser/secrets.js";
import { secretsInForkPr } from "../src/rules/secrets-in-fork-pr.js";
import { prTargetCheckout } from "../src/rules/pr-target-checkout.js";
import { noEmptyCheck } from "../src/rules/no-empty-check.js";
import { undefinedSecret } from "../src/rules/undefined-secret.js";
import { unusedSecret } from "../src/rules/unused-secret.js";
import type { AnalysisContext, WorkflowFile, SecretReference } from "../src/types.js";

const fixtures = path.resolve(__dirname, "fixtures");

function buildContext(name: string): AnalysisContext {
  const filePath = path.join(fixtures, name);
  const content = fs.readFileSync(filePath, "utf-8");
  const wf = parseWorkflow(filePath);
  const refs = extractSecrets(content, filePath, wf);
  return { workflows: [wf], secretRefs: refs };
}

// ── secrets-in-fork-pr ──────────────────────────────────────────────────

describe("secrets-in-fork-pr", () => {
  it("flags secrets in pull_request triggered workflow", () => {
    const ctx = buildContext("sample-ci.yml");
    const results = secretsInForkPr.check(ctx);
    // sample-ci.yml has pull_request trigger and 6 secret refs
    expect(results).toHaveLength(6);
    expect(results.every((r) => r.severity === "warning")).toBe(true);
  });

  it("does NOT flag push-only workflows", () => {
    const ctx = buildContext("simple-push.yml");
    const results = secretsInForkPr.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("does NOT flag pull_request_target workflows", () => {
    const ctx = buildContext("pr-target.yml");
    const results = secretsInForkPr.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("flags secrets in workflow with mixed triggers including pull_request", () => {
    const ctx = buildContext("edge-cases.yml");
    const results = secretsInForkPr.check(ctx);
    // edge-cases.yml has pull_request among its triggers and 12 secret refs
    expect(results.length).toBe(ctx.secretRefs.length);
    expect(results.length).toBeGreaterThan(0);
  });
});

// ── pr-target-checkout ──────────────────────────────────────────────────

describe("pr-target-checkout", () => {
  it("flags the dangerous pattern in pr-target.yml", () => {
    const ctx = buildContext("pr-target.yml");
    const results = prTargetCheckout.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe("error");
  });

  it("does NOT flag pull_request_target without checkout of PR head", () => {
    // Construct a synthetic workflow: pull_request_target, checkout without ref, secrets present
    const workflow: WorkflowFile = {
      filePath: "synthetic.yml",
      triggers: [{ event: "pull_request_target" }],
      jobs: [
        {
          id: "build",
          steps: [
            { uses: "actions/checkout@v4", rawContent: "", lineNumber: 1 },
            { run: "echo done", rawContent: "", lineNumber: 2 },
          ],
        },
      ],
      rawContent: "",
    };
    const secretRefs: SecretReference[] = [
      {
        name: "TOKEN",
        filePath: "synthetic.yml",
        lineNumber: 2,
        column: 1,
        context: "env",
        triggers: workflow.triggers,
      },
    ];
    const results = prTargetCheckout.check({
      workflows: [workflow],
      secretRefs,
    });
    expect(results).toHaveLength(0);
  });

  it("does NOT flag pull_request_target with checkout but no secrets", () => {
    const workflow: WorkflowFile = {
      filePath: "synthetic.yml",
      triggers: [{ event: "pull_request_target" }],
      jobs: [
        {
          id: "build",
          steps: [
            {
              uses: "actions/checkout@v4",
              with: { ref: "${{ github.event.pull_request.head.ref }}" },
              rawContent: "",
              lineNumber: 1,
            },
          ],
        },
      ],
      rawContent: "",
    };
    const results = prTargetCheckout.check({
      workflows: [workflow],
      secretRefs: [],
    });
    expect(results).toHaveLength(0);
  });

  it("does NOT flag regular pull_request workflows", () => {
    const ctx = buildContext("sample-ci.yml");
    const results = prTargetCheckout.check(ctx);
    expect(results).toHaveLength(0);
  });
});

// ── no-empty-check ──────────────────────────────────────────────────────

describe("no-empty-check", () => {
  it("flags secrets without guards in simple-push.yml", () => {
    const ctx = buildContext("simple-push.yml");
    const results = noEmptyCheck.check(ctx);
    // BUILD_KEY has no if: condition
    expect(results).toHaveLength(1);
    expect(results[0].secretName).toBe("BUILD_KEY");
  });

  it("does NOT flag secrets that are inside an if: expression", () => {
    const ctx = buildContext("sample-ci.yml");
    const results = noEmptyCheck.check(ctx);
    // DEPLOY_TOKEN in if: context should not be flagged
    const deployIfResults = results.filter(
      (r) => r.secretName === "DEPLOY_TOKEN"
    );
    // The if: reference is skipped; the with: reference is guarded by the step's if:
    expect(deployIfResults).toHaveLength(0);
  });

  it("flags secrets in env/with that lack a step-level if: guard", () => {
    const ctx = buildContext("sample-ci.yml");
    const results = noEmptyCheck.check(ctx);
    const flaggedNames = results.map((r) => r.secretName);
    expect(flaggedNames).toContain("API_KEY");
    expect(flaggedNames).toContain("DATABASE_URL");
  });

  it("does NOT flag when step has an if: that references the same secret", () => {
    const ctx = buildContext("sample-ci.yml");
    const results = noEmptyCheck.check(ctx);
    // DEPLOY_TOKEN in with: block — its step has if: checking DEPLOY_TOKEN
    const deployWithResults = results.filter(
      (r) => r.secretName === "DEPLOY_TOKEN"
    );
    expect(deployWithResults).toHaveLength(0);
  });

  it("flags all unguarded secrets in edge-cases.yml", () => {
    const ctx = buildContext("edge-cases.yml");
    const results = noEmptyCheck.check(ctx);
    // All 12 refs: 2 are if: context (JOB_GATE, NESTED_CHECK in if:) → skipped
    // NESTED_CHECK in env: is guarded by step if: referencing secrets.NESTED_CHECK → skipped
    // That leaves 9 unguarded secrets
    const flaggedNames = results.map((r) => r.secretName);
    expect(flaggedNames).not.toContain("JOB_GATE");
    expect(results).toHaveLength(9);
  });
});

// ── undefined-secret ────────────────────────────────────────────────────

describe("undefined-secret", () => {
  function makeCtx(
    refNames: string[],
    repoSecrets?: string[]
  ): AnalysisContext {
    const workflow: WorkflowFile = {
      filePath: "test.yml",
      triggers: [{ event: "push" }],
      jobs: [],
      rawContent: "",
    };
    const secretRefs: SecretReference[] = refNames.map((name, i) => ({
      name,
      filePath: "test.yml",
      lineNumber: i + 1,
      column: 1,
      context: "env" as const,
      triggers: workflow.triggers,
    }));
    return { workflows: [workflow], secretRefs, repoSecrets };
  }

  it("flags secrets not in repo when repoSecrets is provided", () => {
    const ctx = makeCtx(["API_KEY", "DATABASE_URL", "TYPO_KEY"], [
      "API_KEY",
      "DATABASE_URL",
    ]);
    const results = undefinedSecret.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].secretName).toBe("TYPO_KEY");
    expect(results[0].severity).toBe("error");
  });

  it("suggests fuzzy match for typos", () => {
    const ctx = makeCtx(["SUPABASE_KY"], ["SUPABASE_KEY"]);
    const results = undefinedSecret.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].suggestedFix).toContain("Did you mean");
    expect(results[0].suggestedFix).toContain("SUPABASE_KEY");
  });

  it("does not suggest match when distance > 2", () => {
    const ctx = makeCtx(["API_KEY"], ["COMPLETELY_DIFFERENT"]);
    const results = undefinedSecret.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].suggestedFix).not.toContain("Did you mean");
  });

  it("skips entirely when repoSecrets is undefined", () => {
    const ctx = makeCtx(["API_KEY"], undefined);
    const results = undefinedSecret.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("does not flag secrets that are defined", () => {
    const ctx = makeCtx(["API_KEY", "DB_URL"], ["API_KEY", "DB_URL"]);
    const results = undefinedSecret.check(ctx);
    expect(results).toHaveLength(0);
  });
});

// ── unused-secret ───────────────────────────────────────────────────────

describe("unused-secret", () => {
  function makeCtx(
    refNames: string[],
    repoSecrets?: string[]
  ): AnalysisContext {
    const workflow: WorkflowFile = {
      filePath: "test.yml",
      triggers: [{ event: "push" }],
      jobs: [],
      rawContent: "",
    };
    const secretRefs: SecretReference[] = refNames.map((name, i) => ({
      name,
      filePath: "test.yml",
      lineNumber: i + 1,
      column: 1,
      context: "env" as const,
      triggers: workflow.triggers,
    }));
    return { workflows: [workflow], secretRefs, repoSecrets };
  }

  it("flags defined secrets not referenced in any workflow", () => {
    const ctx = makeCtx(["API_KEY", "DB_URL"], [
      "API_KEY",
      "OLD_TOKEN",
      "DB_URL",
    ]);
    const results = unusedSecret.check(ctx);
    expect(results).toHaveLength(1);
    expect(results[0].secretName).toBe("OLD_TOKEN");
    expect(results[0].severity).toBe("info");
  });

  it("skips when repoSecrets is undefined", () => {
    const ctx = makeCtx(["API_KEY"], undefined);
    const results = unusedSecret.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("returns nothing when all secrets are used", () => {
    const ctx = makeCtx(["API_KEY"], ["API_KEY"]);
    const results = unusedSecret.check(ctx);
    expect(results).toHaveLength(0);
  });

  it("handles case sensitivity correctly", () => {
    // GitHub secrets are uppercase; references are case-sensitive
    const ctx = makeCtx(["api_key"], ["API_KEY"]);
    const results = unusedSecret.check(ctx);
    // API_KEY is not referenced (api_key !== API_KEY) → flagged as unused
    expect(results).toHaveLength(1);
    expect(results[0].secretName).toBe("API_KEY");
  });
});
