/**
 * OpenAI-driven browser agent: explores the app via Playwright tools, logs actions,
 * writes test-results/ai-agent-session.md and test-results/ai-agent-summary.md.
 *
 * Requires: OPENAI_API_KEY, running app (npm run dev) or PLAYWRIGHT_BASE_URL.
 *
 * Foreground: npx tsx scripts/ai-playwright-agent.ts
 * Background: npx tsx scripts/ai-playwright-agent.ts --background
 */
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import OpenAI from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import { chromium, type Page } from 'playwright'

const OUT_DIR = path.join(process.cwd(), 'test-results')
const SESSION_LOG = path.join(OUT_DIR, 'ai-agent-session.md')
const SUMMARY_OUT = path.join(OUT_DIR, 'ai-agent-summary.md')
const PID_FILE = path.join(OUT_DIR, 'ai-agent.pid')
const BG_LOG = path.join(OUT_DIR, 'ai-agent-console.log')

function assertLocalBaseUrl(base: string) {
  let u: URL
  try {
    u = new URL(base)
  } catch {
    throw new Error(`Invalid PLAYWRIGHT_BASE_URL: ${base}`)
  }
  const host = u.hostname
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(
      `Refusing non-local base URL (${host}). Set PLAYWRIGHT_BASE_URL to http://127.0.0.1:PORT for safety.`,
    )
  }
}

function toAbsoluteUrl(baseURL: string, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl
  const b = baseURL.replace(/\/$/, '')
  const p = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return b + p
}

const tools: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'browser_goto',
      description:
        'Navigate the tab to a path (e.g. /ru, /ru/contracts) or full http URL on the same origin.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path starting with / or full URL' },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_click_text',
      description: 'Click the first visible element whose text contains the given substring.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          exact: { type: 'boolean', description: 'If true, match exact text' },
        },
        required: ['text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_snapshot',
      description:
        'Return truncated visible text from main/body for reasoning (not a screenshot).',
      parameters: {
        type: 'object',
        properties: {
          maxChars: { type: 'number', description: 'Default 12000' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'browser_set_local_storage',
      description:
        'Set a localStorage key on the current origin (e.g. straita_auth JSON for demo roles).',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['key', 'value'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'session_done',
      description:
        'Call when exploration is finished. Provide markdown summary and a bullet list of improvements.',
      parameters: {
        type: 'object',
        properties: {
          summary_markdown: { type: 'string' },
          improvements_markdown: { type: 'string' },
        },
        required: ['summary_markdown', 'improvements_markdown'],
      },
    },
  },
]

async function applyTool(
  page: Page,
  baseURL: string,
  name: string,
  args: Record<string, unknown>,
): Promise<{ text: string }> {
  switch (name) {
    case 'browser_goto': {
      const pathOrUrl = String(args.path)
      const url = toAbsoluteUrl(baseURL, pathOrUrl)
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90_000 })
      return { text: JSON.stringify({ ok: true, url: page.url(), title: await page.title() }) }
    }
    case 'browser_click_text': {
      const text = String(args.text)
      const exact = Boolean(args.exact)
      const loc = exact ? page.getByText(text, { exact: true }) : page.getByText(text)
      await loc.first().click({ timeout: 15_000 })
      return { text: JSON.stringify({ ok: true, clicked: text }) }
    }
    case 'browser_snapshot': {
      const max = typeof args.maxChars === 'number' ? args.maxChars : 12_000
      const main = page.locator('main')
      const raw = (await main.count()) > 0 ? await main.first().innerText() : await page.locator('body').innerText()
      const body = raw.length > max ? raw.slice(0, max) + '\n…[truncated]' : raw
      return { text: body }
    }
    case 'browser_set_local_storage': {
      const key = String(args.key)
      const value = String(args.value)
      await page.evaluate(
        ([k, v]) => {
          localStorage.setItem(k, v)
        },
        [key, value],
      )
      return { text: JSON.stringify({ ok: true, key }) }
    }
    case 'session_done': {
      return {
        text: JSON.stringify({ finished: true }),
      }
    }
    default:
      return { text: JSON.stringify({ error: `unknown tool ${name}` }) }
  }
}

function appendSession(line: string) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.appendFileSync(SESSION_LOG, line + '\n', 'utf8')
}

function writeSummary(
  baseURL: string,
  model: string,
  steps: number,
  finalSummary: string,
  improvements: string,
  error?: string,
) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const ts = new Date().toISOString()
  const errBlock = error ? `\n## Error\n\n\`\`\`\n${error}\n\`\`\`\n` : ''
  const md = `# AI agent run (OpenAI + Playwright)

Generated: ${ts}
Base URL: \`${baseURL}\`
Model: \`${model}\`
Tool steps: ${steps}
${errBlock}
## Summary

${finalSummary}

## What to improve

${improvements}

---

*Session log: \`test-results/ai-agent-session.md\`*
`
  fs.writeFileSync(SUMMARY_OUT, md, 'utf8')
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    console.error('Missing OPENAI_API_KEY. Add it to .env.local or the environment.')
    process.exit(1)
  }

  const baseURL = (process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '')
  assertLocalBaseUrl(baseURL)

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const maxSteps = Math.min(80, Math.max(5, Number(process.env.AI_AGENT_MAX_STEPS || 35)))

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(
    SESSION_LOG,
    `# AI agent session\n\nStarted: ${new Date().toISOString()}\nBase: ${baseURL}\n\n`,
    'utf8',
  )

  const openai = new OpenAI({ apiKey })
  const browser = await chromium.launch({ headless: true })
  let closed = false
  const context = await browser.newContext({ locale: 'ru-RU' })
  const page = await context.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error') appendSession(`[console.error] ${msg.text()}`)
  })

  const system = `You are a QA agent testing the Straita web app (Russian UI under /ru).
Use the browser_* tools to explore. Goals:
- Open home /ru, confirm map or main content loads.
- Visit /ru/contracts, /ru/login, /ru/blockchain briefly.
- Optionally set localStorage key "straita_auth" to a JSON demo user for CONTRACTOR or AKIMAT and open /ru/contractor or /ru/akimat if time allows.
When satisfied or after a reasonable path, call session_done with a concise summary and improvement bullets (product + test stability).
Respond in Russian for user-facing descriptions in the summary.`

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: system },
    {
      role: 'user',
      content: `Start at ${baseURL}/ru and explore. Max about ${maxSteps} tool rounds.`,
    },
  ]

  let step = 0
  let finalSummary = ''
  let finalImprovements = ''
  let lastError: string | undefined

  try {
    while (step < maxSteps) {
      step++
      const completion = await openai.chat.completions.create({
        model,
        messages,
        tools,
        tool_choice: 'auto',
        temperature: 0.2,
      })
      const choice = completion.choices[0]
      const msg = choice?.message
      if (!msg) break

      messages.push(msg)

      if (msg.content) {
        appendSession(`\n### Assistant\n\n${msg.content}\n`)
      }

      const calls = msg.tool_calls
      if (!calls?.length) {
        appendSession('\n(no tool calls — stopping)\n')
        break
      }

      for (const call of calls) {
        if (call.type !== 'function') continue
        const name = call.function.name
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
        } catch {
          args = {}
        }
        appendSession(`\n**Tool ${name}**\n\n\`\`\`json\n${JSON.stringify(args, null, 2)}\n\`\`\`\n`)

        if (name === 'session_done') {
          finalSummary = String(args.summary_markdown || '')
          finalImprovements = String(args.improvements_markdown || '')
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            content: '{"ok":true}',
          })
          if (!closed) {
            closed = true
            await browser.close()
          }
          writeSummary(baseURL, model, step, finalSummary, finalImprovements)
          console.log(`Done. Summary: ${SUMMARY_OUT}`)
          return
        }

        let toolText: string
        try {
          const r = await applyTool(page, baseURL, name, args)
          toolText = r.text
        } catch (e) {
          const err = e instanceof Error ? e.message : String(e)
          toolText = JSON.stringify({ error: err })
          lastError = err
        }
        appendSession(`**Result:**\n\n\`\`\`\n${toolText.slice(0, 8000)}\n\`\`\`\n`)
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: toolText.slice(0, 14_000),
        })
      }
    }
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e)
  } finally {
    if (!closed) {
      try {
        await browser.close()
      } catch {
        /* ignore */
      }
    }
  }

  writeSummary(
    baseURL,
    model,
    step,
    finalSummary || '_Агент не вызвал session_done._',
    finalImprovements || '- Добавить явное завершение сессии через session_done.\n',
    lastError,
  )
  console.log(`Finished with notes. See ${SUMMARY_OUT}`)
  if (lastError) process.exit(1)
}

function background() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const script = path.join(process.cwd(), 'scripts', 'ai-playwright-agent.ts')
  const out = fs.openSync(BG_LOG, 'a')
  const child = spawn('npx', ['tsx', script], {
    detached: true,
    stdio: ['ignore', out, out],
    cwd: process.cwd(),
    env: { ...process.env },
    shell: true,
  })
  child.unref()
  fs.writeFileSync(PID_FILE, String(child.pid), 'utf8')
  fs.appendFileSync(
    BG_LOG,
    `\n--- spawned ${new Date().toISOString()} pid=${child.pid} ---\n`,
    'utf8',
  )
  console.log(`Background agent started pid=${child.pid}`)
  console.log(`Log: ${BG_LOG}`)
  console.log(`PID file: ${PID_FILE}`)
  process.exit(0)
}

if (process.argv.includes('--background')) {
  background()
} else {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
