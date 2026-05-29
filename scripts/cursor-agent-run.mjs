#!/usr/bin/env node
/**
 * Run a prompt in Cursor via @cursor/sdk (local agent).
 * Usage: CURSOR_API_KEY=... node scripts/cursor-agent-run.mjs [prompt-file]
 * Writes .ops/runs/<run_id>/last_run.json when the agent finishes.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

const cwd = process.cwd()
const promptFile =
  process.argv[2] || join(cwd, '.ops', 'dispatch', 'pending-prompt.md')

if (!existsSync(promptFile)) {
  console.error(`[cursor-run] Prompt file not found: ${promptFile}`)
  process.exit(1)
}

const userPrompt = readFileSync(promptFile, 'utf8').trim()
const runId = randomUUID()
const auditDir = join(cwd, '.ops', 'runs', runId)
const auditPath = join(auditDir, 'last_run.json')

const wrapped = `${userPrompt}

---
## OpsTwin (mandatory)
1. Execute the task above in this repository only.
2. When finished, write this exact file with the full audit schema from .opstwin/rules.md:
   ${auditPath.replace(/\\/g, '/')}
3. Set "agent": "cursor" and "run_id": "${runId}" in the JSON.
4. Include files_changed, tests_run, decision_trace, blockers, and next_steps.
5. Run lint/typecheck if applicable before completing.`

function pickResultFields(result) {
  if (!result || typeof result !== 'object') return result
  const out = {}
  for (const key of [
    'id',
    'status',
    'result',
    'error',
    'message',
    'failureReason',
    'summary',
  ]) {
    if (result[key] != null) out[key] = result[key]
  }
  return out
}

function formatRunError(result, extra = '') {
  const parts = [`status=${result.status}`]
  if (result.id) parts.push(`id=${result.id}`)
  if (typeof result.result === 'string' && result.result.trim()) {
    parts.push(result.result.trim().slice(0, 2000))
  } else if (result.result != null) {
    parts.push(JSON.stringify(result.result).slice(0, 2000))
  }
  if (result.error) parts.push(String(result.error))
  if (result.message) parts.push(String(result.message))
  if (extra) parts.push(extra)
  return parts.join(' | ')
}

async function fetchRunDiagnostics(Agent, apiKey, runId) {
  if (!runId || !Agent.getRun) return ''
  try {
    const run = await Agent.getRun(runId, { apiKey })
    const chunks = []
    if (run?.status) chunks.push(`run.status=${run.status}`)
    if (run?.error) chunks.push(String(run.error))
    if (typeof run?.result === 'string' && run.result.trim()) {
      chunks.push(run.result.trim().slice(0, 1500))
    }
    if (Agent.messages) {
      try {
        const msgs = await Agent.messages(runId, { apiKey })
        const tail = Array.isArray(msgs) ? msgs.slice(-3) : []
        for (const m of tail) {
          const text =
            typeof m === 'string'
              ? m
              : m?.text || m?.content || m?.message || JSON.stringify(m)
          if (text) chunks.push(String(text).slice(0, 500))
        }
      } catch {
        /* optional */
      }
    }
    return chunks.filter(Boolean).join(' | ')
  } catch {
    return ''
  }
}

async function main() {
  const apiKey = process.env.CURSOR_API_KEY
  if (!apiKey) {
    console.error('[cursor-run] Set CURSOR_API_KEY (from cursor.com/settings)')
    process.exit(1)
  }

  let Agent
  let CursorAgentError
  try {
    ;({ Agent, CursorAgentError } = await import('@cursor/sdk'))
  } catch {
    console.error('[cursor-run] Install SDK in OpsTwin repo: npm install @cursor/sdk')
    process.exit(1)
  }

  const modelId = process.env.CURSOR_MODEL || 'composer-2.5'
  console.error(`[cursor-run] Starting Cursor agent (model=${modelId}) in ${cwd}`)
  console.error(`[cursor-run] Run ID: ${runId}`)

  if (process.env.TERM_PROGRAM === 'vscode' || process.env.CURSOR_TRACE_ID) {
    console.error(
      '[cursor-run] Hint: local SDK agents often fail inside Cursor IDE — use an external PowerShell window',
    )
  }

  let result
  try {
    result = await Agent.prompt(wrapped, {
      apiKey,
      model: { id: modelId },
      local: { cwd },
    })
  } catch (err) {
    if (CursorAgentError && err instanceof CursorAgentError) {
      console.error(`[cursor-run] Startup failed: ${err.message} (retryable=${err.isRetryable})`)
    } else {
      console.error('[cursor-run]', err?.message || err)
    }
    process.exit(1)
  }

  if (result.status === 'error') {
    const diag = await fetchRunDiagnostics(Agent, apiKey, result.id)
    const detail = formatRunError(result, diag)
    console.error(`[cursor-run] Run failed: ${detail}`)
    if (!diag) {
      console.error(
        `[cursor-run] Raw: ${JSON.stringify(pickResultFields(result)).slice(0, 1500)}`,
      )
      console.error(
        '[cursor-run] Try: external PowerShell, or $env:CURSOR_MODEL="composer-2"',
      )
    }
  }

  mkdirSync(auditDir, { recursive: true })

  if (!existsSync(auditPath)) {
    const summary =
      typeof result.result === 'string'
        ? result.result
        : JSON.stringify(result.result ?? '').slice(0, 4000)
    const runError =
      result.status === 'error'
        ? formatRunError(result, await fetchRunDiagnostics(Agent, apiKey, result.id))
        : null
    writeFileSync(
      auditPath,
      JSON.stringify(
        {
          run_id: runId,
          timestamp: new Date().toISOString(),
          original_prompt: userPrompt.slice(0, 2000),
          branch: `ops/cursor-${runId.slice(0, 8)}`,
          agent: 'cursor',
          confidence: result.status === 'completed' || result.status === 'ok' ? 'medium' : 'low',
          files_changed: [],
          files_inspected: [],
          files_skipped: [],
          todos_left: [],
          tests_run: [],
          decision_trace: [
            {
              file: 'cursor-sdk',
              decision: summary.slice(0, 1500) || runError || `Cursor run status: ${result.status}`,
            },
          ],
          next_steps: ['Review agent output; refine audit JSON if files were changed'],
          blockers:
            result.status === 'error'
              ? [runError || 'Cursor agent reported error status']
              : [],
          rules_read: ['.opstwin/rules.md'],
          skills_used: ['cursor-sdk'],
        },
        null,
        2,
      ),
    )
    console.error('[cursor-run] Agent did not write audit — created minimal last_run.json')
  }

  const out = {
    ok: result.status !== 'error',
    runId,
    status: result.status,
    auditPath,
    error: result.status === 'error' ? formatRunError(result) : undefined,
  }
  console.log(JSON.stringify(out))
  process.exit(result.status === 'error' ? 2 : 0)
}

main().catch((err) => {
  console.error('[cursor-run]', err.message || err)
  process.exit(1)
})
