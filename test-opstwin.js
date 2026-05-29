// test-opstwin.js — Zero-dependency end-to-end test for the OpsTwin API
// Run with: node test-opstwin.js

const http = require('http')
const https = require('https')

// ── ANSI colours ─────────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m'
const RED    = '\x1b[31m'
const YELLOW = '\x1b[33m'
const CYAN   = '\x1b[36m'
const RESET  = '\x1b[0m'
const BOLD   = '\x1b[1m'

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const parsed   = new URL(url)
    const lib      = parsed.protocol === 'https:' ? https : http
    const bodyStr  = body ? JSON.stringify(body) : null
    const options  = {
      hostname : parsed.hostname,
      port     : parsed.port,
      path     : parsed.pathname + parsed.search,
      method,
      headers  : {
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
    }
    const req = lib.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        let json
        try { json = JSON.parse(data) } catch { json = { _raw: data } }
        resolve({ status: res.statusCode, body: json })
      })
    })
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

// Quick ping — check that the server responds with valid JSON from the API
async function ping(base) {
  try {
    const r = await request('GET', `${base}/api/tasks`)
    // Must be a successful JSON response (not a 404 HTML page from a non-API server)
    return r.status === 200 && Array.isArray(r.body?.tasks)
  } catch {
    return false
  }
}

// ── Test runner ───────────────────────────────────────────────────────────────
const results = []

async function test(label, fn) {
  try {
    const detail = await fn()
    results.push({ label, pass: true })
    console.log(`  ${GREEN}${BOLD}PASS${RESET}  ${label}`)
    return detail
  } catch (err) {
    results.push({ label, pass: false, error: err.message })
    console.log(`  ${RED}${BOLD}FAIL${RESET}  ${label}`)
    console.log(`        ${RED}↳ ${err.message}${RESET}`)
    return null
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${CYAN}${BOLD}OpsTwin E2E Test Suite${RESET}`)
  console.log('─'.repeat(42))

  // 1. Detect server
  console.log(`\n${YELLOW}Detecting server …${RESET}`)
  let BASE = null
  for (const port of [3000, 3001, 3002]) {
    process.stdout.write(`  Trying http://localhost:${port} … `)
    if (await ping(`http://localhost:${port}`)) {
      BASE = `http://localhost:${port}`
      console.log(`${GREEN}OK${RESET}`)
      break
    }
    console.log(`${RED}no response${RESET}`)
  }
  if (!BASE) {
    console.error(`\n${RED}${BOLD}ERROR: No server found on ports 3000/3001/3002.${RESET}`)
    console.error('  Start the dev server with: npm run dev')
    process.exit(1)
  }
  console.log(`  Using ${CYAN}${BASE}${RESET}\n`)

  // Check for DB errors early
  const probe = await request('GET', `${BASE}/api/tasks`)
  if (probe.status === 500 && JSON.stringify(probe.body).toLowerCase().includes('prisma')) {
    console.log(`${YELLOW}Detected Prisma error — running npm run db:push …${RESET}`)
    const { execSync } = require('child_process')
    try {
      execSync('npm run db:push', { stdio: 'inherit', cwd: __dirname })
      console.log(`${GREEN}db:push succeeded — retrying tests\n${RESET}`)
    } catch {
      console.error(`${RED}db:push failed. Please run it manually.${RESET}`)
      process.exit(1)
    }
  }

  // Shared state
  let taskId, runId, auditRunId, planId, proposalId

  // ── Tests ─────────────────────────────────────────────────────────────────

  console.log('Running tests …\n')

  // 1. POST /api/tasks — create
  await test('POST /api/tasks (create)', async () => {
    const r = await request('POST', `${BASE}/api/tasks`, {
      user          : 'opstwin-test',
      title         : 'OpsTwin Self-Test',
      repo          : 'opstwin/test',
      branch        : 'main',
      originalPrompt: 'refactor payment service for testing',
    })
    assert(r.status === 201, `Expected 201, got ${r.status} — ${JSON.stringify(r.body)}`)
    assert(r.body.task?.id, 'Response missing task.id')
    taskId = r.body.task.id
    return r.body.task
  })

  // 2. GET /api/tasks — list
  await test('GET  /api/tasks (list)', async () => {
    assert(taskId, 'Skipped — no taskId from create step')
    const r = await request('GET', `${BASE}/api/tasks`)
    assert(r.status === 200, `Expected 200, got ${r.status} — ${JSON.stringify(r.body)}`)
    assert(Array.isArray(r.body.tasks), 'Response missing tasks array')
    const found = r.body.tasks.find((t) => t.id === taskId)
    assert(found, `Task ${taskId} not found in list (got ${r.body.tasks.length} tasks)`)
    return found
  })

  // 3. POST /api/runs — start
  await test('POST /api/runs (start)', async () => {
    assert(taskId, 'Skipped — no taskId from create step')
    const r = await request('POST', `${BASE}/api/runs`, {
      action : 'start',
      taskId,
      branch : 'ops/test-20260519',
    })
    assert(r.status === 201, `Expected 201, got ${r.status} — ${JSON.stringify(r.body)}`)
    assert(r.body.run?.id, 'Response missing run.id')
    runId = r.body.run.id
    return r.body.run
  })

  // 4. POST /api/runs — upload_audit
  await test('POST /api/runs (upload_audit)', async () => {
    assert(taskId, 'Skipped — no taskId from create step')
    const auditJson = {
      run_id           : runId ?? 'run_test_001',
      timestamp        : new Date().toISOString(),
      original_prompt  : 'refactor payment service for testing',
      branch           : 'ops/test-20260519',
      confidence       : 'medium',
      files_changed    : [
        {
          path         : 'src/services/payment.ts',
          lines_added  : 45,
          lines_removed: 12,
          diff         : '+ idempotencyKey: generateKey()',
        },
      ],
      files_inspected  : [
        { path: 'src/lib/stripe.ts', touched: false, reason: 'do-not-touch constraint' },
      ],
      files_skipped    : [
        { path: 'prisma/schema.prisma', reason: 'do-not-touch constraint' },
      ],
      todos_left       : [
        {
          file         : 'src/services/payment.ts',
          line         : 78,
          reason       : 'Refund flow not updated',
          suggested_fix: 'Update RefundParams to include reason field',
        },
      ],
      tests_run        : [
        { name: 'payment.test.ts > createPayment', status: 'pass' },
        { name: 'typecheck', status: 'fail', output: 'payment.ts:78 — Type error' },
      ],
      decision_trace   : [
        { file: 'src/services/payment.ts', decision: 'Added idempotency key to prevent duplicate charges' },
      ],
      next_steps       : ['Fix typecheck error', 'Run full test suite'],
      blockers         : ['typecheck failure must resolve before merge'],
      rules_read       : ['.cursor/rules.mdc'],
      skills_used      : ['audit-log', 'bounded-task', 'test-first-check'],
    }

    const r = await request('POST', `${BASE}/api/runs`, {
      action   : 'upload_audit',
      runId    : runId ?? undefined,
      taskId,
      auditJson,
    })
    assert(r.status === 200, `Expected 200, got ${r.status} — ${JSON.stringify(r.body)}`)
    assert(r.body.run?.id, 'Response missing run.id')
    assert(r.body.report, 'Response missing report')
    auditRunId = r.body.run.id
    return r.body
  })

  // 5. GET /api/runs/:id
  await test('GET  /api/runs/:id', async () => {
    const id = auditRunId ?? runId
    assert(id, 'Skipped — no runId from previous steps')
    const r = await request('GET', `${BASE}/api/runs/${id}`)
    assert(r.status === 200, `Expected 200, got ${r.status} — ${JSON.stringify(r.body)}`)
    assert(r.body.run, 'Response missing run')
    assert(r.body.report, 'Response missing report')
    // focusedRerunPrompt may be null (if no mismatches) but key should exist
    assert('focusedRerunPrompt' in r.body, 'Response missing focusedRerunPrompt key')
    return r.body
  })

  // 6. GET /api/memory
  await test('GET  /api/memory', async () => {
    const r = await request('GET', `${BASE}/api/memory`)
    assert(r.status === 200, `Expected 200, got ${r.status} — ${JSON.stringify(r.body)}`)
    assert(Array.isArray(r.body.entries), 'Response missing entries array')
    assert(r.body.entries.length > 0, `Memory is empty — expected at least 1 entry after upload_audit`)
    return r.body.entries
  })

  // 7. POST /api/outcomes
  await test('POST /api/outcomes', async () => {
    const id = auditRunId ?? runId
    assert(id, 'Skipped — no runId from previous steps')
    const r = await request('POST', `${BASE}/api/outcomes`, {
      runId       : id,
      action      : 'accepted',
      userFeedback: 'All good — self-test passed',
      timeToFixMs : 0,
    })
    assert(r.status === 201, `Expected 201, got ${r.status} — ${JSON.stringify(r.body)}`)
    assert(r.body.outcome?.id, 'Response missing outcome.id')
    return r.body.outcome
  })

  // 8. POST /api/plans — generate MVP plan
  await test('POST /api/plans (generate)', async () => {
    assert(taskId, 'Skipped — no taskId')
    const r = await request('POST', `${BASE}/api/plans`, { taskId })
    assert(r.status === 201, `Expected 201, got ${r.status} — ${JSON.stringify(r.body)}`)
    assert(r.body.plan?.id, 'Response missing plan.id')
    assert(Array.isArray(r.body.plan.steps), 'Plan missing steps')
    assert(r.body.plan.steps.length >= 3, 'Plan should have at least 3 steps')
    planId = r.body.plan.id
    return r.body.plan
  })

  // 9. PATCH /api/plans/:id — approve
  await test('PATCH /api/plans/:id (approve)', async () => {
    assert(planId, 'Skipped — no planId')
    const r = await request('PATCH', `${BASE}/api/plans/${planId}`, { action: 'approve' })
    assert(r.status === 200, `Expected 200, got ${r.status}`)
    assert(r.body.plan?.status === 'approved', 'Plan should be approved')
    return r.body.plan
  })

  // 10. POST /api/prompts/propose
  await test('POST /api/prompts/propose', async () => {
    assert(taskId, 'Skipped — no taskId')
    const r = await request('POST', `${BASE}/api/prompts/propose`, {
      taskId,
      runId: auditRunId,
    })
    assert(r.status === 201, `Expected 201, got ${r.status}`)
    assert(r.body.proposal?.id, 'Response missing proposal.id')
    assert(r.body.proposal.proposedPrompt?.length > 10, 'Proposal prompt too short')
    proposalId = r.body.proposal.id
    return r.body.proposal
  })

  // 10b. GET /api/prompts/:id
  await test('GET  /api/prompts/:id', async () => {
    assert(proposalId, 'Skipped — no proposalId')
    const r = await request('GET', `${BASE}/api/prompts/${proposalId}`)
    assert(r.status === 200, `Expected 200, got ${r.status}`)
    assert(r.body.proposal?.id === proposalId, 'Wrong proposal returned')
    return r.body.proposal
  })

  // 11. PATCH /api/prompts/:id — approve
  await test('PATCH /api/prompts/:id (approve)', async () => {
    assert(proposalId, 'Skipped — no proposalId')
    const r = await request('PATCH', `${BASE}/api/prompts/${proposalId}`, { action: 'approve' })
    assert(r.status === 200, `Expected 200, got ${r.status}`)
    assert(r.body.proposal?.status === 'approved', 'Proposal should be approved')
    assert(r.body.approvedPrompt, 'Missing approvedPrompt')
    return r.body
  })

  // 12. GET /api/health
  await test('GET  /api/health', async () => {
    const r = await request('GET', `${BASE}/api/health`)
    assert(r.status === 200, `Expected 200, got ${r.status}`)
    assert(r.body.status === 'ok', 'Health check failed')
    return r.body
  })

  // 13. PATCH /api/plans/:id — update documents
  await test('PATCH /api/plans/:id (update_documents)', async () => {
    assert(planId, 'Skipped — no planId')
    const r = await request('PATCH', `${BASE}/api/plans/${planId}`, {
      action: 'update_documents',
      documents: {
        prd: '# PRD (edited)',
        trd: '# TRD (edited)',
        useCases: '# UC',
        testPlan: '# Tests',
        architecture: '# Arch',
      },
    })
    assert(r.status === 200, `Expected 200, got ${r.status}`)
    assert(r.body.plan?.documents?.prd?.includes('edited'), 'Doc not updated')
    return r.body.plan
  })

  // 14. POST /api/runs/:id/terminal
  await test('POST /api/runs/:id/terminal', async () => {
    const id = auditRunId ?? runId
    assert(id, 'Skipped — no runId')
    const r = await request('POST', `${BASE}/api/runs/${id}/terminal`, {
      command: 'npm test',
      exitCode: 1,
      stdout: '1 passed',
      stderr: 'typecheck failed',
    })
    assert(r.status === 201, `Expected 201, got ${r.status}`)
    return r.body.log
  })

  // 15. POST /api/prompts/:id/dispatch
  await test('POST /api/prompts/:id/dispatch', async () => {
    assert(proposalId, 'Skipped — no proposalId')
    const r = await request('POST', `${BASE}/api/prompts/${proposalId}/dispatch`)
    assert(r.status === 200, `Expected 200, got ${r.status} — ${JSON.stringify(r.body)}`)
    assert(r.body.prompt?.length > 10, 'Missing dispatch prompt')
    return r.body
  })

  // 15b. GET /api/prompts/pending
  await test('GET  /api/prompts/pending', async () => {
    assert(taskId, 'Skipped — no taskId')
    const r = await request('GET', `${BASE}/api/prompts/pending?taskId=${taskId}`)
    assert(r.status === 200, `Expected 200, got ${r.status}`)
    assert(Array.isArray(r.body.pending), 'Missing pending array')
    assert(r.body.pending.length >= 1, 'Expected pending delivery after dispatch')
    return r.body.pending
  })

  // 15c. POST /api/prompts/:id/delivered
  await test('POST /api/prompts/:id/delivered', async () => {
    assert(proposalId, 'Skipped — no proposalId')
    const r = await request('POST', `${BASE}/api/prompts/${proposalId}/delivered`)
    assert(r.status === 200, `Expected 200, got ${r.status}`)
    assert(r.body.proposal?.deliveredAt, 'Missing deliveredAt')
    return r.body.proposal
  })

  // 15d. CLI heartbeat + status
  await test('POST /api/cli/heartbeat + GET status', async () => {
    assert(taskId, 'Skipped — no taskId')
    const hb = await request('POST', `${BASE}/api/cli/heartbeat`, {
      taskId,
      repoPath: '/tmp/test-repo',
      mode: 'daemon',
    })
    assert(hb.status === 200, `Expected 200, got ${hb.status}`)
    const st = await request('GET', `${BASE}/api/cli/status?taskId=${taskId}`)
    assert(st.status === 200, `Expected 200, got ${st.status}`)
    assert(st.body.connected === true, 'CLI should show connected')
    return st.body
  })

  // 17. POST /api/runs/:id/analyze
  await test('POST /api/runs/:id/analyze', async () => {
    const id = auditRunId ?? runId
    assert(id, 'Skipped — no runId')
    const r = await request('POST', `${BASE}/api/runs/${id}/analyze`)
    assert(r.status === 200, `Expected 200, got ${r.status}`)
    assert(r.body.analysis?.improvedPrompt?.length > 5, 'Missing analysis.improvedPrompt')
    assert(r.body.gaps, 'Missing gaps')
    return r.body
  })

  // 18. POST /api/prompts/capture
  await test('POST /api/prompts/capture', async () => {
    assert(taskId, 'Skipped — no taskId')
    const r = await request('POST', `${BASE}/api/prompts/capture`, {
      taskId,
      content: 'Fix the typecheck error in payment.ts',
      source: 'inbound_file',
    })
    assert(r.status === 201, `Expected 201, got ${r.status}`)
    assert(r.body.prompt?.id, 'Missing prompt.id')
    return r.body.prompt
  })

  // 19. GET /api/prompts/capture
  await test('GET  /api/prompts/capture', async () => {
    assert(taskId, 'Skipped — no taskId')
    const r = await request('GET', `${BASE}/api/prompts/capture?taskId=${taskId}`)
    assert(r.status === 200, `Expected 200, got ${r.status}`)
    assert(r.body.latest?.content, 'Missing latest captured prompt')
    return r.body
  })

  // 20. POST /api/runs upload with stackContext
  await test('POST /api/runs (stackContext)', async () => {
    assert(taskId, 'Skipped — no taskId')
    const r = await request('POST', `${BASE}/api/runs`, {
      action: 'upload_audit',
      taskId,
      auditJson: {
        run_id: 'run_stack_test',
        timestamp: new Date().toISOString(),
        original_prompt: 'test stack context',
        branch: 'ops/stack-test',
        confidence: 'high',
        files_changed: [{ path: 'src/app/page.tsx', lines_added: 1, lines_removed: 0, diff: '+' }],
        files_inspected: [],
        files_skipped: [],
        todos_left: [],
        expected_changes: '',
        tests_run: [{ name: 'unit', status: 'pass' }],
        decision_trace: [],
        next_steps: [],
        blockers: [],
      },
      stackContext: {
        frontend: { framework: 'next', changedFiles: ['src/app/page.tsx'] },
        backend: { apiRoutes: ['/api/tasks'], changedFiles: [] },
        database: { orm: 'prisma', models: ['Task'] },
        tests: { failed: [], passed: 1, failedCount: 0 },
      },
    })
    assert(r.status === 200, `Expected 200, got ${r.status}`)
    assert(r.body.stackContext?.frontend?.framework === 'next', 'stackContext not stored')
    return r.body
  })

  // 21. POST /api/prompts/propose (rules fallback)
  await test('POST /api/prompts/propose (useLlm=false)', async () => {
    assert(taskId, 'Skipped — no taskId')
    const r = await request('POST', `${BASE}/api/prompts/propose`, {
      taskId,
      runId: auditRunId,
      useLlm: false,
    })
    assert(r.status === 201, `Expected 201, got ${r.status}`)
    assert(r.body.source === 'rules', 'Expected rules fallback')
    return r.body.proposal
  })

  // 16. GET /api/auth/me
  await test('GET  /api/auth/me', async () => {
    const r = await request('GET', `${BASE}/api/auth/me`)
    assert(r.status === 200, `Expected 200, got ${r.status}`)
    assert('authEnabled' in r.body, 'Missing authEnabled')
    return r.body
  })

  // ── Summary ───────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.pass).length
  const total  = results.length

  console.log(`\n${'='.repeat(42)}`)
  console.log(` ${BOLD}OpsTwin Test Results${RESET}`)
  console.log('='.repeat(42))
  for (const r of results) {
    const tag = r.pass
      ? `${GREEN}${BOLD} PASS ${RESET}`
      : `${RED}${BOLD} FAIL ${RESET}`
    const lbl = r.label.padEnd(35)
    const err = r.pass ? '' : `  ${RED}↳ ${r.error}${RESET}`
    console.log(` ${tag} ${lbl}${err}`)
  }
  console.log('='.repeat(42))
  const colour = passed === total ? GREEN : RED
  console.log(` ${colour}${BOLD}${passed}/${total} tests passed${RESET}`)
  console.log('='.repeat(42) + '\n')

  if (passed < total) process.exit(1)
}

main().catch((err) => {
  console.error(`\n${RED}Unhandled error: ${err.message}${RESET}`)
  process.exit(1)
})
