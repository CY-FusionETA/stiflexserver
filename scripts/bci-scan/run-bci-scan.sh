#!/usr/bin/env bash
# Cron entry point for the unattended BCI Central tender scan.
# Reuses the machine's already-logged-in Chrome session (Claude in Chrome) —
# it never attempts to log in itself. See tender-scan/bci-scan-prompt.txt for
# the full task the invoked Claude session follows, and tender-scan/bci-scan-log.md
# for its output.
set -uo pipefail

export DISPLAY=:1
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"

REPO=/home/stiflex/stiflexserver
PROMPT_FILE="$REPO/tender-scan/bci-scan-prompt.txt"
LOG="$REPO/tender-scan/bci-cron-run.log"

cd "$REPO" || exit 1
git pull --quiet origin main || true

ALLOWED_TOOLS="Bash Read Write Edit Glob Grep PushNotification mcp__claude-in-chrome__tabs_context_mcp mcp__claude-in-chrome__navigate mcp__claude-in-chrome__computer mcp__claude-in-chrome__read_page mcp__claude-in-chrome__find mcp__claude-in-chrome__get_page_text mcp__claude-in-chrome__tabs_create_mcp mcp__claude-in-chrome__tabs_close_mcp"

{
  echo "=== BCI scan run: $(date -u +%Y-%m-%dT%H:%M:%SZ) UTC ==="
  claude -p "$(cat "$PROMPT_FILE")" \
    --chrome \
    --allowedTools $ALLOWED_TOOLS \
    --permission-mode acceptEdits \
    --permission-prompts none \
    --model claude-sonnet-5
  echo "=== run finished: $(date -u +%Y-%m-%dT%H:%M:%SZ) UTC (exit $?) ==="
} >> "$LOG" 2>&1
