// Build unified activity timeline for Command Center

import { prisma } from '@/lib/db'
import { parsePlanFromDb } from '@/lib/plan-engine'
import type { PlanStep, TimelineEvent } from '@/types'

function stepEvents(steps: PlanStep[]): TimelineEvent[] {
  const out: TimelineEvent[] = []
  for (const s of steps) {
    if (s.startedAt) {
      out.push({
        id: `step-start-${s.order}-${s.startedAt}`,
        kind: 'step_started',
        at: s.startedAt,
        title: `Step ${s.order} started`,
        detail: s.title,
        stepOrder: s.order,
        severity: 'info',
      })
    }
    if (s.completedAt && s.status === 'complete') {
      out.push({
        id: `step-done-${s.order}-${s.completedAt}`,
        kind: s.skipped ? 'step_skipped' : 'step_completed',
        at: s.completedAt,
        title: s.skipped ? `Step ${s.order} skipped` : `Step ${s.order} completed`,
        detail: s.title,
        stepOrder: s.order,
        runId: s.lastRunId,
        severity: 'success',
      })
    }
    if (s.status === 'failed' && s.lastRunId) {
      out.push({
        id: `step-fail-${s.order}-${s.lastRunId}`,
        kind: 'step_failed',
        at: s.completedAt ?? s.startedAt ?? new Date().toISOString(),
        title: `Step ${s.order} failed`,
        detail: s.title,
        stepOrder: s.order,
        runId: s.lastRunId,
        severity: 'error',
      })
    }
  }
  return out
}

export async function buildPlanTimeline(taskId: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = []

  const planRow = await prisma.plan.findFirst({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
  })

  if (planRow) {
    const plan = parsePlanFromDb(planRow)
    events.push({
      id: `plan-created-${plan.id}`,
      kind: 'plan_created',
      at: plan.createdAt,
      title: 'MVP plan generated',
      detail: `v${plan.version} · ${plan.steps.length} steps`,
      severity: 'info',
    })
    if (plan.approvedAt) {
      events.push({
        id: `plan-approved-${plan.id}`,
        kind: 'plan_approved',
        at: plan.approvedAt,
        title: 'Plan approved',
        detail: 'Pipeline unlocked — step 1 active',
        severity: 'success',
      })
    }
    events.push(...stepEvents(plan.steps))
  }

  const proposals = await prisma.promptProposal.findMany({
    where: { taskId },
    orderBy: { createdAt: 'asc' },
  })

  for (const p of proposals) {
    events.push({
      id: `prop-created-${p.id}`,
      kind: 'proposal_created',
      at: p.createdAt.toISOString(),
      title: 'Draft proposal',
      detail: p.rationale.slice(0, 120),
      stepOrder: p.planStepOrder ?? undefined,
      proposalId: p.id,
      severity: 'info',
    })
    if (p.approvedAt) {
      events.push({
        id: `prop-approved-${p.id}`,
        kind: 'proposal_approved',
        at: p.approvedAt.toISOString(),
        title: 'Proposal approved',
        stepOrder: p.planStepOrder ?? undefined,
        proposalId: p.id,
        severity: 'success',
      })
    }
    if (p.dispatchedAt) {
      events.push({
        id: `prop-dispatched-${p.id}`,
        kind: 'proposal_dispatched',
        at: p.dispatchedAt.toISOString(),
        title: 'Prompt dispatched',
        stepOrder: p.planStepOrder ?? undefined,
        proposalId: p.id,
        severity: 'info',
      })
    }
    if (p.deliveredAt) {
      events.push({
        id: `prop-delivered-${p.id}`,
        kind: 'proposal_delivered',
        at: p.deliveredAt.toISOString(),
        title: 'Prompt delivered to repo',
        stepOrder: p.planStepOrder ?? undefined,
        proposalId: p.id,
        severity: 'success',
      })
    }
  }

  const runs = await prisma.cursorRun.findMany({
    where: { taskId },
    orderBy: { startedAt: 'asc' },
  })

  for (const r of runs) {
    if (r.finishedAt) {
      events.push({
        id: `run-${r.id}`,
        kind: 'run_uploaded',
        at: r.finishedAt.toISOString(),
        title: `Agent run ${r.status}`,
        detail: `Run ${r.id.slice(0, 8)}… · confidence ${r.confidence ?? '—'}`,
        runId: r.id,
        severity:
          r.status === 'complete' ? 'success' : r.status === 'failed' ? 'error' : 'warning',
      })
    }
  }

  const cliRuns = await prisma.cliRunRequest.findMany({
    where: { taskId },
    orderBy: { createdAt: 'asc' },
  })

  for (const c of cliRuns) {
    if (c.startedAt) {
      events.push({
        id: `cli-start-${c.id}`,
        kind: 'cursor_run_queued',
        at: c.startedAt.toISOString(),
        title: 'Cursor run started',
        proposalId: c.proposalId ?? undefined,
        severity: 'info',
      })
    }
    if (c.finishedAt && ['completed', 'failed', 'cancelled'].includes(c.status)) {
      events.push({
        id: `cli-end-${c.id}`,
        kind: 'cursor_run_finished',
        at: c.finishedAt.toISOString(),
        title: `Cursor run ${c.status}`,
        detail: c.error ?? undefined,
        proposalId: c.proposalId ?? undefined,
        severity: c.status === 'completed' ? 'success' : 'error',
      })
    }
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  return events
}
