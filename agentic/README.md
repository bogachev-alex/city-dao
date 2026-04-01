# Agentic coding workflow (local development)

This folder vendors the workflow from [bogachev-alex/agentic_coding](https://github.com/bogachev-alex/agentic_coding) for use in this repository.

## What is installed

| Path | Purpose |
|------|---------|
| `.cursor/rules/*.mdc` | Cursor rules: orchestration, code standards, documentation, environment |
| `agentic/powershell/workflow.ps1` | PowerShell helpers (Windows): watcher, `Wait-OpenCode`, `Run-OpenCode`, `Install-Workflow`, `Setup-OpenCode` |
| `agentic/scripts/workflow.sh` | Bash helpers: watcher, wait, run, install, update-templates (source from **bash** only) |
| `agentic/scripts/setup-opencode.sh` | One-time OpenCode + ZhipuAI GLM-5 setup (macOS / Linux; zsh/bash) |
| `agentic/agentic` | **CLI entrypoint for macOS / Linux (including zsh)** — wraps `workflow.sh` in bash so you never need to `source` from zsh |

Ephemeral task outputs live under `tasks/` (gitignored). Do not commit that directory.

## Prerequisites

- **Cursor** with the model choices described in `.cursor/rules/orchestration.mdc`.
- **OpenCode** CLI with the GLM-5 provider configured (see below).

### OpenCode setup

`Setup-OpenCode` is a **PowerShell function** inside `workflow.ps1`. It is **not** a global shell command in zsh.

**macOS / Linux (recommended in zsh Terminal):**

```bash
cd /path/to/city-dao
./agentic/agentic setup
# or
./agentic/scripts/setup-opencode.sh
```

Non-interactive: `ZHIPU_API_KEY=your-key ./agentic/agentic setup`

**If you use PowerShell Core (`pwsh`) on Mac:**

```powershell
cd /path/to/city-dao
. ./agentic/powershell/workflow.ps1
Setup-OpenCode
```

**Windows:** open PowerShell and dot-source `workflow.ps1`, then `Setup-OpenCode`.

---

## macOS / Linux — full flow (zsh-friendly)

Work from the **repository root** unless the command takes a path.

| Step | Command |
|------|---------|
| One-time OpenCode + API | `./agentic/agentic setup` |
| Scaffold another clone (optional) | `./agentic/agentic install` or `./agentic/agentic install /path/to/project` |
| Start watcher (once per session) | `./agentic/agentic watch` |
| After writing `tasks/current-task.md` | `./agentic/agentic wait` (repeat until `OPENCODE_DONE`) |
| Stop watcher | `./agentic/agentic stop-watcher` |
| Manual OpenCode run (fallback if watcher off) | `./agentic/agentic run` |
| Backup `.mdc` rules to `agentic/templates/cursor-rules` | `./agentic/agentic update-templates` |

Optional **alias** in `~/.zshrc`:

```bash
alias agentic='/path/to/city-dao/agentic/agentic'
```

### Bash-only (underscore wrappers; bash cannot define `Wait-OpenCode` with a hyphen)

If you use **bash** in the terminal:

```bash
cd /path/to/city-dao
source agentic/scripts/workflow.sh
mkdir -p tasks
Start_WorkflowWatcher    # → start_workflow_watcher
Wait_OpenCode            # → wait_opencode
Install_Workflow         # → install_workflow
Setup_OpenCode           # → setup-opencode.sh
```

PowerShell on Windows uses hyphenated names (`Start-WorkflowWatcher`, `Wait-OpenCode`). On macOS / Linux use the names above or the `snake_case` originals.

Do **not** `source workflow.sh` from **zsh** — use `./agentic/agentic` instead.

### Optional: GNU timeout on macOS

The watcher uses `timeout` / `gtimeout` for long OpenCode runs when available. Stock macOS has no `timeout`; install GNU coreutils for `gtimeout`:

```bash
brew install coreutils
```

Without it, OpenCode runs without a subprocess timeout (the script still records completion in `tasks/done.md`).

---

## Quick start (Windows)

In PowerShell, from the repo root:

```powershell
. .\agentic\powershell\workflow.ps1
New-Item -Force -Path .\tasks -ItemType Directory
Start-WorkflowWatcher
# After writing tasks\current-task.md:
Wait-OpenCode
```

To scaffold rules into another clone (optional), use `Install-Workflow` from `workflow.ps1`; templates are resolved from `.cursor\rules` in this repo.

---

## Upstream updates

To refresh rules from the upstream repository, clone [agentic_coding](https://github.com/bogachev-alex/agentic_coding) and copy `cursor-rules/*.mdc` into `.cursor/rules/`, then adjust any project-specific paths if needed.
