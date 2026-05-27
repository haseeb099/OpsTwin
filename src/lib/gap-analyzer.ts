// src/lib/gap-analyzer.ts
// Compare approved plan steps vs run results

import type { AuditReport, MvpPlan, PlanGap, PlanStep } from '@/types'

export function analyzePlanVsRun(plan: MvpPlan, report: AuditReport | null): PlanGap[] {
  const gaps: PlanGap[] = []

  for (const step of plan.steps) {
    gaps.push(analyzeStep(step, report, plan.status))
  }

  return gaps
}

function analyzeStep(
  step: PlanStep,
  report: AuditReport | null,
  planStatus: MvpPlan['status'],
): PlanGap {
  const expected = step.goal

  if (!report) {
    return {
      stepOrder: step.order,
      stepTitle: step.title,
      type: step.status === 'complete' ? 'complete' : 'not_started',
      expected,
      actual: 'No agent run uploaded yet',
      severity: step.order === 1 ? 'info' : 'warning',
    }
  }

  const hasBlockers = report.mismatches.some((m) => m.severity === 'blocker')
  const filesChanged = report.filesChanged.map((f) => f.path).join(', ') || 'none'

  if (hasBlockers) {
    return {
      stepOrder: step.order,
      stepTitle: step.title,
      type: 'failed',
      expected,
      actual: `Run ${report.runId}: blockers — ${report.blockers.join('; ') || report.mismatches.filter((m) => m.severity === 'blocker').map((m) => m.description).join('; ')}`,
      severity: 'blocker',
    }
  }

  if (report.confidence === 'low' || report.todosLeft.length > 0) {
    return {
      stepOrder: step.order,
      stepTitle: step.title,
      type: 'partial',
      expected,
      actual: `Files: ${filesChanged}. TODOs: ${report.todosLeft.length}. Confidence: ${report.confidence}`,
      severity: 'warning',
    }
  }

  if (planStatus === 'approved' && step.status === 'pending') {
    return {
      stepOrder: step.order,
      stepTitle: step.title,
      type: 'partial',
      expected,
      actual: `Last run complete but step still pending — mark step ${step.order} done manually`,
      severity: 'info',
    }
  }

  return {
    stepOrder: step.order,
    stepTitle: step.title,
    type: 'complete',
    expected,
    actual: `Run OK — ${filesChanged}`,
    severity: 'info',
  }
}

export function updateStepStatusesFromRun(
  steps: PlanStep[],
  stepOrder: number,
  runOk: boolean,
): PlanStep[] {
  return steps.map((s) => {
    if (s.order < stepOrder) return { ...s, status: 'complete' as const }
    if (s.order === stepOrder) {
      return { ...s, status: runOk ? ('complete' as const) : ('failed' as const) }
    }
    if (s.order === stepOrder + 1 && runOk) return { ...s, status: 'in_progress' as const }
    return s
  })
}

export function isPlanComplete(steps: PlanStep[]): boolean {
  return steps.every((s) => s.status === 'complete')
}
