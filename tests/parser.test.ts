import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { parseWorkflow } from "../src/parser/workflow.js";
import { extractSecrets } from "../src/parser/secrets.js";

const fixtures = path.resolve(__dirname, "fixtures");

// Helper to parse and extract secrets from a fixture
function loadFixture(name: string) {
  const filePath = path.join(fixtures, name);
  const content = fs.readFileSync(filePath, "utf-8");
  const wf = parseWorkflow(filePath);
  const refs = extractSecrets(content, filePath, wf);
  return { filePath, content, wf, refs };
}

// ── Existing tests ──────────────────────────────────────────────────────

describe("parseWorkflow", () => {
  it("parses trigger events correctly from sample-ci.yml", () => {
    const wf = parseWorkflow(path.join(fixtures, "sample-ci.yml"));
    expect(wf.triggers).toHaveLength(2);

    const prTrigger = wf.triggers.find((t) => t.event === "pull_request");
    expect(prTrigger).toBeDefined();
    expect(prTrigger!.branches).toEqual(["main"]);

    const pushTrigger = wf.triggers.find((t) => t.event === "push");
    expect(pushTrigger).toBeDefined();
  });

  it("parses jobs and steps from sample-ci.yml", () => {
    const wf = parseWorkflow(path.join(fixtures, "sample-ci.yml"));
    expect(wf.jobs).toHaveLength(2);

    const testJob = wf.jobs.find((j) => j.id === "test");
    expect(testJob).toBeDefined();
    expect(testJob!.steps).toHaveLength(3);

    const lintJob = wf.jobs.find((j) => j.id === "lint");
    expect(lintJob).toBeDefined();
    expect(lintJob!.steps).toHaveLength(1);
  });

  it("parses pull_request_target trigger from pr-target.yml", () => {
    const wf = parseWorkflow(path.join(fixtures, "pr-target.yml"));
    expect(wf.triggers).toHaveLength(1);
    expect(wf.triggers[0].event).toBe("pull_request_target");
    expect(wf.triggers[0].types).toEqual(["opened", "synchronize"]);
  });

  it("parses simple string trigger from simple-push.yml", () => {
    const wf = parseWorkflow(path.join(fixtures, "simple-push.yml"));
    expect(wf.triggers).toHaveLength(1);
    expect(wf.triggers[0].event).toBe("push");
  });
});

describe("extractSecrets", () => {
  it("finds all secret references in sample-ci.yml", () => {
    const { refs } = loadFixture("sample-ci.yml");

    const names = refs.map((r) => r.name);
    expect(names).toContain("GLOBAL_TOKEN");
    expect(names).toContain("API_KEY");
    expect(names).toContain("DATABASE_URL");
    expect(names).toContain("LINT_KEY");

    const deployRefs = refs.filter((r) => r.name === "DEPLOY_TOKEN");
    expect(deployRefs).toHaveLength(2);

    expect(refs).toHaveLength(6);
  });

  it("identifies correct line numbers", () => {
    const { refs } = loadFixture("sample-ci.yml");

    for (const ref of refs) {
      expect(ref.lineNumber).toBeGreaterThan(0);
    }
  });

  it("identifies correct context for each secret", () => {
    const { refs } = loadFixture("sample-ci.yml");

    const globalToken = refs.find((r) => r.name === "GLOBAL_TOKEN");
    expect(globalToken?.context).toBe("env");

    const apiKey = refs.find((r) => r.name === "API_KEY");
    expect(apiKey?.context).toBe("env");

    const deployInWith = refs.find(
      (r) => r.name === "DEPLOY_TOKEN" && r.context === "with"
    );
    expect(deployInWith).toBeDefined();
  });

  it("finds secret in pr-target.yml", () => {
    const { refs } = loadFixture("pr-target.yml");

    expect(refs).toHaveLength(1);
    expect(refs[0].name).toBe("SENSITIVE_TOKEN");
    expect(refs[0].triggers[0].event).toBe("pull_request_target");
  });

  it("finds secret in simple-push.yml", () => {
    const { refs } = loadFixture("simple-push.yml");

    expect(refs).toHaveLength(1);
    expect(refs[0].name).toBe("BUILD_KEY");
  });
});

// ── New edge-case tests ─────────────────────────────────────────────────

describe("parseWorkflow - edge cases", () => {
  it("parses array trigger from edge-cases.yml", () => {
    const { wf } = loadFixture("edge-cases.yml");
    expect(wf.triggers).toHaveLength(3);
    const events = wf.triggers.map((t) => t.event);
    expect(events).toContain("push");
    expect(events).toContain("pull_request");
    expect(events).toContain("workflow_dispatch");
  });

  it("handles job with no steps from edge-cases.yml", () => {
    const { wf } = loadFixture("edge-cases.yml");
    const noStepsJob = wf.jobs.find((j) => j.id === "no-steps-job");
    expect(noStepsJob).toBeDefined();
    expect(noStepsJob!.steps).toEqual([]);
  });

  it("handles empty workflow with no jobs from empty-workflow.yml", () => {
    const { wf } = loadFixture("empty-workflow.yml");
    expect(wf.jobs).toEqual([]);
  });

  it("extracts job-level env from edge-cases.yml", () => {
    const { wf } = loadFixture("edge-cases.yml");
    const job = wf.jobs.find((j) => j.id === "spacing-hell");
    expect(job).toBeDefined();
    expect(job!.env).toBeDefined();
    expect(Object.keys(job!.env!)).toContain("JOB_SECRET");
  });

  it("extracts job-level if condition from edge-cases.yml", () => {
    const { wf } = loadFixture("edge-cases.yml");
    const job = wf.jobs.find((j) => j.id === "conditional-secrets");
    expect(job).toBeDefined();
    expect(job!.if).toBeDefined();
  });

  it("handles multiline run blocks from edge-cases.yml", () => {
    const { wf } = loadFixture("edge-cases.yml");
    const job = wf.jobs.find((j) => j.id === "spacing-hell");
    const multilineStep = job!.steps.find((s) => s.name === "Multiline run");
    expect(multilineStep).toBeDefined();
    expect(multilineStep!.run).toContain("curl");
    expect(multilineStep!.run).toContain("export");
  });

  it("parses all trigger formats from trigger-formats.yml", () => {
    const { wf } = loadFixture("trigger-formats.yml");
    expect(wf.triggers).toHaveLength(5);

    const events = wf.triggers.map((t) => t.event);
    expect(events).toContain("push");
    expect(events).toContain("pull_request");
    expect(events).toContain("schedule");
    expect(events).toContain("workflow_dispatch");
    expect(events).toContain("workflow_call");

    const push = wf.triggers.find((t) => t.event === "push");
    expect(push!.branches).toEqual(["main", "develop"]);

    const pr = wf.triggers.find((t) => t.event === "pull_request");
    expect(pr!.types).toEqual(["opened", "synchronize", "reopened"]);
  });

  it("throws descriptive error for invalid YAML", () => {
    const tmpFile = path.join(os.tmpdir(), "invalid-workflow.yml");
    fs.writeFileSync(tmpFile, "{{invalid yaml: [");
    try {
      expect(() => parseWorkflow(tmpFile)).toThrow();
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });

  it("throws for missing file", () => {
    expect(() => parseWorkflow("/nonexistent/path/fake.yml")).toThrow();
  });
});

describe("extractSecrets - edge cases", () => {
  describe("zero and boundary cases", () => {
    it("finds zero secrets in no-secrets.yml", () => {
      const { refs } = loadFixture("no-secrets.yml");
      expect(refs).toHaveLength(0);
    });

    it("handles empty-workflow.yml without crashing", () => {
      const { refs } = loadFixture("empty-workflow.yml");
      expect(refs).toHaveLength(0);
    });
  });

  describe("spacing variations", () => {
    it("finds secrets with no spaces: ${{secrets.X}}", () => {
      const { refs } = loadFixture("edge-cases.yml");
      const names = refs.map((r) => r.name);
      expect(names).toContain("NO_SPACES");
    });

    it("finds secrets with excessive spaces: ${{   secrets.X   }}", () => {
      const { refs } = loadFixture("edge-cases.yml");
      const names = refs.map((r) => r.name);
      expect(names).toContain("LOTS_OF_SPACES");
    });

    it("finds secrets with mixed spacing: ${{ secrets.X}}", () => {
      const { refs } = loadFixture("edge-cases.yml");
      const names = refs.map((r) => r.name);
      expect(names).toContain("MIXED_SPACES");
    });
  });

  describe("complex patterns", () => {
    it("finds multiple secrets on the same line", () => {
      const { refs } = loadFixture("edge-cases.yml");
      const names = refs.map((r) => r.name);
      expect(names).toContain("LEFT_SECRET");
      expect(names).toContain("RIGHT_SECRET");
    });

    it("finds secrets inside multiline run: | blocks", () => {
      const { refs } = loadFixture("edge-cases.yml");
      const names = refs.map((r) => r.name);
      expect(names).toContain("MULTILINE_SECRET");
      expect(names).toContain("BEARER_TOKEN");
    });

    it("finds two secrets in string interpolation on COMBO line", () => {
      const { refs } = loadFixture("edge-cases.yml");
      const names = refs.map((r) => r.name);
      expect(names).toContain("FIRST");
      expect(names).toContain("SECOND");
    });

    it("finds secrets in job-level if conditions", () => {
      const { refs } = loadFixture("edge-cases.yml");
      const names = refs.map((r) => r.name);
      expect(names).toContain("JOB_GATE");
    });

    it("finds duplicate secret names used in different contexts", () => {
      const { refs } = loadFixture("edge-cases.yml");
      const nestedRefs = refs.filter((r) => r.name === "NESTED_CHECK");
      expect(nestedRefs).toHaveLength(2);
    });
  });

  describe("false positive prevention — CRITICAL", () => {
    it("does NOT match ${{ env.X }} references", () => {
      const { refs } = loadFixture("edge-cases.yml");
      const names = refs.map((r) => r.name);
      expect(names).not.toContain("NOT_A_SECRET");
      expect(names).not.toContain("SOMETHING");
    });

    it("does NOT match ${{ github.X }} references", () => {
      const { refs } = loadFixture("edge-cases.yml");
      const names = refs.map((r) => r.name);
      expect(names).not.toContain("token");
      expect(names).not.toContain("repository");
    });

    it("does NOT match ${{ vars.X }} references", () => {
      const { refs } = loadFixture("edge-cases.yml");
      const names = refs.map((r) => r.name);
      expect(names).not.toContain("ALSO_NOT");
    });

    it("does NOT match secrets on commented-out lines", () => {
      const { refs } = loadFixture("edge-cases.yml");
      const names = refs.map((r) => r.name);
      expect(names).not.toContain("COMMENTED_OUT");
    });
  });

  describe("line number accuracy", () => {
    it("every secret reference has lineNumber >= 1", () => {
      const { refs } = loadFixture("sample-ci.yml");
      for (const ref of refs) {
        expect(ref.lineNumber).toBeGreaterThanOrEqual(1);
      }
    });

    it("secrets on adjacent lines have sequential line numbers", () => {
      const { refs } = loadFixture("sample-ci.yml");
      const apiKey = refs.find((r) => r.name === "API_KEY");
      const dbUrl = refs.find((r) => r.name === "DATABASE_URL");
      expect(apiKey).toBeDefined();
      expect(dbUrl).toBeDefined();
      expect(Math.abs(apiKey!.lineNumber - dbUrl!.lineNumber)).toBe(1);
    });

    it("two secrets on the same line have same lineNumber but different columns", () => {
      const { refs } = loadFixture("edge-cases.yml");
      const left = refs.find((r) => r.name === "LEFT_SECRET");
      const right = refs.find((r) => r.name === "RIGHT_SECRET");
      expect(left).toBeDefined();
      expect(right).toBeDefined();
      expect(left!.lineNumber).toBe(right!.lineNumber);
      expect(left!.column).not.toBe(right!.column);
      expect(left!.column).toBeLessThan(right!.column);
    });
  });

  describe("total count verification", () => {
    it("edge-cases.yml has exactly 12 secret references", () => {
      const { refs } = loadFixture("edge-cases.yml");
      expect(refs).toHaveLength(12);
      const names = refs.map((r) => r.name);
      expect(names).not.toContain("COMMENTED_OUT");
    });

    it("sample-ci.yml has exactly 6 secret references", () => {
      const { refs } = loadFixture("sample-ci.yml");
      expect(refs).toHaveLength(6);
    });

    it("no-secrets.yml has exactly 0 secret references", () => {
      const { refs } = loadFixture("no-secrets.yml");
      expect(refs).toHaveLength(0);
    });
  });
});
