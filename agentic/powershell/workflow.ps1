# Agentic Coding Workflow — PowerShell Functions
# Source: https://github.com/bogachev-alex/agentic_coding
#
# Add to your PowerShell profile:
#   . "C:\path\to\agentic_coding\powershell\workflow.ps1"
#
# Functions:
#   Start-WorkflowWatcher    — start once per session; auto-runs OpenCode when current-task.md changes
#   Stop-WorkflowWatcher     — stop the background watcher
#   Wait-OpenCode            — short poll (90s); called by Cursor to check completion; returns OPENCODE_DONE or STILL_RUNNING
#   Run-OpenCode             — run OpenCode manually (fallback / standalone use)
#   Install-Workflow         — scaffold .cursor/rules/, tasks/, CHANGELOG.md in a project
#   Setup-OpenCode           — install opencode-ai + configure ZhipuAI GLM-5
#   Update-WorkflowTemplates — sync .mdc templates from a source project

# ---------------------------------------------------------------------------
# Start-WorkflowWatcher
# ---------------------------------------------------------------------------
# Starts a FileSystemWatcher in a background job.
# Monitors tasks/current-task.md for changes; when it changes, automatically
# runs Run-OpenCode. Writes tasks/done.md with a timestamp when OpenCode finishes.
# Cursor calls Wait-OpenCode to poll for that file.
#
# Usage:
#   Set-Location C:\path\to\project
#   Start-WorkflowWatcher          (watches current directory)
#   Start-WorkflowWatcher -Path C:\other\project
#
# Stop with: Stop-WorkflowWatcher
function Start-WorkflowWatcher {
    param(
        [string]$Path = (Get-Location),
        [int]$TimeoutMin = 20
    )

    $Root       = (Resolve-Path $Path).Path
    $TaskFile   = "$Root\tasks\current-task.md"
    $ResultFile = "$Root\tasks\result.md"
    $DoneFile   = "$Root\tasks\done.md"

    # Stop any existing watcher first
    Stop-WorkflowWatcher -Silent

    New-Item -Force -Path "$Root\tasks" -ItemType Directory | Out-Null

    $Global:WorkflowWatcherJob = Start-Job -Name "WorkflowWatcher" -ScriptBlock {
        param($root, $taskFile, $resultFile, $doneFile, $timeoutMin)

        $watcher = New-Object System.IO.FileSystemWatcher
        $watcher.Path   = Split-Path $taskFile
        $watcher.Filter = Split-Path $taskFile -Leaf
        $watcher.NotifyFilter = [System.IO.NotifyFilters]::LastWrite
        $watcher.EnableRaisingEvents = $true

        Write-Output "WATCHER: monitoring $taskFile"

        # If a task is already pending when the watcher starts, run it immediately.
        # A task is "pending" if current-task.md exists and done.md is absent or older.
        $pendingRun = $false
        if (Test-Path $taskFile) {
            $taskTime = (Get-Item $taskFile).LastWriteTime
            $doneExists = Test-Path $doneFile
            if (-not $doneExists -or (Get-Item $doneFile).LastWriteTime -le $taskTime) {
                Write-Output "WATCHER: pending task found — launching OpenCode immediately"
                if (Test-Path $doneFile) { Remove-Item $doneFile -Force }
                $pendingRun = $true
            }
        }

        while ($true) {
            if (-not $pendingRun) {
                $change = $watcher.WaitForChanged([System.IO.WatcherChangeTypes]::Changed, 5000)
                if ($change.TimedOut) { continue }
                Write-Output "WATCHER: current-task.md changed — launching OpenCode"
                # Remove stale done.md so Cursor doesn't pick up old signal
                if (Test-Path $doneFile) { Remove-Item $doneFile -Force }
            }
            $pendingRun = $false

            $prompt = "Implement the plan in the attached file exactly as described. Follow all constraints."
            $job = Start-Job -ScriptBlock {
                param($prompt, $file, $result)
                opencode run -m zai-coding-plan/glm-5 --print-logs $prompt -f $file |
                    Tee-Object -FilePath $result
            } -ArgumentList $prompt, $taskFile, $resultFile

            $deadline     = (Get-Date).AddMinutes($timeoutMin)
            $lastCount    = 0
            $lastErrCount = 0

            while ($job.State -eq 'Running' -and (Get-Date) -lt $deadline) {
                Start-Sleep -Seconds 3

                $lines = @(Receive-Job $job -Keep)
                if ($lines.Count -gt $lastCount) {
                    $lines[$lastCount..($lines.Count - 1)] | ForEach-Object { Write-Output $_ }
                    $lastCount = $lines.Count
                }

                $errs = @($job.ChildJobs[0].Error)
                if ($errs.Count -gt $lastErrCount) {
                    $errs[$lastErrCount..($errs.Count - 1)] |
                        ForEach-Object { Write-Output "[log] $_" }
                    $lastErrCount = $errs.Count
                }
            }

            if ($job.State -eq 'Running') {
                Stop-Job $job
                Get-Process -Name opencode -ErrorAction SilentlyContinue | Stop-Process -Force
                Remove-Job $job
                $status = "TIMEOUT after $timeoutMin min"
            } else {
                $lines = @(Receive-Job $job)
                if ($lines.Count -gt $lastCount) {
                    $lines[$lastCount..($lines.Count - 1)] | ForEach-Object { Write-Output $_ }
                }
                Remove-Job $job
                $status = if (Test-Path $resultFile) { "OK" } else { "ERROR: no result.md" }
            }

            # Write done signal — Cursor reads this via Wait-OpenCode
            Set-Content -Path $doneFile -Encoding utf8 -Value "OPENCODE_DONE`nStatus: $status`nTimestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
            Write-Output "WATCHER: done — $status — wrote $doneFile"
        }
    } -ArgumentList $Root, $TaskFile, $ResultFile, $DoneFile, $TimeoutMin

    Write-Host ""
    Write-Host "WorkflowWatcher started (job: $($Global:WorkflowWatcherJob.Id))" -ForegroundColor Green
    Write-Host "  Watching: $TaskFile"
    Write-Host "  OpenCode will fire automatically when current-task.md changes."
    Write-Host "  Cursor uses Wait-OpenCode to poll for completion."
    Write-Host "  Stop with: Stop-WorkflowWatcher"
    Write-Host ""
}

# ---------------------------------------------------------------------------
# Stop-WorkflowWatcher
# ---------------------------------------------------------------------------
function Stop-WorkflowWatcher {
    param([switch]$Silent)

    $jobs = @(Get-Job -Name "WorkflowWatcher" -ErrorAction SilentlyContinue)
    if ($Global:WorkflowWatcherJob) { $jobs += $Global:WorkflowWatcherJob }
    $jobs = $jobs | Select-Object -Unique

    if ($jobs.Count -eq 0) {
        if (-not $Silent) { Write-Host "No WorkflowWatcher running." }
        return
    }

    $jobs | ForEach-Object { Stop-Job $_; Remove-Job $_ }
    $Global:WorkflowWatcherJob = $null

    if (-not $Silent) { Write-Host "WorkflowWatcher stopped." -ForegroundColor Yellow }
}

# ---------------------------------------------------------------------------
# Wait-OpenCode
# ---------------------------------------------------------------------------
# Short poll (default 90 seconds) safe within Cursor's tool timeout.
# Checks tasks/done.md for a timestamp newer than tasks/current-task.md.
# Returns "OPENCODE_DONE" (and exits) or "STILL_RUNNING" when the poll times out.
#
# Cursor calls this in a loop:
#   1. Write current-task.md
#   2. Run Wait-OpenCode  → if STILL_RUNNING, run Wait-OpenCode again
#   3. Repeat until OPENCODE_DONE appears
function Wait-OpenCode {
    param(
        [string]$Path      = (Get-Location),
        [int]$PollSeconds  = 90
    )

    $Root     = (Resolve-Path $Path).Path
    $TaskFile = "$Root\tasks\current-task.md"
    $DoneFile = "$Root\tasks\done.md"

    if (-not (Test-Path $TaskFile)) {
        Write-Host "WAIT_ERROR: tasks/current-task.md not found"
        return
    }

    $taskTime = (Get-Item $TaskFile).LastWriteTime
    $deadline = (Get-Date).AddSeconds($PollSeconds)

    Write-Host "Waiting for OpenCode (up to ${PollSeconds}s)..."

    while ((Get-Date) -lt $deadline) {
        if (Test-Path $DoneFile) {
            $doneTime = (Get-Item $DoneFile).LastWriteTime
            if ($doneTime -gt $taskTime) {
                $content = Get-Content $DoneFile -Raw
                Write-Host $content
                Write-Host "OPENCODE_DONE"
                return
            }
        }

        # Also print any new watcher output from the background job
        $job = Get-Job -Name "WorkflowWatcher" -ErrorAction SilentlyContinue
        if ($job) {
            $lines = @(Receive-Job $job -Keep)
            # only print lines added since last check — use a global counter
            if (-not $Global:WaitOpenCodeLastLine) { $Global:WaitOpenCodeLastLine = 0 }
            if ($lines.Count -gt $Global:WaitOpenCodeLastLine) {
                $lines[$Global:WaitOpenCodeLastLine..($lines.Count - 1)] | Write-Host
                $Global:WaitOpenCodeLastLine = $lines.Count
            }
        }

        Start-Sleep -Seconds 5
    }

    Write-Host "STILL_RUNNING"
}

# ---------------------------------------------------------------------------
# Run-OpenCode
# ---------------------------------------------------------------------------
# Runs OpenCode in a background job against the current task file.
# Task file priority:
#   1. tasks/current-task.md        (written by Cursor for each build-loop step)
#   2. .cursor/plans/*.md           (project-local Cursor native plans)
#   3. %USERPROFILE%\.cursor\plans\*.md  (global Cursor native plans)
#
# Polls output every 3 seconds. Timeout: 20 minutes.
# Prints "OPENCODE_DONE" when finished (or timed out).
# User should reply with OPENCODE_DONE in Cursor chat after seeing it here.
function Run-OpenCode {
    $ProjectDir = Get-Location
    $ResultFile = "$ProjectDir\tasks\result.md"

    # Resolve task file
    $TaskFile = $null

    $Primary = "$ProjectDir\tasks\current-task.md"
    if (Test-Path $Primary) {
        $TaskFile = $Primary
    }

    if (-not $TaskFile) {
        foreach ($PlansDir in @("$ProjectDir\.cursor\plans", "$env:USERPROFILE\.cursor\plans", "$env:USERPROFILE\.claude\plans")) {
            if (Test-Path $PlansDir) {
                $Latest = Get-ChildItem "$PlansDir\*.md" -ErrorAction SilentlyContinue |
                          Sort-Object LastWriteTime -Descending |
                          Select-Object -First 1
                if ($Latest) { $TaskFile = $Latest.FullName; break }
            }
        }
    }

    if (-not $TaskFile) {
        Write-Host "No task file found. Checked:"
        Write-Host "  1. $Primary"
        Write-Host "  2. $ProjectDir\.cursor\plans\*.md"
        Write-Host "  3. $env:USERPROFILE\.cursor\plans\*.md"
        return
    }

    $FirstLine   = (Get-Content $TaskFile -First 1)
    $ProjectName = Split-Path $ProjectDir -Leaf
    $TimeoutMin  = 20

    Write-Host "Running OpenCode (timeout: $TimeoutMin min)..."
    Write-Host "Plan: $TaskFile"
    Write-Host "Task: $FirstLine"
    Write-Host "---"

    New-Item -Force -Path "$ProjectDir\tasks" -ItemType Directory | Out-Null

    $prompt = "Implement the plan in the attached file exactly as described. Follow all constraints."
    $job = Start-Job -ScriptBlock {
        param($prompt, $file, $result)
        opencode run -m zai-coding-plan/glm-5 --print-logs $prompt -f $file |
            Tee-Object -FilePath $result
    } -ArgumentList $prompt, $TaskFile, $ResultFile

    $deadline     = (Get-Date).AddMinutes($TimeoutMin)
    $lastCount    = 0
    $lastErrCount = 0

    while ($job.State -eq 'Running' -and (Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 3

        $lines = @(Receive-Job $job -Keep)
        if ($lines.Count -gt $lastCount) {
            $lines[$lastCount..($lines.Count - 1)] | ForEach-Object { Write-Host $_ }
            $lastCount = $lines.Count
        }

        $errs = @($job.ChildJobs[0].Error)
        if ($errs.Count -gt $lastErrCount) {
            $errs[$lastErrCount..($errs.Count - 1)] |
                ForEach-Object { Write-Host "[log] $_" -ForegroundColor DarkGray }
            $lastErrCount = $errs.Count
        }
    }

    if ($job.State -eq 'Running') {
        Stop-Job $job
        Get-Process -Name opencode -ErrorAction SilentlyContinue | Stop-Process -Force
        Remove-Job $job
        Write-Host "TIMEOUT: OpenCode exceeded $TimeoutMin min. Check model name and network."
        Send-Notification -Title "OpenCode: $ProjectName" -Body "TIMEOUT after $TimeoutMin min"
        Write-Host "OPENCODE_DONE"
        return
    }

    $lines = @(Receive-Job $job)
    if ($lines.Count -gt $lastCount) {
        $lines[$lastCount..($lines.Count - 1)] | ForEach-Object { Write-Host $_ }
    }
    Remove-Job $job

    Write-Host "---"
    Write-Host "Done: $ResultFile"

    if (Test-Path $ResultFile) {
        Send-Notification -Title "OpenCode: $ProjectName" -Body "Done. Result in tasks/result.md"
    } else {
        Send-Notification -Title "OpenCode: $ProjectName" -Body "Finished with errors - no result.md written"
    }

    Write-Host "OPENCODE_DONE"
}

# ---------------------------------------------------------------------------
# Install-Workflow
# ---------------------------------------------------------------------------
# Scaffolds the Cursor+OpenCode workflow into a project directory.
#
# Usage:
#   Install-Workflow              (installs into current directory)
#   Install-Workflow -Path C:\my\project
#
# Rule templates are read from cursor-rules/ next to this script.
# To update templates: run Update-WorkflowTemplates.
function Install-Workflow {
    param(
        [string]$Path = (Get-Location)
    )

    $Root        = Resolve-Path $Path
    # city-dao: rule templates live in project .cursor/rules (next to this script: agentic/powershell -> ../../.cursor/rules)
    $TemplateDir = Join-Path $PSScriptRoot "..\..\.cursor\rules"

    if (-not (Test-Path $TemplateDir)) {
        $TemplateDir = Join-Path $PSScriptRoot "..\cursor-rules"
    }

    if (-not (Test-Path $TemplateDir)) {
        # Fall back to cursor-rules/ next to the PS profile
        $TemplateDir = Join-Path (Split-Path $PROFILE) "cursor-rules"
    }

    if (-not (Test-Path $TemplateDir)) {
        Write-Host "ERROR: template directory not found: $TemplateDir"
        Write-Host "Clone https://github.com/bogachev-alex/agentic_coding and point -TemplateDir to cursor-rules/."
        return
    }

    $RuleFiles = @(Get-ChildItem "$TemplateDir\*.mdc" -ErrorAction SilentlyContinue)
    if ($RuleFiles.Count -eq 0) {
        Write-Host "ERROR: no .mdc files found in $TemplateDir"
        return
    }

    New-Item -Force -Path "$Root\.cursor\rules" -ItemType Directory | Out-Null
    New-Item -Force -Path "$Root\tasks"         -ItemType Directory | Out-Null

    $RuleFiles | ForEach-Object {
        Copy-Item -Path $_.FullName -Destination "$Root\.cursor\rules\" -Force
    }

    $Changelog = "$Root\CHANGELOG.md"
    if (-not (Test-Path $Changelog)) {
        Set-Content -Path $Changelog -Encoding utf8 -Value "# Changelog"
    }

    $GitIgnore  = "$Root\.gitignore"
    $NewEntries = "`n# Workflow task files (ephemeral)`ntasks/current-task.md`ntasks/result.md`ntasks/plan.md"
    if (Test-Path $GitIgnore) {
        $Content = Get-Content $GitIgnore -Raw
        if ($Content -notmatch "tasks/current-task\.md") {
            Add-Content -Path $GitIgnore -Value $NewEntries
        }
    } else {
        Set-Content -Path $GitIgnore -Encoding utf8 -Value $NewEntries.TrimStart()
    }

    Write-Host ""
    Write-Host "Workflow installed in: $Root"
    Write-Host "  .cursor\rules\  -- $($RuleFiles.Count) rule(s) copied: $($RuleFiles.Name -join ', ')"
    Write-Host "  tasks\          -- plan + result dir"
    Write-Host "  CHANGELOG.md    -- created (if not existed)"
    Write-Host "  .gitignore      -- patched (current-task.md, result.md, plan.md excluded)"
    Write-Host ""
    Write-Host "Next: open in Cursor, select claude-opus-4-5, describe what to build."
}

# ---------------------------------------------------------------------------
# Setup-OpenCode
# ---------------------------------------------------------------------------
# Installs OpenCode globally and configures the ZhipuAI provider for GLM-5.
#
# Usage:
#   Setup-OpenCode                          (interactive — prompts for API key)
#   Setup-OpenCode -ApiKey "your-key"       (non-interactive)
#   Setup-OpenCode -Force                   (reinstall even if already present)
#   Setup-OpenCode -BaseUrl "https://..."   (override API endpoint)
function Setup-OpenCode {
    param(
        [string]$ApiKey,
        [switch]$Force,
        [string]$BaseUrl = 'https://open.bigmodel.cn/api/paas/v4'
    )

    $ProviderId = 'zai-coding-plan'
    $ModelName  = 'glm-5'
    $ModelId    = "$ProviderId/$ModelName"
    $EnvVar     = 'ZHIPU_API_KEY'
    $ConfigDir  = "$env:USERPROFILE\.config\opencode"
    $ConfigFile = "$ConfigDir\opencode.json"

    Write-Host ""
    Write-Host "=== Setup-OpenCode ===" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "[1/5] Checking Node.js..." -ForegroundColor Yellow
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "  ERROR: Node.js not installed." -ForegroundColor Red
        Write-Host "  Download: https://nodejs.org (LTS)" -ForegroundColor White
        return
    }
    $nodeVer = & node --version 2>$null
    Write-Host "  OK  Node.js $nodeVer" -ForegroundColor Green

    Write-Host "[2/5] Checking OpenCode installation..." -ForegroundColor Yellow
    $ocCmd = Get-Command opencode -ErrorAction SilentlyContinue
    if ($ocCmd -and -not $Force) {
        $ocVer = (& opencode --version 2>$null) -join ''
        Write-Host "  OK  opencode $ocVer already installed (use -Force to reinstall)" -ForegroundColor Green
    } else {
        Write-Host "  Installing opencode-ai via npm..." -ForegroundColor White
        & npm install -g opencode-ai@latest
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ERROR: npm install failed (exit $LASTEXITCODE)" -ForegroundColor Red
            return
        }
        $ocVer = (& opencode --version 2>$null) -join ''
        Write-Host "  OK  opencode $ocVer installed" -ForegroundColor Green
    }

    Write-Host "[3/5] Configuring API key ($EnvVar)..." -ForegroundColor Yellow
    if (-not $ApiKey) { $ApiKey = [System.Environment]::GetEnvironmentVariable($EnvVar, 'User') }
    if (-not $ApiKey) { $ApiKey = [System.Environment]::GetEnvironmentVariable($EnvVar, 'Process') }
    if (-not $ApiKey) {
        Write-Host ""
        Write-Host "  Enter your ZhipuAI API key (https://open.bigmodel.cn -> API Keys):" -ForegroundColor Yellow
        $ApiKey = Read-Host "  Key"
        if (-not $ApiKey) {
            Write-Host "  ERROR: no API key entered." -ForegroundColor Red
            return
        }
    }
    [System.Environment]::SetEnvironmentVariable($EnvVar, $ApiKey, 'User')
    [System.Environment]::SetEnvironmentVariable($EnvVar, $ApiKey, 'Process')
    Write-Host "  OK  $EnvVar saved to user environment" -ForegroundColor Green

    Write-Host "[4/5] Writing $ConfigFile..." -ForegroundColor Yellow
    New-Item -Force -Path $ConfigDir -ItemType Directory | Out-Null

    $ConfigJson = @"
{
  "`$schema": "https://opencode.ai/config.json",
  "model": "$ModelId",
  "provider": {
    "$ProviderId": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "ZhipuAI GLM",
      "options": {
        "baseURL": "$BaseUrl",
        "apiKey": "{env:$EnvVar}"
      },
      "models": {
        "$ModelName": {
          "name": "GLM-5",
          "limit": {
            "context": 128000,
            "output": 8192
          }
        }
      }
    }
  }
}
"@
    Set-Content -Path $ConfigFile -Encoding utf8 -Value $ConfigJson
    Write-Host "  OK  config written" -ForegroundColor Green

    Write-Host "[5/5] Installing @ai-sdk/openai-compatible in plugin dir..." -ForegroundColor Yellow
    Push-Location $ConfigDir
    try {
        if (Get-Command bun -ErrorAction SilentlyContinue) {
            & bun add @ai-sdk/openai-compatible 2>&1 | Out-Null
        } else {
            & npm install @ai-sdk/openai-compatible --save 2>&1 | Out-Null
        }
        Write-Host "  OK  @ai-sdk/openai-compatible ready" -ForegroundColor Green
    } catch {
        Write-Host "  WARN: could not install SDK - OpenCode may handle it automatically" -ForegroundColor DarkYellow
    } finally {
        Pop-Location
    }

    Write-Host ""
    Write-Host "OpenCode is ready!" -ForegroundColor Green
    Write-Host "  Model:   $ModelId"
    Write-Host "  API:     $BaseUrl"
    Write-Host "  API key: $EnvVar (saved to user environment)"
    Write-Host "  Config:  $ConfigFile"
    Write-Host ""
    Write-Host "Test with: opencode run -m $ModelId 'Say hello in one sentence'" -ForegroundColor Yellow
    Write-Host ""
}

# ---------------------------------------------------------------------------
# Update-WorkflowTemplates
# ---------------------------------------------------------------------------
# Syncs .mdc rule files from a source project into cursor-rules/ next to this script.
#
# Usage:
#   Update-WorkflowTemplates
#   Update-WorkflowTemplates -Source C:\other\project\.cursor\rules
function Update-WorkflowTemplates {
    param(
        [string]$Source = "C:\Users\alexa\OneDrive\Documents\Code\accountant\.cursor\rules"
    )

    $TemplateDir = Join-Path $PSScriptRoot "..\cursor-rules"

    New-Item -Force -Path $TemplateDir -ItemType Directory | Out-Null

    $Files = @(Get-ChildItem "$Source\*.mdc" -ErrorAction SilentlyContinue)
    if ($Files.Count -eq 0) {
        Write-Host "ERROR: no .mdc files found in $Source"
        return
    }

    $Files | ForEach-Object { Copy-Item -Path $_.FullName -Destination $TemplateDir -Force }

    Write-Host "Templates updated in: $TemplateDir"
    Write-Host "  Copied: $($Files.Name -join ', ')"
}

# ---------------------------------------------------------------------------
# Send-Notification (helper)
# ---------------------------------------------------------------------------
# Windows toast notification. Falls back to a console beep if WinRT unavailable.
function Send-Notification {
    param(
        [string]$Title,
        [string]$Body
    )
    try {
        [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent(
            [Windows.UI.Notifications.ToastTemplateType]::ToastText02
        )
        $template.SelectSingleNode('//text[@id="1"]').InnerText = $Title
        $template.SelectSingleNode('//text[@id="2"]').InnerText = $Body
        $toast = [Windows.UI.Notifications.ToastNotification]::new($template)
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("OpenCode").Show($toast)
    } catch {
        [System.Media.SystemSounds]::Exclamation.Play()
    }
}
