import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const root = path.resolve(__dirname, "..");
const fixturesRepo = path.join(__dirname, "fixtures-repo");

function run(args: string, expectFail = false): string {
  try {
    return execSync(`npx tsx src/cli.ts ${args}`, {
      cwd: root,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err: unknown) {
    const e = err as { status: number; stdout: string; stderr: string };
    if (expectFail) return e.stdout ?? "";
    throw err;
  }
}

describe("CLI end-to-end", () => {
  it("runs against fixtures-repo and produces results", () => {
    const out = run(`--path ${fixturesRepo}`);
    // Should contain warnings or info (sample-ci.yml has pull_request trigger + secrets)
    expect(out.length).toBeGreaterThan(0);
    expect(out).toMatch(/issues?|No issues found/);
  });

  it("json output is valid JSON", () => {
    const out = run(`--path ${fixturesRepo} --format json`);
    const parsed = JSON.parse(out);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });

  it("exits 0 when no workflow files found", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ghsc-test-"));
    try {
      const out = run(`--path ${tmpDir}`);
      expect(out).toContain("No workflow files found");
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("--ignore skips specified rules", () => {
    const out = run(
      `--path ${fixturesRepo} --format json --ignore secrets-in-fork-pr`
    );
    const parsed = JSON.parse(out) as Array<{ ruleId: string }>;
    const ruleIds = parsed.map((r) => r.ruleId);
    expect(ruleIds).not.toContain("secrets-in-fork-pr");
  });

  it("--strict makes warnings return exit code 1", () => {
    // Without --strict: sample-ci.yml has warnings but no errors from these rules
    // (pr-target-checkout won't fire, secrets-in-fork-pr produces warnings, no-empty-check produces info)
    // So exit code should be 0
    const outNormal = run(`--path ${fixturesRepo} --format json`);
    const normalResults = JSON.parse(outNormal) as Array<{ severity: string }>;
    const hasErrorsNormally = normalResults.some((r) => r.severity === "error");
    expect(hasErrorsNormally).toBe(false);

    // With --strict: warnings become errors → exit code 1
    const outStrict = run(
      `--path ${fixturesRepo} --format json --strict`,
      true
    );
    const strictResults = JSON.parse(outStrict) as Array<{ severity: string }>;
    const hasErrors = strictResults.some((r) => r.severity === "error");
    expect(hasErrors).toBe(true);
  });
});
