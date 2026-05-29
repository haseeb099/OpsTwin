// src/lib/prompt-proposer.ts
// Propose next agent prompt — MVP: plan step or focused rerun

import type { AuditReport, MemoryEntry, MvpPlan, PlanStep, PromptProposal } from '@/types'
import { generateFocusedRerunPrompt } from '@/lib/audit-parser'
import { buildStepPrompt, getNextPendingStep } from '@/lib/plan-engine'

export interface ProposePromptInput {
  taskId: string
  plan?: MvpPlan | null
  report?: AuditReport | null
  memories?: MemoryEntry[]
  planStepOrder?: number
}

export interface ProposedPrompt {
  proposedPrompt: string
  rationale: string
  planStepOrder?: number
  runId?: string
}

export function proposeNextPrompt(input: ProposePromptInput): ProposedPrompt {
  const { plan, report, memories = [] } = input

  // After a run with gaps → focused rerun
  if (report && report.mismatches.length > 0) {
    const memoryHint = memories[0]?.improvementSuggestion
    const base = generateFocusedRerunPrompt(report)
    return {
      proposedPrompt: memoryHint ? `${base}\n\nMEMORY HINT: ${memoryHint}` : base,
      rationale: `${report.mismatches.filter((m) => m.severity === 'blocker').length} blockers, ${report.mismatches.filter((m) => m.severity === 'warning').length} warnings from last run`,
      runId: report.runId,
      planStepOrder: input.planStepOrder ?? findCurrentStepOrder(plan),
    }
  }

  // Approved plan → next step prompt
  if (plan && plan.status === 'approved') {
    const step = input.planStepOrder
      ? plan.steps.find((s) => s.order === input.planStepOrder)
      : getNextPendingStep(plan.steps)

    if (step) {
      return {
        proposedPrompt: buildStepPrompt(step),
        rationale: `Execute plan step ${step.order}: ${step.title}`,
        planStepOrder: step.order,
      }
    }
  }

  // No plan or fallback → generic iteration prompt
  if (report) {
    return {
      proposedPrompt: `Continue MVP work for task.\n\nPrevious run: ${report.originalPrompt}\n\nNext steps from agent:\n${report.nextSteps.map((s) => `- ${s}`).join('\n')}\n\nWrite updated .ops/runs/<run_id>/last_run.json when done.`,
      rationale: 'Continue from last run next_steps',
      runId: report.runId,
    }
  }

  // First run — use plan step 1 or raw task
  if (plan) {
    const first = plan.steps[0]
    return {
      proposedPrompt: buildStepPrompt(first),
      rationale: `Start plan step 1: ${first.title}`,
      planStepOrder: 1,
    }
  }

  return {
    proposedPrompt: 'No plan or run available. Create a plan first or upload an audit run.',
    rationale: 'Missing context',
  }
}

function findCurrentStepOrder(plan: MvpPlan | null | undefined): number | undefined {
  if (!plan) return undefined
  const inProgress = plan.steps.find((s) => s.status === 'in_progress')
  if (inProgress) return inProgress.order
  const pending = getNextPendingStep(plan.steps)
  return pending?.order
}

export function parseProposalFromDb(row: {
  id: string
  taskId: string
  planId: string | null
  runId: string | null
  planStepOrder: number | null
  proposedPrompt: string
  rationale: string
  status: string
  userEdits: string | null
  approvedAt: Date | null
  dispatchedAt: Date | null
  deliveredAt?: Date | null
  createdAt: Date
}): PromptProposal {
  return {
    id: row.id,
    taskId: row.taskId,
    planId: row.planId ?? undefined,
    runId: row.runId ?? undefined,
    planStepOrder: row.planStepOrder ?? undefined,
    proposedPrompt: row.userEdits ?? row.proposedPrompt,
    rationale: row.rationale,
    status: row.status as PromptProposal['status'],
    userEdits: row.userEdits ?? undefined,
  approvedAt: row.approvedAt?.toISOString(),
  dispatchedAt: row.dispatchedAt?.toISOString(),
  deliveredAt: row.deliveredAt?.toISOString(),
  createdAt: row.createdAt.toISOString(),
  }
}

export function getApprovedPromptText(proposal: PromptProposal): string {
  return proposal.userEdits ?? proposal.proposedPrompt
}
