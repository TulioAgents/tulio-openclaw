#!/usr/bin/env bash
# dev-start.sh — Manage the local OpenClaw gateway (build, start, stop, restart, status, logs).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/ai.openclaw.gateway.plist"
LABEL="ai.openclaw.gateway"
LOG_OUT="$HOME/.openclaw/logs/gateway.log"
LOG_ERR="$HOME/.openclaw/logs/gateway.err.log"

# ── Colors (only when stdout is a real terminal) ──────────────────────────────
if [ -t 1 ] || [ "${FORCE_COLOR:-0}" = "1" ]; then
  RED='\033[0;31m'
  GRN='\033[0;32m'
  YLW='\033[0;33m'
  CYN='\033[0;36m'
  BLD='\033[1m'
  DIM='\033[2m'
  RST='\033[0m'
else
  RED=''; GRN=''; YLW=''; CYN=''; BLD=''; DIM=''; RST=''
fi

ok()   { echo -e "${GRN}✓${RST}  $*"; }
warn() { echo -e "${YLW}⚠${RST}  $*"; }
fail() { echo -e "${RED}✗${RST}  $*" >&2; }
die()  { fail "$*"; exit 1; }
sep()  { echo -e "\n${BLD}── $*${RST}"; }
cmd()  { echo -e "  ${DIM}$ $*${RST}"; }

# Log and run a shell command — prints the command first for reference
run() {
  cmd "$*"
  eval "$*"
}

# ── Help ──────────────────────────────────────────────────────────────────────
usage() {
  printf '%b\n' "
${BLD}dev-start.sh${RST} — Manage the local OpenClaw gateway.

${BLD}Usage:${RST}
  ./scripts/dev-start.sh <command> [options]

${BLD}Commands:${RST}
  start           Build, sync skills, and start the gateway
  stop            Stop the gateway
  restart         Stop, build, sync skills, and start the gateway
  status          Show gateway and agent status
  logs            Tail gateway stdout log
  logs-err        Tail gateway stderr log
  build           Build only (no gateway restart)
  sync-skills     Sync skills to ~/.openclaw/workspaces/ only
  validate        Check environment prerequisites only

${BLD}Options:${RST}
  --quick         Skip pnpm build step (start / restart only)
  --help, -h      Show this help

${BLD}Examples:${RST}
  ./scripts/dev-start.sh start            # build + sync + start
  ./scripts/dev-start.sh start --quick    # sync + start (skip build)
  ./scripts/dev-start.sh restart          # build + sync + restart
  ./scripts/dev-start.sh stop             # stop gateway
  ./scripts/dev-start.sh status           # show status
  ./scripts/dev-start.sh logs             # tail stdout log
  ./scripts/dev-start.sh logs-err         # tail stderr log
  ./scripts/dev-start.sh build            # build dist/ only
  ./scripts/dev-start.sh sync-skills      # sync skills only

${BLD}Log files:${RST}
  $LOG_OUT
  $LOG_ERR
"
}

# ── Validation ────────────────────────────────────────────────────────────────
validate() {
  sep "Validating environment"

  # node
  if ! command -v node &>/dev/null; then
    die "node not found. Install Node 22+ and ensure it is on PATH."
  fi
  NODE_VER=$(node --version | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
  if [ "$NODE_MAJOR" -lt 22 ]; then
    die "Node $NODE_VER is too old. Required: 22+."
  fi
  ok "node v$NODE_VER"

  # pnpm
  if ! command -v pnpm &>/dev/null; then
    die "pnpm not found. Run: npm install -g pnpm"
  fi
  ok "pnpm $(pnpm --version)"

  # openclaw CLI
  if ! command -v openclaw &>/dev/null; then
    die "openclaw CLI not found. Run: npm install -g . (from repo root)"
  fi
  ok "openclaw $(openclaw --version 2>/dev/null | head -1 || echo '(version unknown)')"

  # plist
  if [ ! -f "$PLIST" ]; then
    die "LaunchAgent plist not found at $PLIST. Run: openclaw gateway install"
  fi
  ok "plist: $PLIST"

  # plist points to this repo
  if ! grep -q "$REPO_ROOT/dist/index.js" "$PLIST"; then
    PLIST_BIN=$(grep -A1 'ProgramArguments' "$PLIST" | grep dist | tr -d ' \t<>/string' || echo 'unknown')
    warn "Plist references a different dist: $PLIST_BIN"
    warn "Expected: $REPO_ROOT/dist/index.js"
    warn "Gateway will start from the plist path, not this repo."
  else
    ok "plist → $REPO_ROOT/dist/index.js"
  fi
}

# ── Build ─────────────────────────────────────────────────────────────────────
do_build() {
  sep "Building"
  cd "$REPO_ROOT"
  run "pnpm build"
  ok "Build complete"
}

# ── Sync skills ───────────────────────────────────────────────────────────────
do_sync_skills() {
  sep "Syncing skills"
  local sync_script="$REPO_ROOT/scripts/sync-agent-skills.sh"
  if [ ! -x "$sync_script" ]; then
    warn "sync-agent-skills.sh not found — skipping"
    return
  fi
  run "$sync_script"
  ok "Skills synced to ~/.openclaw/workspaces/"
}

# ── Stop gateway ──────────────────────────────────────────────────────────────
do_stop() {
  sep "Stopping gateway"
  if launchctl print "gui/$UID/$LABEL" &>/dev/null; then
    run "launchctl bootout gui/$UID/$LABEL"
    sleep 1
    ok "Gateway stopped"
  else
    ok "Gateway was not running"
  fi
}

# ── Start gateway ─────────────────────────────────────────────────────────────
do_start_service() {
  sep "Starting gateway"

  if [ ! -f "$REPO_ROOT/dist/index.js" ]; then
    die "dist/index.js not found. Run without --quick to build first."
  fi

  run "launchctl bootstrap gui/$UID $PLIST"
  ok "LaunchAgent loaded"

  sep "Waiting for gateway"
  local ready=0
  for i in $(seq 1 15); do
    sleep 1
    if openclaw gateway probe --quiet 2>/dev/null; then
      ready=1
      break
    fi
    printf "."
  done
  echo ""

  if [ "$ready" = "0" ]; then
    fail "Gateway did not respond after 15s."
    echo ""
    echo "  Check logs:"
    cmd "tail -50 $LOG_OUT"
    cmd "tail -50 $LOG_ERR"
    exit 1
  fi
  ok "Gateway is reachable"
}

# ── Status ────────────────────────────────────────────────────────────────────
do_status() {
  sep "Gateway process"
  if launchctl print "gui/$UID/$LABEL" &>/dev/null; then
    ok "LaunchAgent loaded (${LABEL})"
  else
    warn "LaunchAgent not loaded"
  fi

  sep "OpenClaw status"
  run "openclaw status"

  sep "Probe"
  run "openclaw gateway probe" || warn "Gateway probe failed"
}

# ── Logs ──────────────────────────────────────────────────────────────────────
do_logs() {
  sep "Gateway stdout log ($LOG_OUT)"
  cmd "tail -f $LOG_OUT"
  tail -f "$LOG_OUT"
}

do_logs_err() {
  sep "Gateway stderr log ($LOG_ERR)"
  cmd "tail -f $LOG_ERR"
  tail -f "$LOG_ERR"
}

# ── Summary ───────────────────────────────────────────────────────────────────
print_summary() {
  sep "Summary"
  openclaw status 2>/dev/null | grep -E "Dashboard|Gateway|Channel|Git|Version" || true
  echo ""
  ok "Gateway running from: ${BLD}$REPO_ROOT/dist/${RST}"
}

# ── Arg parsing ───────────────────────────────────────────────────────────────
COMMAND="${1:-}"
QUICK=0

case "$COMMAND" in
  --help|-h) usage; exit 0 ;;
  "")
    usage
    echo -e "${BLD}Available commands:${RST} start · stop · restart · status · logs · logs-err · build · sync-skills · validate"
    echo ""
    printf "Enter command: "
    read -r COMMAND
    [ -z "$COMMAND" ] && die "No command entered."
    ;;
esac

shift || true
for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=1 ;;
    --help|-h) usage; exit 0 ;;
    *) die "Unknown option: $arg. Run with --help for usage." ;;
  esac
done

cd "$REPO_ROOT"

# ── Dispatch ──────────────────────────────────────────────────────────────────
case "$COMMAND" in
  start)
    validate
    [ "$QUICK" = "0" ] && do_build || warn "Skipping build (--quick)"
    do_sync_skills
    do_stop
    do_start_service
    print_summary
    ;;

  stop)
    do_stop
    ;;

  restart)
    validate
    [ "$QUICK" = "0" ] && do_build || warn "Skipping build (--quick)"
    do_sync_skills
    do_stop
    do_start_service
    print_summary
    ;;

  status)
    do_status
    ;;

  logs)
    do_logs
    ;;

  logs-err)
    do_logs_err
    ;;

  build)
    validate
    do_build
    ;;

  sync-skills)
    do_sync_skills
    ;;

  validate)
    validate
    ok "All checks passed."
    ;;

  *)
    fail "Unknown command: $COMMAND"
    usage
    exit 1
    ;;
esac
