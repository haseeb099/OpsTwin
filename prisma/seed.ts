// prisma/seed.ts
// Seeds the SQLite database with sample tasks, runs, and memory entries so
// the OpsTwin UI has real data immediately on first load.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SAMPLE_AUDIT_JSON = {
  run_id: 'run_seed_payment_v3',
  timestamp: '2024-12-01T14:30:22Z',
  original_prompt:
    'Refactor payment service to use new Stripe API v3. Update webhook handlers and add idempotency keys.',
  branch: 'ops/refactor-payment-stripe-v3-20241201-1430',
  confidence: 'medium',
  files_changed: [
    {
      path: 'src/services/payment.ts',
      lines_added: 47,
      lines_removed: 23,
      diff: '+ idempotencyKey: generateIdempotencyKey(orderId)',
    },
    {
      path: 'src/app/api/webhooks/stripe/route.ts',
      lines_added: 89,
      lines_removed: 0,
      diff: '+ export async function POST(req: Request) { ... }',
    },
  ],
  files_inspected: [
    { path: 'src/lib/stripe.ts', touched: false, reason: 'do-not-touch constraint in task' },
    { path: 'src/services/email.ts', touched: false, reason: 'no matching pattern found' },
  ],
  files_skipped: [
    { path: 'src/services/subscription.ts', reason: 'out of scope' },
    { path: 'tests/webhooks/stripe.test.ts', reason: 'test file not found — created new one' },
  ],
  todos_left: [
    {
      file: 'src/services/payment.ts',
      line: 78,
      reason: 'Refund flow not updated — requires new Stripe refund API signature',
      suggested_fix: 'See Stripe docs v3 refund endpoint',
    },
  ],
  expected_changes: 'Update payment service to use Stripe API v3 with idempotency keys.',
  tests_run: [
    { name: 'payment.test.ts > createPaymentIntent', status: 'pass', output: 'passed (234ms)' },
    { name: 'payment.test.ts > handleWebhook', status: 'pass', output: 'passed (156ms)' },
    { name: 'lint', status: 'pass', output: 'No warnings or errors' },
    {
      name: 'typecheck',
      status: 'fail',
      output: "payment.ts:78 — Type 'RefundParams' missing 'reason' field",
    },
  ],
  decision_trace: [
    {
      file: 'src/services/payment.ts',
      decision:
        'Added idempotencyKey to all API calls — required by Stripe v3 spec to prevent duplicate charges on retry',
    },
    {
      file: 'src/app/api/webhooks/stripe/route.ts',
      decision: 'Created new file instead of modifying existing handler to avoid breaking legacy v2 path',
    },
  ],
  next_steps: [
    'Fix typecheck error in payment.ts:78',
    'Update createRefund() to use Stripe v3 refund endpoint',
    'Run full test suite',
    'Create PR',
  ],
  blockers: ['typecheck failure in payment.ts:78 must be resolved before merge'],
}

async function main() {
  console.log('Resetting database...')
  await prisma.outcome.deleteMany()
  await prisma.fileEdit.deleteMany()
  await prisma.inspectedFile.deleteMany()
  await prisma.expectation.deleteMany()
  await prisma.cursorRun.deleteMany()
  await prisma.task.deleteMany()
  await prisma.memoryEntry.deleteMany()

  console.log('Seeding tasks...')
  const task1 = await prisma.task.create({
    data: {
      user: 'alice@acme.dev',
      repo: 'acme/backend',
      branch: 'main',
      originalPrompt:
        'Refactor payment service to use new Stripe API v3. Update webhook handlers and add idempotency keys.',
      title: 'Refactor payment service',
    },
  })

  const task2 = await prisma.task.create({
    data: {
      user: 'alice@acme.dev',
      repo: 'acme/backend',
      branch: 'main',
      originalPrompt:
        'Add a /api/webhooks/stripe endpoint that handles payment_intent.succeeded events.',
      title: 'Add Stripe webhook handler',
    },
  })

  const task3 = await prisma.task.create({
    data: {
      user: 'bob@acme.dev',
      repo: 'acme/frontend',
      branch: 'develop',
      originalPrompt:
        'Migrate auth to NextAuth v5. Replace useSession hooks. Update middleware.ts.',
      title: 'Migrate auth to NextAuth v5',
    },
  })

  console.log('Seeding runs...')
  const run1 = await prisma.cursorRun.create({
    data: {
      taskId: task1.id,
      branch: 'ops/refactor-payment-stripe-v3-20241201-1430',
      status: 'partial',
      confidence: 'medium',
      finishedAt: new Date(),
      auditJson: JSON.stringify(SAMPLE_AUDIT_JSON),
      fileEdits: {
        create: [
          {
            path: 'src/services/payment.ts',
            diff: '+ idempotencyKey: generateIdempotencyKey(orderId)',
            linesAdded: 47,
            linesRemoved: 23,
          },
          {
            path: 'src/app/api/webhooks/stripe/route.ts',
            diff: '+ export async function POST(req: Request) { ... }',
            linesAdded: 89,
            linesRemoved: 0,
          },
        ],
      },
      inspectedFiles: {
        create: [
          { path: 'src/lib/stripe.ts', reason: 'do-not-touch constraint', touched: false },
          { path: 'src/services/email.ts', reason: 'no matching pattern found', touched: false },
        ],
      },
    },
  })

  await prisma.cursorRun.create({
    data: {
      taskId: task2.id,
      branch: 'ops/add-stripe-webhook-20241128-0900',
      status: 'complete',
      confidence: 'high',
      finishedAt: new Date(Date.now() - 1000 * 60 * 60),
      fileEdits: {
        create: [
          {
            path: 'src/app/api/webhooks/stripe/route.ts',
            diff: '+ new file',
            linesAdded: 120,
            linesRemoved: 0,
          },
        ],
      },
    },
  })

  console.log('Seeding memory entries...')
  await prisma.memoryEntry.createMany({
    data: [
      {
        taskType: 'refactor',
        patternHash: 'refactor::test_failure',
        outcomeSummary: 'Large refactor + low confidence + test failures',
        improvementSuggestion: 'Split into sub-tasks per file. Use bounded scope prompts.',
        reuseCount: 4,
        successRate: 0.62,
      },
      {
        taskType: 'feature',
        patternHash: 'feature::none',
        outcomeSummary: 'New file creation works well',
        improvementSuggestion: 'No change needed — pattern reliable.',
        reuseCount: 11,
        successRate: 0.94,
      },
      {
        taskType: 'bugfix',
        patternHash: 'bugfix::test_failure',
        outcomeSummary: 'Test failures after fix',
        improvementSuggestion: 'Run focused test rerun targeting only the failing test file.',
        reuseCount: 7,
        successRate: 0.78,
      },
      {
        taskType: 'migration',
        patternHash: 'migration::missing_file',
        outcomeSummary: 'Many files skipped, scope too broad',
        improvementSuggestion: 'Explicitly list target files in prompt. Add file constraints.',
        reuseCount: 3,
        successRate: 0.45,
      },
    ],
  })

  console.log(`Seed complete:`)
  console.log(`  tasks:    ${[task1, task2, task3].length}`)
  console.log(`  runs:     2`)
  console.log(`  memory:   4`)
  console.log(`  first run id: ${run1.id}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
