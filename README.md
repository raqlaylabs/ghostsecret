# gh-secrets-check

**Catch GitHub Actions secrets that silently resolve to empty strings before they break your workflows.**

[![npm version](https://img.shields.io/npm/v/gh-secrets-check)](https://www.npmjs.com/package/gh-secrets-check)
[![license](https://img.shields.io/npm/l/gh-secrets-check)](./LICENSE)
[![node](https://img.shields.io/node/v/gh-secrets-check)](https://nodejs.org)

## The Problem

GitHub Actions secrets silently resolve to empty strings in certain contexts — fork PRs, Dependabot runs, misspelled names, wrong scope. When this happens, workflows fail with misleading errors like "authentication failed" instead of "secret was empty." Developers waste hours debugging the wrong problem. This tool catches these issues statically, before they hit CI.

## Quick Start

```bash
# Scan current repo
npx gh-secrets-check

# Scan a specific repo
npx gh-secrets-check --path /path/to/repo

# With GitHub token for typo detection
GITHUB_TOKEN=ghp_xxx npx gh-secrets-check

# JSON output for CI
npx gh-secrets-check --format json
```

## What It Catches

| Rule | Severity | What it catches |
|------|----------|-----------------|
| `secrets-in-fork-pr` | ⚡ warning | Secrets used in `pull_request` triggered workflows — empty on fork PRs |
| `pr-target-checkout` | ✖ error | Dangerous `pull_request_target` + PR head checkout + secrets pattern (exfiltration risk) |
| `no-empty-check` | ● info | Secrets used without `if: ${{ secrets.X != '' }}` guards |
| `undefined-secret` | ✖ error | Secret referenced in workflow but not defined in repo (typo detection with fuzzy matching) |
| `unused-secret` | ● info | Secret defined in repo but never referenced in any workflow (drift detection) |

## Example Output

```
  gh-secrets-check v0.1.0

  sample-ci.yml

    ⚡ secrets-in-fork-pr
      Secrets will be empty on fork PRs (trigger: pull_request)
      secrets: GLOBAL_TOKEN  API_KEY  DATABASE_URL  DEPLOY_TOKEN (×2)  LINT_KEY
      lines:   10  22  23  26  29  35
      ↳ Split into two workflows: fork PRs (no secrets) + pull_request_target for trusted ops

    ● no-empty-check
      Secrets used without empty-string guards
      secrets: GLOBAL_TOKEN  API_KEY  DATABASE_URL  LINT_KEY
      lines:   10  22  23  35
      ↳ Add: if: ${{ secrets.GLOBAL_TOKEN != '' }}

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  │ 10 issues   0 errors   6 warnings   4 info
  │
  │ Run with --format json for CI-friendly output
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--path <dir>` | Path to repository root | `.` |
| `--format <type>` | Output format: `terminal` or `json` | `terminal` |
| `--token <token>` | GitHub token (or set `GITHUB_TOKEN` env var) | — |
| `--ignore <rules>` | Comma-separated rule IDs to skip | — |
| `--strict` | Treat warnings as errors (exit code 1) | `false` |

## Use in CI

```yaml
# .github/workflows/lint-secrets.yml
name: Lint Secrets
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check secrets usage
        run: npx gh-secrets-check --strict
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> `GITHUB_TOKEN` is automatically available in GitHub Actions — no extra setup needed. This enables the `undefined-secret` and `unused-secret` rules.

## Why Not Just Use X?

- **GitHub secret scanning** detects leaked secrets in code. Different problem — we detect secrets that will be *empty* at runtime.
- **actionlint** is a general workflow linter. It doesn't analyze secret availability by trigger context or check against your repo's actual defined secrets.
- **gitleaks / truffleHog** prevent secret leaks. Complementary tools, not substitutes.

## Contributing

1. Fork the repo and create a feature branch
2. Run `npm test` before submitting a PR
3. Each new rule should be its own file in `src/rules/` implementing the `LintRule` interface

## License

[MIT](./LICENSE)
