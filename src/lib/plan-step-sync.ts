// Sync plan step statuses when an audit run is uploaded

import { prisma } from '@/lib/db'
import { isPlanComplete, updateStepStatusesFromRun } from '@/lib/gap-analyzer'
import { parsePlanFromDb } from '@/lib/plan-engine'
import type { AuditReport, MvpPlan } from '@/types'

export async function resolveStepOrderForRun(
  taskId: string,
  runId: string,
  plan: MvpPlan,
  hint?: number | null,
): Promise<number | undefined> {
  if (hint != null) return hint

  const linkedProposal = await prisma.promptProposal.findFirst({
    where: { taskId, runId, planStepOrder: { not: null } },
    orderBy: { createdAt: 'desc' },
  })
  if (linkedProposal?.planStepOrder != null) return linkedProposal.planStepOrder

  const recentForStep = await prisma.promptProposal.findFirst({
    where: {
      taskId,
      planStepOrder: { not: null },
      status: { in: ['approved', 'dispatched'] },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (recentForStep?.planStepOrder != null) return recentForStep.planStepOrder

  const inProgress = plan.steps.find((s) => s.status === 'in_progress')
  if (inProgress) return inProgress.order

  const pending = plan.steps.find((s) => s.status === 'pending' || s.status === 'failed')
  return pending?.order
}

export function isRunOkForStepAdvance(report: AuditReport, runStatus: string): boolean {
  if (runStatus !== 'complete') return false
  if (report.blockers.length > 0) return false
  if (report.mismatches.some((m) => m.severity === 'blocker')) return false
  return true
}

export async function syncPlanStepsAfterAuditUpload(input: {
  taskId: string
  runId: string
  report: AuditReport
  runStatus: string
  planStepOrder?: number | null
}): Promise<MvpPlan | null> {
  const planRow = await prisma.plan.findFirst({
    where: { taskId: input.taskId },
    orderBy: { createdAt: 'desc' },
  })
  if (!planRow) return null

  const plan = parsePlanFromDb(planRow)
  if (plan.status === 'draft') return null

  const stepOrder = await resolveStepOrderForRun(
    input.taskId,
    input.runId,
    plan,
    input.planStepOrder,
  )
  if (!stepOrder) return null

  const runOk = isRunOkForStepAdvance(input.report, input.runStatus)
  const finishedAt = input.report.timestamp || new Date().toISOString()
  const updatedSteps = updateStepStatusesFromRun(
    plan.steps,
    stepOrder,
    runOk,
    input.runId,
    finishedAt,
  )

  const allComplete = isPlanComplete(updatedSteps)
  const nextStatus = allComplete ? 'complete' : 'in_progress'

  const row = await prisma.plan.update({
    where: { id: planRow.id },
    data: {
      stepsJson: JSON.stringify(updatedSteps),
      status: nextStatus,
    },
  })

  return parsePlanFromDb(row)
}
