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
  runId?: string,
  finishedAt?: string,
): PlanStep[] {
  const ts = finishedAt ?? new Date().toISOString()
  return steps.map((s) => {
    if (s.order < stepOrder) {
      return {
        ...s,
        status: 'complete' as const,
        completedAt: s.completedAt ?? ts,
      }
    }
    if (s.order === stepOrder) {
      if (runOk) {
        return {
          ...s,
          status: 'complete' as const,
          completedAt: ts,
          lastRunId: runId ?? s.lastRunId,
        }
      }
      return {
        ...s,
        status: 'failed' as const,
        lastRunId: runId ?? s.lastRunId,
      }
    }
    if (s.order === stepOrder + 1 && runOk) {
      return {
        ...s,
        status: 'in_progress' as const,
        startedAt: s.startedAt ?? ts,
      }
    }
    return s
  })
}

export function applyStepAction(
  steps: PlanStep[],
  stepOrder: number,
  action: 'mark_done' | 'mark_failed' | 'skip' | 'reset' | 'activate',
): PlanStep[] {
  const ts = new Date().toISOString()
  return steps.map((s) => {
    if (s.order !== stepOrder) {
      if (action === 'activate' && s.order < stepOrder && s.status !== 'complete') {
        return { ...s, status: 'complete' as const, completedAt: s.completedAt ?? ts, skipped: true }
      }
      if (action === 'activate' && s.order > stepOrder) {
        return { ...s, status: 'pending' as const, startedAt: undefined, completedAt: undefined }
      }
      return s
    }
    switch (action) {
      case 'mark_done':
      case 'skip':
        return {
          ...s,
          status: 'complete' as const,
          completedAt: ts,
          skipped: action === 'skip' ? true : s.skipped,
        }
      case 'mark_failed':
        return { ...s, status: 'failed' as const }
      case 'reset':
        return {
          ...s,
          status: 'pending' as const,
          startedAt: undefined,
          completedAt: undefined,
          lastRunId: undefined,
          skipped: false,
        }
      case 'activate':
        return { ...s, status: 'in_progress' as const, startedAt: s.startedAt ?? ts }
      default:
        return s
    }
  })
}

/** After mark_done/skip on step N, open step N+1 if present. */
export function advanceAfterManualComplete(steps: PlanStep[], stepOrder: number): PlanStep[] {
  const ts = new Date().toISOString()
  const next = steps.find((s) => s.order === stepOrder + 1)
  if (!next || next.status === 'complete') return steps
  return steps.map((s) =>
    s.order === stepOrder + 1
      ? { ...s, status: 'in_progress' as const, startedAt: s.startedAt ?? ts }
      : s,
  )
}

export function isPlanComplete(steps: PlanStep[]): boolean {
  return steps.every((s) => s.status === 'complete')
}
