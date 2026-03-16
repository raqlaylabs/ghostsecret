/**
 * GitHub automatically provides these secrets in every workflow run.
 * They should never be flagged by any linting rule.
 */
export const BUILTIN_SECRETS = new Set([
  "GITHUB_TOKEN",
  "github_token", // handle case variation just in case
]);
