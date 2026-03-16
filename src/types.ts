export interface TriggerEvent {
  event: string;
  branches?: string[];
  types?: string[];
}

export interface WorkflowStep {
  name?: string;
  uses?: string;
  with?: Record<string, string>;
  env?: Record<string, string>;
  if?: string;
  run?: string;
  rawContent: string;
  lineNumber: number;
}

export interface WorkflowJob {
  id: string;
  name?: string;
  steps: WorkflowStep[];
  env?: Record<string, string>;
  if?: string;
  runsOn?: string;
}

export interface WorkflowFile {
  filePath: string;
  name?: string;
  triggers: TriggerEvent[];
  jobs: WorkflowJob[];
  env?: Record<string, string>;
  rawContent: string;
}

export interface SecretReference {
  name: string;
  filePath: string;
  lineNumber: number;
  column: number;
  jobId?: string;
  stepIndex?: number;
  context: "env" | "with" | "run" | "if" | "other";
  triggers: TriggerEvent[];
}

export interface LintResult {
  ruleId: string;
  severity: "error" | "warning" | "info";
  message: string;
  filePath: string;
  lineNumber?: number;
  secretName?: string;
  suggestedFix?: string;
}

export interface AnalysisContext {
  workflows: WorkflowFile[];
  secretRefs: SecretReference[];
  repoSecrets?: string[];
}
