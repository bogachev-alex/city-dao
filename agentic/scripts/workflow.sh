#!/usr/bin/env bash
# Agentic Coding Workflow — bash helpers (macOS / Linux)
# Source: https://github.com/bogachev-alex/agentic_coding
#
# Usage from project root:
#   source agentic/scripts/workflow.sh
#
# Functions:
#   start_workflow_watcher   — run once per session; auto-runs OpenCode when current-task.md changes
#   stop_workflow_watcher    — stop the background watcher
#   wait_opencode            — poll tasks/done.md; prints OPENCODE_DONE or STILL_RUNNING
#   run_opencode             — run OpenCode manually (fallback)
#
# Requires: opencode CLI on PATH (see upstream Setup-OpenCode / npm i -g opencode-ai)
# Source this file from bash:  source agentic/scripts/workflow.sh

AGENTIC_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

agentic_resolve_root() {
  local p="${1:-$PWD}"
  (cd "$p" && pwd)
}

agentic_ensure_tasks() {
  local root="$1"
  mkdir -p "$root/tasks"
}

# ---------------------------------------------------------------------------
# run_opencode — mirrors Run-OpenCode (workflow.ps1)
# ---------------------------------------------------------------------------
run_opencode() {
  local root
  root="$(agentic_resolve_root "${1:-$PWD}")"
  local result_file="$root/tasks/result.md"
  local task_file=""

  if [[ -f "$root/tasks/current-task.md" ]]; then
    task_file="$root/tasks/current-task.md"
  fi

  if [[ -z "$task_file" ]]; then
    for plans_dir in "$root/.cursor/plans" "$HOME/.cursor/plans" "$HOME/.claude/plans"; do
      if [[ -d "$plans_dir" ]]; then
        local latest
        latest="$(find "$plans_dir" -maxdepth 1 -name '*.md' -type f -print0 2>/dev/null | xargs -0 ls -t 2>/dev/null | head -1)"
        if [[ -n "$latest" && -f "$latest" ]]; then
          task_file="$latest"
          break
        fi
      fi
    done
  fi

  if [[ -z "$task_file" ]]; then
    echo "No task file found. Checked:"
    echo "  1. $root/tasks/current-task.md"
    echo "  2. $root/.cursor/plans/*.md"
    echo "  3. $HOME/.cursor/plans/*.md"
    return 1
  fi

  agentic_ensure_tasks "$root"
  local timeout_min="${AGENTIC_OPENCODE_TIMEOUT_MIN:-20}"
  local prompt="Implement the plan in the attached file exactly as described. Follow all constraints."

  echo "Running OpenCode (timeout: ${timeout_min} min)..."
  echo "Plan: $task_file"
  echo "First line: $(head -1 "$task_file")"
  echo "---"

  (
    set -o pipefail 2>/dev/null || true
    opencode run -m zai-coding-plan/glm-5 --print-logs "$prompt" -f "$task_file" 2>&1 | tee "$result_file"
  ) || echo "OpenCode exited with non-zero status."

  echo "---"
  echo "Done: $result_file"
  echo "OPENCODE_DONE"
}

# ---------------------------------------------------------------------------
# wait_opencode — mirrors Wait-OpenCode
# ---------------------------------------------------------------------------
wait_opencode() {
  local root poll_seconds
  root="$(agentic_resolve_root "${1:-$PWD}")"
  poll_seconds="${2:-90}"
  local task_file="$root/tasks/current-task.md"
  local done_file="$root/tasks/done.md"

  if [[ ! -f "$task_file" ]]; then
    echo "WAIT_ERROR: tasks/current-task.md not found"
    return 1
  fi

  local task_mtime
  task_mtime="$(stat -f %m "$task_file" 2>/dev/null || stat -c %Y "$task_file" 2>/dev/null)"
  local deadline=$((SECONDS + poll_seconds))

  echo "Waiting for OpenCode (up to ${poll_seconds}s)..."

  while (( SECONDS < deadline )); do
    if [[ -f "$done_file" ]]; then
      local done_mtime
      done_mtime="$(stat -f %m "$done_file" 2>/dev/null || stat -c %Y "$done_file" 2>/dev/null)"
      if [[ "$done_mtime" -gt "$task_mtime" ]]; then
        cat "$done_file"
        echo "OPENCODE_DONE"
        return 0
      fi
    fi
    sleep 5
  done

  echo "STILL_RUNNING"
}

# ---------------------------------------------------------------------------
# Internal: one OpenCode run from watcher (same model as PowerShell)
# ---------------------------------------------------------------------------
_agentic_watcher_run_job() {
  local task_file="$2"
  local result_file="$3"
  local done_file="$4"
  local timeout_min="${5:-20}"
  local prompt="Implement the plan in the attached file exactly as described. Follow all constraints."

  rm -f "$done_file"
  set +e
  local timeout_sec=$((timeout_min * 60))
  if command -v timeout >/dev/null 2>&1; then
    (
      set -o pipefail 2>/dev/null || true
      timeout "${timeout_sec}" opencode run -m zai-coding-plan/glm-5 --print-logs "$prompt" -f "$task_file" 2>&1 | tee "$result_file"
    )
  elif command -v gtimeout >/dev/null 2>&1; then
    (
      set -o pipefail 2>/dev/null || true
      gtimeout "${timeout_sec}" opencode run -m zai-coding-plan/glm-5 --print-logs "$prompt" -f "$task_file" 2>&1 | tee "$result_file"
    )
  else
    (
      set -o pipefail 2>/dev/null || true
      opencode run -m zai-coding-plan/glm-5 --print-logs "$prompt" -f "$task_file" 2>&1 | tee "$result_file"
    )
  fi
  local ec=$?

  local status
  if [[ $ec -eq 124 ]]; then
    status="TIMEOUT after ${timeout_min} min"
    pkill -f opencode 2>/dev/null || true
  elif [[ -f "$result_file" ]]; then
    status="OK"
  else
    status="ERROR: no result.md"
  fi

  printf 'OPENCODE_DONE\nStatus: %s\nTimestamp: %s\n' "$status" "$(date '+%Y-%m-%d %H:%M:%S')" >"$done_file"
  echo "WATCHER: done — $status — wrote $done_file"
}

# ---------------------------------------------------------------------------
# start_workflow_watcher — background loop (poll-based for portability)
# ---------------------------------------------------------------------------
start_workflow_watcher() {
  local root timeout_min
  root="$(agentic_resolve_root "${1:-$PWD}")"
  timeout_min="${2:-20}"
  agentic_ensure_tasks "$root"

  local task_file="$root/tasks/current-task.md"
  local result_file="$root/tasks/result.md"
  local done_file="$root/tasks/done.md"
  local pid_file="$root/tasks/.workflow_watcher.pid"

  stop_workflow_watcher "$root" 2>/dev/null || true

  (
    set +e
    cd "$root" || exit 1
    echo "WATCHER: monitoring $task_file"

    agentic_mtime() {
      stat -f %m "$1" 2>/dev/null || stat -c %Y "$1" 2>/dev/null
    }

    local last_task_mtime=""
    if [[ -f "$task_file" ]]; then
      last_task_mtime="$(agentic_mtime "$task_file")"
      local pending_run=false
      if [[ ! -f "$done_file" ]]; then
        pending_run=true
      else
        local dt
        dt="$(agentic_mtime "$done_file")"
        if [[ "$dt" -le "$last_task_mtime" ]]; then
          pending_run=true
        fi
      fi
      if [[ "$pending_run" == true ]]; then
        echo "WATCHER: pending task found — launching OpenCode immediately"
        rm -f "$done_file"
        _agentic_watcher_run_job "$root" "$task_file" "$result_file" "$done_file" "$timeout_min"
        last_task_mtime="$(agentic_mtime "$task_file")"
      fi
    fi

    while true; do
      if [[ ! -f "$task_file" ]]; then
        sleep 2
        continue
      fi
      local tt
      tt="$(agentic_mtime "$task_file")"
      if [[ -z "$last_task_mtime" ]]; then
        last_task_mtime="$tt"
      elif [[ "$tt" != "$last_task_mtime" ]]; then
        echo "WATCHER: current-task.md changed — launching OpenCode"
        rm -f "$done_file"
        _agentic_watcher_run_job "$root" "$task_file" "$result_file" "$done_file" "$timeout_min"
        last_task_mtime="$(agentic_mtime "$task_file")"
      fi
      sleep 2
    done
  ) &

  echo $! >"$pid_file"
  echo ""
  echo "WorkflowWatcher started (pid: $(cat "$pid_file"))"
  echo "  Watching: $task_file"
  echo "  OpenCode will fire automatically when current-task.md changes."
  echo "  Use wait_opencode from the project root to poll for completion."
  echo "  Stop with: stop_workflow_watcher"
  echo ""
}

stop_workflow_watcher() {
  local root
  root="$(agentic_resolve_root "${1:-$PWD}")"
  local pid_file="$root/tasks/.workflow_watcher.pid"
  if [[ ! -f "$pid_file" ]]; then
    echo "No WorkflowWatcher pid file."
    return 0
  fi
  local pid
  pid="$(cat "$pid_file")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid" 2>/dev/null || true
    echo "WorkflowWatcher stopped (pid $pid)."
  else
    echo "Watcher not running."
  fi
  rm -f "$pid_file"
}

# ---------------------------------------------------------------------------
# install_workflow — mirrors Install-Workflow (workflow.ps1)
# ---------------------------------------------------------------------------
# Usage: install_workflow [path]   (default: current directory)
# Copies .mdc rules from project .cursor/rules, creates tasks/, CHANGELOG.md, patches .gitignore.
install_workflow() {
  local raw="${1:-$PWD}"
  mkdir -p "$raw"
  local root
  root="$(agentic_resolve_root "$raw")"
  local template_dir
  template_dir="$(cd "$AGENTIC_SCRIPT_DIR/../.." && pwd)/.cursor/rules"

  if [[ ! -d "$template_dir" ]]; then
    template_dir="$(cd "$AGENTIC_SCRIPT_DIR/../cursor-rules" && pwd 2>/dev/null)" || true
  fi
  local any_mdc=false
  for f in "$template_dir"/*.mdc; do
    [[ -f "$f" ]] && any_mdc=true && break
  done
  if [[ ! -d "$template_dir" ]] || [[ "$any_mdc" != true ]]; then
    echo "ERROR: template directory with .mdc files not found (expected: <project>/.cursor/rules)" >&2
    echo "Clone https://github.com/bogachev-alex/agentic_coding or keep rules in .cursor/rules." >&2
    return 1
  fi

  mkdir -p "$root/.cursor/rules" "$root/tasks"

  local f
  local names=()
  for f in "$template_dir"/*.mdc; do
    [[ -f "$f" ]] || continue
    cp -f "$f" "$root/.cursor/rules/"
    names+=("$(basename "$f")")
  done

  if [[ ${#names[@]} -eq 0 ]]; then
    echo "ERROR: no .mdc files in $template_dir" >&2
    return 1
  fi

  if [[ ! -f "$root/CHANGELOG.md" ]]; then
    printf '%s\n' '# Changelog' >"$root/CHANGELOG.md"
  fi

  local gi="$root/.gitignore"
  local block=$'# Agentic workflow — ephemeral task outputs\ntasks/\n'
  if [[ -f "$gi" ]]; then
    if ! grep -qE '^tasks/?$|^/tasks/?$' "$gi" 2>/dev/null && ! grep -q 'tasks/current-task' "$gi" 2>/dev/null; then
      printf '\n%s' "$block" >>"$gi"
    fi
  else
    printf '%s' "$block" >"$gi"
  fi

  echo ""
  echo "Workflow installed in: $root"
  echo "  .cursor/rules/  -- ${#names[@]} rule(s): ${names[*]}"
  echo "  tasks/          -- plan + result dir"
  echo "  CHANGELOG.md    -- created if missing"
  echo "  .gitignore      -- patched for tasks/ if needed"
  echo ""
  echo "Next: open in Cursor, select the model from orchestration.mdc, describe what to build."
}

# ---------------------------------------------------------------------------
# update_workflow_templates — mirrors Update-WorkflowTemplates (workflow.ps1)
# ---------------------------------------------------------------------------
# Usage: update_workflow_templates [source_dir]
# Default source: <project>/.cursor/rules
# Copies into agentic/templates/cursor-rules (for backup / sharing).
update_workflow_templates() {
  local src
  src="$(agentic_resolve_root "${1:-$PWD}")"
  if [[ -d "$src/.cursor/rules" ]]; then
    src="$src/.cursor/rules"
  fi
  if [[ ! -d "$src" ]]; then
    echo "ERROR: not a directory: $src" >&2
    return 1
  fi

  local dest
  dest="$(cd "$AGENTIC_SCRIPT_DIR/.." && pwd)/templates/cursor-rules"
  mkdir -p "$dest"

  local f n=0
  for f in "$src"/*.mdc; do
    [[ -f "$f" ]] || continue
    cp -f "$f" "$dest/"
    n=$((n + 1))
  done

  if [[ "$n" -eq 0 ]]; then
    echo "ERROR: no .mdc files in $src" >&2
    return 1
  fi

  echo "Templates updated in: $dest"
  for f in "$dest"/*.mdc; do
    [[ -f "$f" ]] || continue
    echo "  $(basename "$f")"
  done
}

# ---------------------------------------------------------------------------
# Bash-friendly names mirroring PowerShell (hyphens are invalid in bash function names)
# Windows: Start-WorkflowWatcher, Wait-OpenCode, etc.
# macOS/Linux bash: use these wrappers after source, or ./agentic/agentic from zsh.
# ---------------------------------------------------------------------------
Start_WorkflowWatcher() { start_workflow_watcher "$@"; }
Stop_WorkflowWatcher() { stop_workflow_watcher "$@"; }
Wait_OpenCode() { wait_opencode "$@"; }
Run_OpenCode() { run_opencode "$@"; }
Install_Workflow() { install_workflow "$@"; }
Setup_OpenCode() { bash "$AGENTIC_SCRIPT_DIR/setup-opencode.sh" "$@"; }
Update_WorkflowTemplates() { update_workflow_templates "$@"; }

