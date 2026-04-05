/**
 * Writes test-results/ai-e2e-summary.md for humans and AI agents:
 * per-test outcomes, timings, errors, artifact hints, improvement checklist.
 */
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter'
import fs from 'fs'
import path from 'path'

type Entry = {
  title: string
  file: string
  line: number
  status: string
  duration: number
  error?: string
  stdout: string[]
  stderr: string[]
}

export default class AiSummaryReporter implements Reporter {
  private entries: Entry[] = []
  private startTime = Date.now()

  onTestEnd(test: TestCase, result: TestResult) {
    const stdout = result.stdout.map((s) => s.toString())
    const stderr = result.stderr.map((s) => s.toString())
    this.entries.push({
      title: test.titlePath().join(' › '),
      file: test.location.file,
      line: test.location.line,
      status: result.status,
      duration: result.duration,
      error: result.error?.message,
      stdout,
      stderr,
    })
  }

  onEnd(result: FullResult) {
    const root = process.cwd()
    const outDir = path.join(root, 'test-results')
    fs.mkdirSync(outDir, { recursive: true })
    const elapsed = Date.now() - this.startTime
    const md = this.buildMarkdown(result, elapsed)
    fs.writeFileSync(path.join(outDir, 'ai-e2e-summary.md'), md, 'utf8')
  }

  private buildMarkdown(result: FullResult, elapsedMs: number): string {
    const passed = this.entries.filter((e) => e.status === 'passed').length
    const failed = this.entries.filter((e) => e.status === 'failed').length
    const skipped = this.entries.filter((e) => e.status === 'skipped').length
    const timedOut = this.entries.filter((e) => e.status === 'timedOut').length
    const lines: string[] = []

    lines.push(`# E2E summary (Playwright) — AI agent / team review`)
    lines.push(``)
    lines.push(`Generated: ${new Date().toISOString()}`)
    lines.push(`Overall status: **${result.status}** (exit code implied: ${result.status === 'passed' ? 0 : 1})`)
    lines.push(`Wall time: ${(elapsedMs / 1000).toFixed(1)}s`)
    lines.push(``)
    lines.push(`## Counts`)
    lines.push(`| Outcome | Count |`)
    lines.push(`|---------|-------|`)
    lines.push(`| passed | ${passed} |`)
    lines.push(`| failed | ${failed} |`)
    lines.push(`| skipped | ${skipped} |`)
    lines.push(`| timedOut | ${timedOut} |`)
    lines.push(``)
    lines.push(`## Per-test results`)
    lines.push(``)
    for (const e of this.entries) {
      const ms = e.duration.toFixed(0)
      lines.push(`### ${e.status.toUpperCase()}: ${e.title}`)
      lines.push(`- **File:** \`${e.file}:${e.line}\``)
      lines.push(`- **Duration:** ${ms} ms`)
      if (e.error) {
        lines.push(`- **Error:**`)
        lines.push('```')
        lines.push(e.error.trim())
        lines.push('```')
      }
      if (e.stdout.length) {
        lines.push(`- **stdout (snippet):**`)
        lines.push('```')
        lines.push(e.stdout.join('').slice(0, 2000))
        lines.push('```')
      }
      if (e.stderr.length) {
        lines.push(`- **stderr (snippet):**`)
        lines.push('```')
        lines.push(e.stderr.join('').slice(0, 2000))
        lines.push('```')
      }
      lines.push(``)
    }

    lines.push(`## Artifacts`)
    lines.push(`- HTML report: run \`npx playwright show-report\` (folder: \`playwright-report/\`)`)
    lines.push(`- Traces: \`test-results/**/trace.zip\` (open with \`npx playwright show-trace <path>\`)`)
    lines.push(`- Screenshots / video on failure under \`test-results/\``)
    lines.push(``)

    lines.push(`## What to improve (for product & tests)`)
    lines.push(``)
    if (failed > 0 || timedOut > 0) {
      lines.push(`1. **Fix failing flows first** — see errors above; reproduce with \`npm run test:e2e -- --debug\`.`)
      lines.push(`2. **Stabilize selectors** — prefer \`getByRole\`, \`data-testid\`, avoid brittle CSS.`)
      lines.push(`3. **API / DB** — ensure \`prisma generate\`, migrations, and optional seed for integration.`)
    } else {
      lines.push(`1. **Expand coverage** — admin forms, wallet flows, jury voting, API error paths.`)
      lines.push(`2. **Performance** — flag tests >15s; consider lazy routes and map loading.`)
      lines.push(`3. **A11y** — add @axe-core/playwright or manual keyboard checks.`)
    }
    lines.push(`4. **CI** — set \`CI=1\`, run \`npm run build && npm run start\` for webServer if dev is too slow.`)
    lines.push(`5. **Trace review** — for flaky tests, open trace and verify network + console.`)
    lines.push(``)

    lines.push(`---`)
    lines.push(`*This file is overwritten on each E2E run.*`)

    return lines.join('\n')
  }
}
