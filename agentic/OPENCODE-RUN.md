# Run implementation tasks with OpenCode

`tasks/current-task.md` is the task OpenCode executes. The watcher runs OpenCode when that file changes.

## One-time

- Install CLI and model: `./agentic/agentic setup` (or `Setup-OpenCode` in PowerShell).
- Ensure `opencode` is on your `PATH` and `ZHIPU_API_KEY` is set if you use GLM-5.

## Each session (from repo root)

**Terminal 1 — watcher**

```bash
cd /path/to/city-dao
./agentic/agentic watch
```

**Terminal 2 — wait for completion** (after you save `tasks/current-task.md` or the watcher picks up a pending task)

```bash
./agentic/agentic wait
```

Repeat `wait` until you see **`OPENCODE_DONE`** in the output. Results stream to **`tasks/result.md`**.

**Stop the watcher**

```bash
./agentic/agentic stop-watcher
```

## Manual run (no watcher)

```bash
./agentic/agentic run
```

Uses `tasks/current-task.md`, or the latest plan under `.cursor/plans`, `~/.cursor/plans`, or `~/.claude/plans`.

## Edit the task

1. Edit **`tasks/current-task.md`** with a single focused task (see orchestration rules).
2. Save — the watcher triggers OpenCode.
3. Poll with **`./agentic/agentic wait`**.

## PowerShell (Windows)

```powershell
. .\agentic\powershell\workflow.ps1
Start-WorkflowWatcher
Wait-OpenCode
```
