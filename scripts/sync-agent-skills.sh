#!/usr/bin/env bash
# sync-agent-skills.sh — Sync skills from the repo to ~/.openclaw/workspaces/<role>/skills/
#
# Usage:
#   ./scripts/sync-agent-skills.sh          # sync all roles
#   ./scripts/sync-agent-skills.sh cto      # sync one role
#
# Repo is source of truth — always overwrites workspace copies.
# Never removes skills that are installed but not listed here.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS_SRC="$REPO_ROOT/skills"
WORKSPACES_DIR="$HOME/.openclaw/workspaces"

# ── Shared skills — every role gets these ────────────────────────────────────
SHARED_SKILLS="
  coding-agent
  git-worktree-discipline
  handoff-standard
  mc-task-poll
  monorepo-navigation
  openspec-change
  openspec-sdd
  project-bootstrap
  project-map-reader
  self-learning-loop
"

# ── Role-specific skills ──────────────────────────────────────────────────────
role_skills() {
  case "$1" in
    cto)
      echo "openspec-review-code"
      ;;
    manager)
      echo "openspec-plan-change openspec-handoff"
      ;;
    po)
      echo "openspec-propose"
      ;;
    tech-lead)
      echo "openspec-design-arch openspec-review-code"
      ;;
    staff-fullstack)
      echo "openspec-implement openspec-review-code"
      ;;
    sr-fullstack)
      echo "openspec-implement openspec-review-code"
      ;;
    mobile)
      echo "openspec-implement"
      ;;
    qa)
      echo "openspec-test-verify"
      ;;
    devops)
      echo "openspec-deploy-gcp"
      ;;
  esac
}

ALL_ROLES="cto manager po tech-lead staff-fullstack sr-fullstack mobile qa devops"

# ── Helpers ───────────────────────────────────────────────────────────────────

install_skill() {
  local role="$1"
  local skill="$2"
  local src="$SKILLS_SRC/$skill"
  local dest="$WORKSPACES_DIR/$role/skills/$skill"

  if [ ! -d "$src" ]; then
    echo "  SKIP  $skill (not in repo skills/)"
    return
  fi

  mkdir -p "$dest"
  cp -r "$src/." "$dest/"
  echo "  OK    $skill"
}

sync_role() {
  local role="$1"
  local workspace="$WORKSPACES_DIR/$role"

  if [ ! -d "$workspace" ]; then
    echo "SKIP  '$role' — workspace not found at $workspace"
    return
  fi

  echo ""
  echo "[$role]"

  for skill in $SHARED_SKILLS; do
    [ -z "$skill" ] && continue
    install_skill "$role" "$skill"
  done

  for skill in $(role_skills "$role"); do
    [ -z "$skill" ] && continue
    install_skill "$role" "$skill"
  done
}

# ── Main ──────────────────────────────────────────────────────────────────────

echo "Source:     $SKILLS_SRC"
echo "Workspaces: $WORKSPACES_DIR"

if [ $# -gt 0 ]; then
  sync_role "$1"
else
  for role in $ALL_ROLES; do
    sync_role "$role"
  done
fi

echo ""
echo "Done."
