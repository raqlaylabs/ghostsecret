#!/bin/bash
set -e

DOGFOOD_DIR="tests/dogfood-repos"
rm -rf "$DOGFOOD_DIR"
mkdir -p "$DOGFOOD_DIR"

# Function to download just the .github/workflows/ folder from a repo
download_workflows() {
  local repo=$1
  local name=$(echo "$repo" | tr '/' '-')
  local dir="$DOGFOOD_DIR/$name/.github/workflows"
  mkdir -p "$dir"

  echo "Downloading workflows from $repo..."

  # Use GitHub API to list workflow files
  local files=$(curl -s "https://api.github.com/repos/$repo/contents/.github/workflows" | grep '"name"' | sed 's/.*"name": "\(.*\)".*/\1/')

  for file in $files; do
    if [[ "$file" == *.yml || "$file" == *.yaml ]]; then
      curl -s "https://raw.githubusercontent.com/$repo/main/.github/workflows/$file" -o "$dir/$file" 2>/dev/null || \
      curl -s "https://raw.githubusercontent.com/$repo/master/.github/workflows/$file" -o "$dir/$file" 2>/dev/null || true
    fi
  done

  echo "  → Downloaded $(ls "$dir" | wc -l | tr -d ' ') workflow files"
}

# Download from repos known to have complex workflow setups
download_workflows "facebook/react"
download_workflows "microsoft/vscode"
download_workflows "vercel/next.js"
download_workflows "astral-sh/ruff"
download_workflows "denoland/deno"

echo ""
echo "Running ghostsecret against each repo..."
echo ""

FAILED=0
for repo_dir in "$DOGFOOD_DIR"/*/; do
  repo_name=$(basename "$repo_dir")
  echo "━━━ $repo_name ━━━"

  # Run the tool — it should NEVER crash, even if it finds issues
  if npx tsx src/cli.ts --path "$repo_dir" 2>&1; then
    echo ""
  else
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 1 ]; then
      # Exit code 1 = found errors, that's fine
      echo ""
    else
      # Exit code > 1 = crash/unexpected error
      echo "  ⚠ CRASHED with exit code $EXIT_CODE"
      FAILED=1
    fi
  fi
done

if [ $FAILED -eq 1 ]; then
  echo "Some repos caused crashes — fix the parser!"
  exit 1
else
  echo "✓ All repos scanned without crashes"
fi
