#!/usr/bin/env bash
# install-hooks.sh — Install git pre-commit hooks for LeadSpot Platform
# Usage: ./scripts/install-hooks.sh [--check]

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"
PRE_COMMIT="$HOOKS_DIR/pre-commit"

check_only=false
if [[ "${1:-}" == "--check" ]]; then
  check_only=true
fi

echo "=== LeadSpot Git Hooks Installer ==="

# ── 1. gitleaks ─────────────────────────────────────────────────────────────
if command -v gitleaks &>/dev/null; then
  echo "✓ gitleaks found: $(gitleaks version 2>/dev/null || echo 'installed')"
else
  echo "✗ gitleaks not found. Install it:"
  echo "  macOS:  brew install gitleaks"
  echo "  Linux:  https://github.com/gitleaks/gitleaks/releases"
  if [[ "$check_only" == false ]]; then
    echo "  Continuing without gitleaks — install it before committing."
  fi
fi

# ── 2. Write pre-commit hook ─────────────────────────────────────────────────
if [[ "$check_only" == true ]]; then
  if [[ -f "$PRE_COMMIT" ]]; then
    echo "✓ pre-commit hook is installed"
  else
    echo "✗ pre-commit hook is NOT installed. Run: ./scripts/install-hooks.sh"
    exit 1
  fi
  exit 0
fi

mkdir -p "$HOOKS_DIR"

cat > "$PRE_COMMIT" <<'HOOK'
#!/usr/bin/env bash
# LeadSpot pre-commit hook — runs security and CI gates before every commit
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"

echo "[pre-commit] Running LeadSpot security gates..."

# ── Gate 1: No ploink.site references in source ──────────────────────────────
if grep -rn "ploink.site" "$REPO_ROOT/dashboard/src/" 2>/dev/null; then
  echo "ERROR: Found ploink.site URL in source. Remove it before committing."
  exit 1
fi

# ── Gate 2: No MOCK_USER_ID in source ────────────────────────────────────────
if grep -rn "MOCK_USER_ID\|user_demo_123" "$REPO_ROOT/dashboard/src/" 2>/dev/null; then
  echo "ERROR: Found MOCK_USER_ID / user_demo_123 in source. Remove it before committing."
  exit 1
fi

# ── Gate 3: gitleaks secret scan ─────────────────────────────────────────────
if command -v gitleaks &>/dev/null; then
  CONFIG="$REPO_ROOT/.gitleaks.toml"
  if [[ -f "$CONFIG" ]]; then
    gitleaks protect --staged --config="$CONFIG" --redact
  else
    gitleaks protect --staged --redact
  fi
else
  echo "[pre-commit] WARNING: gitleaks not installed — skipping secret scan."
  echo "  Install: brew install gitleaks (macOS) or see https://github.com/gitleaks/gitleaks/releases"
fi

echo "[pre-commit] All gates passed ✓"
HOOK

chmod +x "$PRE_COMMIT"
echo "✓ pre-commit hook installed at $PRE_COMMIT"
echo ""
echo "The hook will block commits that:"
echo "  • Contain ploink.site URLs in dashboard/src/"
echo "  • Contain MOCK_USER_ID or user_demo_123 in dashboard/src/"
echo "  • Include secrets detected by gitleaks"
