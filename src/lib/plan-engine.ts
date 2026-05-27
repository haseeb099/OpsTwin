// src/lib/plan-engine.ts
// MVP plan generator — rule-based, no LLM required

import type { DocumentBundle, PlanStep } from '@/types'

export interface GeneratePlanInput {
  taskId: string
  title: string
  repo: string
  branch: string
  originalPrompt: string
}

export interface GeneratedPlan {
  steps: PlanStep[]
  documents: DocumentBundle
  source?: 'rules' | 'llm'
}

const KEYWORDS = {
  auth: /\b(auth|login|signup|session|jwt|oauth)\b/i,
  database: /\b(database|db|schema|prisma|postgres|sqlite|model)\b/i,
  api: /\b(api|endpoint|route|webhook|rest|graphql)\b/i,
  ui: /\b(ui|ux|frontend|page|component|dashboard|design)\b/i,
  test: /\b(test|spec|coverage|e2e|unit)\b/i,
  payment: /\b(stripe|payment|checkout|billing)\b/i,
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

function buildAgentPrompt(step: Omit<PlanStep, 'agentPrompt'>, ctx: GeneratePlanInput): string {
  return `TASK: ${step.title}
GOAL: ${step.goal}

CONSTRAINTS:
${step.constraints.map((c) => `  - ${c}`).join('\n')}

CONTEXT:
  - Repo: ${ctx.repo}
  - Branch base: ${ctx.branch}
  - MVP: ${ctx.originalPrompt.slice(0, 200)}${ctx.originalPrompt.length > 200 ? '...' : ''}

VERIFICATION:
${step.verification.map((v) => `  - ${v}`).join('\n')}

AUDIT REQUIREMENT:
  Write .ops/runs/<run_id>/last_run.json per .opstwin/rules.md when done.
  Set expected_changes to this step's goal.

EXPECTED OUTPUTS:
${step.expectedFiles.length ? step.expectedFiles.map((f) => `  - ${f}`).join('\n') : '  - (agent determines based on goal)'}
`
}

export function generateMvpPlan(input: GeneratePlanInput): GeneratedPlan {
  const p = input.originalPrompt
  const slug = slugify(input.title || 'mvp-task')
  const branchPrefix = `ops/${slug}`

  const steps: Omit<PlanStep, 'agentPrompt'>[] = [
    {
      order: 1,
      title: 'Scope & branch setup',
      goal: `Declare scope for "${input.title}" and create feature branch ${branchPrefix}-<timestamp>.`,
      constraints: [
        'Do not change unrelated files',
        `Branch: ${branchPrefix}-<YYYYMMDD-HHMM>`,
        'Read .opstwin/rules.md before starting',
      ],
      expectedFiles: ['.ops/runs/<run_id>/last_run.json'],
      verification: ['Branch created', 'Scope declared in audit JSON'],
      status: 'pending',
    },
  ]

  if (KEYWORDS.database.test(p)) {
    steps.push({
      order: steps.length + 1,
      title: 'Data model',
      goal: 'Add or update database schema and models needed for this MVP.',
      constraints: ['Minimal schema — MVP only', 'Run db push/migrate if applicable'],
      expectedFiles: ['prisma/schema.prisma', 'src/lib/db.ts'],
      verification: ['Schema valid', 'db push succeeds'],
      status: 'pending',
    })
  }

  if (KEYWORDS.api.test(p) || KEYWORDS.payment.test(p)) {
    steps.push({
      order: steps.length + 1,
      title: 'API & business logic',
      goal: 'Implement core API routes and service logic for the MVP feature.',
      constraints: ['Keep handlers thin', 'Reuse existing lib utilities'],
      expectedFiles: ['src/app/api/**', 'src/lib/**'],
      verification: ['Lint clean', 'Manual curl or test passes'],
      status: 'pending',
    })
  }

  if (KEYWORDS.auth.test(p)) {
    steps.push({
      order: steps.length + 1,
      title: 'Authentication',
      goal: 'Add auth flows required by the MVP (login, session, or tokens).',
      constraints: ['Do not store secrets in code', 'Use env vars'],
      expectedFiles: ['src/app/api/auth/**', 'src/lib/auth.ts'],
      verification: ['Auth flow manually tested'],
      status: 'pending',
    })
  }

  if (KEYWORDS.ui.test(p) || (!KEYWORDS.api.test(p) && !KEYWORDS.database.test(p))) {
    steps.push({
      order: steps.length + 1,
      title: 'UI / frontend',
      goal: 'Build the user-facing screens and components for the MVP.',
      constraints: ['Match existing design tokens', 'Keep UI minimal'],
      expectedFiles: ['src/components/**', 'src/app/**/page.tsx'],
      verification: ['Page renders without error', 'npm run dev works'],
      status: 'pending',
    })
  }

  steps.push({
    order: steps.length + 1,
    title: 'Tests & verification',
    goal: 'Add minimal tests and run lint + typecheck for changed code.',
    constraints: ['Test happy path only', 'No over-engineering'],
    expectedFiles: ['**/*.test.ts', '**/*.spec.ts'],
    verification: ['npm test passes (or new tests pass)', 'npm run lint clean', 'typecheck clean'],
    status: 'pending',
  })

  steps.push({
    order: steps.length + 1,
    title: 'Review & audit',
    goal: 'Final review — ensure audit JSON is complete and blockers are empty.',
    constraints: ['Fix any blockers before marking complete', 'confidence: high required'],
    expectedFiles: ['.ops/runs/<run_id>/last_run.json'],
    verification: ['All tests green', 'No blockers in audit', 'User can accept outcome'],
    status: 'pending',
  })

  const fullSteps: PlanStep[] = steps.map((s) => ({
    ...s,
    agentPrompt: buildAgentPrompt(s, input),
  }))

  const documents = buildDocuments(input, fullSteps)

  return { steps: fullSteps, documents, source: 'rules' }
}

function buildDocuments(input: GeneratePlanInput, steps: PlanStep[]): DocumentBundle {
  const stepList = steps.map((s) => `${s.order}. ${s.title} — ${s.goal}`).join('\n')

  return {
    prd: `# PRD — ${input.title}

## Goal
${input.originalPrompt}

## Success criteria
- MVP feature works end-to-end
- Tests and lint pass
- Audit JSON written per run

## Out of scope (MVP)
- Production hardening
- Full test coverage
- Multi-tenant / billing

## Steps
${stepList}
`,
    trd: `# TRD — ${input.title}

## Stack
Next.js, TypeScript, Prisma, agent-agnostic audit via OpsTwin

## Repo
${input.repo} (branch: ${input.branch})

## Technical constraints
- Agent writes .ops/runs/<id>/last_run.json
- Feature branch ops/<slug>-<timestamp>
- Human approves each prompt before run

## Implementation steps
${stepList}
`,
    useCases: `# Use Cases — ${input.title}

## UC-1: Happy path
User/agent completes MVP feature; audit shows no blockers; outcome accepted.

## UC-2: Gap iteration
Run has mismatches → OpsTwin proposes focused prompt → user approves → re-run.

## UC-3: Step-by-step execution
User executes plan steps 1..N in order; each produces audit JSON.
`,
    testPlan: `# Test Plan — ${input.title}

## P0
- Lint + typecheck pass
- Core feature manually verified
- Audit JSON valid schema

## P1
- Unit tests for new functions
- API route smoke test

## Per step
${steps.map((s) => `### Step ${s.order}: ${s.title}\n${s.verification.map((v) => `- ${v}`).join('\n')}`).join('\n\n')}
`,
    architecture: `# Architecture — ${input.title}

## Flow
User prompt → OpsTwin plan → approve → agent run → audit upload → gap analysis → next prompt

## Components touched (expected)
${steps.flatMap((s) => s.expectedFiles).join(', ')}

## Agent contract
.opstwin/rules.md — mandatory audit JSON after every run
`,
  }
}

export function parsePlanFromDb(row: {
  id: string
  taskId: string
  version: number
  originalPrompt: string
  stepsJson: string
  documentsJson: string
  status: string
  approvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}): import('@/types').MvpPlan {
  return {
    id: row.id,
    taskId: row.taskId,
    version: row.version,
    originalPrompt: row.originalPrompt,
    steps: JSON.parse(row.stepsJson) as PlanStep[],
    documents: JSON.parse(row.documentsJson) as DocumentBundle,
    status: row.status as import('@/types').PlanStatus,
    approvedAt: row.approvedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function getNextPendingStep(steps: PlanStep[]): PlanStep | undefined {
  return steps.find((s) => s.status === 'pending' || s.status === 'in_progress')
}

export function buildStepPrompt(step: PlanStep): string {
  return step.agentPrompt
}
