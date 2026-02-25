#!/usr/bin/env bash
set -euo pipefail

# ─── Setup Hooks ─────────────────────────────────────────────────────────────
# Installs observability hooks into a target project for Claude Code and/or
# Gemini CLI. Copies hook scripts and merges settings.json non-destructively.
#
# Usage:
#   scripts/setup-hooks.sh [target-dir] [--claude|--gemini|--all]
#
# Examples:
#   cd my-project && /path/to/claude-observability/scripts/setup-hooks.sh
#   scripts/setup-hooks.sh /path/to/my-project --all
#   scripts/setup-hooks.sh ~/projects/app --claude
# ─────────────────────────────────────────────────────────────────────────────

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()  { echo -e "${BLUE}ℹ${NC}  $*"; }
ok()    { echo -e "${GREEN}✓${NC}  $*"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $*"; }
err()   { echo -e "${RED}✗${NC}  $*"; }

# ─── Resolve source directory (where this repo lives) ────────────────────────
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ─── Parse arguments ─────────────────────────────────────────────────────────
TARGET_DIR=""
SCOPE=""  # claude, gemini, all, or empty (prompt)
NONINTERACTIVE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --claude)  SCOPE="claude";  NONINTERACTIVE=true; shift ;;
    --gemini)  SCOPE="gemini";  NONINTERACTIVE=true; shift ;;
    --all)     SCOPE="all";     NONINTERACTIVE=true; shift ;;
    --help|-h)
      echo "Usage: setup-hooks.sh [target-dir] [--claude|--gemini|--all]"
      echo ""
      echo "Installs observability hooks into a target project."
      echo ""
      echo "Arguments:"
      echo "  target-dir     Project directory to install into (default: current directory)"
      echo ""
      echo "Flags:"
      echo "  --claude       Install Claude Code hooks only"
      echo "  --gemini       Install Gemini CLI hooks only"
      echo "  --all          Install both (skip prompt)"
      echo "  -h, --help     Show this help"
      exit 0
      ;;
    -*)
      err "Unknown flag: $1"
      exit 1
      ;;
    *)
      if [[ -z "$TARGET_DIR" ]]; then
        TARGET_DIR="$1"
      else
        err "Unexpected argument: $1"
        exit 1
      fi
      shift
      ;;
  esac
done

TARGET_DIR="${TARGET_DIR:-$PWD}"
TARGET_DIR="$(cd "$TARGET_DIR" 2>/dev/null && pwd)" || {
  err "Target directory does not exist: $TARGET_DIR"
  exit 1
}

# ─── Safety: don't install into the observability repo itself ─────────────────
if [[ "$TARGET_DIR" == "$SOURCE_DIR" ]]; then
  err "Target directory is the observability repo itself. Nothing to do."
  exit 1
fi

echo ""
echo -e "${BOLD}Multi-Agent Observability — Hook Setup${NC}"
echo -e "Source: ${BLUE}${SOURCE_DIR}${NC}"
echo -e "Target: ${BLUE}${TARGET_DIR}${NC}"
echo ""

# ─── Check prerequisites ─────────────────────────────────────────────────────
if ! command -v uv &>/dev/null; then
  warn "'uv' is not on PATH. Hook scripts require uv to run."
  warn "Install: https://docs.astral.sh/uv/getting-started/installation/"
  if ! $NONINTERACTIVE; then
    echo ""
    read -rp "Continue anyway? [y/N] " yn
    case "$yn" in
      [Yy]*) ;;
      *)     echo "Aborted."; exit 1 ;;
    esac
  fi
fi

# ─── Prompt for scope if not set via flags ────────────────────────────────────
if [[ -z "$SCOPE" ]]; then
  echo "Which hooks do you want to install?"
  echo "  1) Both Claude Code + Gemini CLI (default)"
  echo "  2) Claude Code only"
  echo "  3) Gemini CLI only"
  echo ""
  read -rp "Choice [1/2/3]: " choice
  case "$choice" in
    2)  SCOPE="claude" ;;
    3)  SCOPE="gemini" ;;
    *)  SCOPE="all" ;;
  esac
  echo ""
fi

INSTALL_CLAUDE=false
INSTALL_GEMINI=false
case "$SCOPE" in
  claude) INSTALL_CLAUDE=true ;;
  gemini) INSTALL_GEMINI=true ;;
  all)    INSTALL_CLAUDE=true; INSTALL_GEMINI=true ;;
esac

# ─── Helper: merge hooks key into existing settings.json ─────────────────────
# Uses inline Python (via uv/python3) to merge the "hooks" key from source
# into target, preserving all other keys in the target file.
merge_settings() {
  local src="$1"
  local dst="$2"

  python3 -c "
import json, sys

with open('$src') as f:
    src = json.load(f)
with open('$dst') as f:
    dst = json.load(f)

# Merge: source hooks override target hooks per event type
if 'hooks' not in dst:
    dst['hooks'] = {}
dst['hooks'].update(src.get('hooks', {}))

with open('$dst', 'w') as f:
    json.dump(dst, f, indent=2)
    f.write('\n')
"
}

# ─── Helper: copy hooks for a given tool ──────────────────────────────────────
install_hooks() {
  local tool="$1"          # "claude" or "gemini"
  local dot_dir src_hooks src_settings dst_dir dst_hooks dst_settings

  if [[ "$tool" == "claude" ]]; then
    dot_dir=".claude"
  else
    dot_dir=".gemini"
  fi

  src_hooks="${SOURCE_DIR}/${dot_dir}/hooks"
  src_settings="${SOURCE_DIR}/${dot_dir}/settings.json"
  dst_dir="${TARGET_DIR}/${dot_dir}"
  dst_hooks="${dst_dir}/hooks"
  dst_settings="${dst_dir}/settings.json"

  info "Installing ${BOLD}${tool}${NC} hooks..."

  # Create target directory
  mkdir -p "$dst_hooks"

  # Files to skip (not wired in settings.json or not relevant for other projects)
  local skip_files
  if [[ "$tool" == "claude" ]]; then
    skip_files="worktree_create.py worktree_remove.py config_change.py"
  else
    skip_files=""
  fi

  # Copy hook scripts (skip __pycache__, validators/, and unwired scripts)
  local copied=0
  for src_file in "$src_hooks"/*.py; do
    local basename
    basename="$(basename "$src_file")"

    # Skip unwired scripts
    local skip=false
    for s in $skip_files; do
      if [[ "$basename" == "$s" ]]; then
        skip=true
        break
      fi
    done
    if $skip; then
      continue
    fi

    # Check if file already exists and is identical
    if [[ -f "${dst_hooks}/${basename}" ]]; then
      if diff -q "$src_file" "${dst_hooks}/${basename}" &>/dev/null; then
        continue  # Already up to date
      else
        warn "  Updating ${dot_dir}/hooks/${basename} (differs from source)"
      fi
    fi

    cp "$src_file" "${dst_hooks}/${basename}"
    copied=$((copied + 1))
  done

  if [[ $copied -eq 0 ]]; then
    ok "  Hook scripts already up to date"
  else
    ok "  Copied ${copied} hook script(s) to ${dot_dir}/hooks/"
  fi

  # Handle settings.json
  if [[ ! -f "$dst_settings" ]]; then
    # No existing settings — copy wholesale
    cp "$src_settings" "$dst_settings"
    ok "  Created ${dot_dir}/settings.json"
  else
    # Existing settings — check if hooks already present
    local existing_hooks
    existing_hooks=$(python3 -c "
import json
with open('$dst_settings') as f:
    d = json.load(f)
hooks = d.get('hooks', {})
print(len(hooks))
" 2>/dev/null || echo "0")

    if [[ "$existing_hooks" == "0" ]]; then
      merge_settings "$src_settings" "$dst_settings"
      ok "  Added hooks to existing ${dot_dir}/settings.json"
    else
      # Settings already has hooks — merge carefully
      if $NONINTERACTIVE; then
        merge_settings "$src_settings" "$dst_settings"
        ok "  Merged hooks into ${dot_dir}/settings.json"
      else
        warn "  ${dot_dir}/settings.json already has hooks configured"
        read -rp "   Merge observability hooks into it? [Y/n] " yn
        case "$yn" in
          [Nn]*) warn "  Skipped settings.json merge" ;;
          *)
            merge_settings "$src_settings" "$dst_settings"
            ok "  Merged hooks into ${dot_dir}/settings.json"
            ;;
        esac
      fi
    fi
  fi
}

# ─── Install ──────────────────────────────────────────────────────────────────
if $INSTALL_CLAUDE; then
  install_hooks "claude"
  echo ""
fi

if $INSTALL_GEMINI; then
  install_hooks "gemini"
  echo ""
fi

# ─── Verify: send a test event (non-fatal) ───────────────────────────────────
SERVER_URL="${OBSERVABILITY_SERVER_URL:-http://localhost:4000}"

info "Sending test event to ${SERVER_URL}..."
if curl -sf -X POST "${SERVER_URL}/events" \
  -H "Content-Type: application/json" \
  -d '{"source_app":"setup-test","session_id":"setup-verify","hook_event_type":"Notification","payload":{"message":"Hook setup verification from '"$TARGET_DIR"'"}}' \
  --max-time 3 &>/dev/null; then
  ok "Server is reachable — test event sent"
else
  warn "Server not reachable at ${SERVER_URL} (this is fine if it's not running yet)"
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}Done!${NC} Hooks installed to ${BLUE}${TARGET_DIR}${NC}"
echo ""
if $INSTALL_CLAUDE; then
  echo "  Claude Code: ${TARGET_DIR}/.claude/hooks/ + settings.json"
fi
if $INSTALL_GEMINI; then
  echo "  Gemini CLI:  ${TARGET_DIR}/.gemini/hooks/ + settings.json"
fi
echo ""
if [[ "$SERVER_URL" != "http://localhost:4000" ]]; then
  info "Using custom server: ${SERVER_URL}"
else
  info "Hooks will POST to http://localhost:4000 (set OBSERVABILITY_SERVER_URL to change)"
fi
echo ""
