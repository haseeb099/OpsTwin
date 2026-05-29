// src/lib/analysis-engine.ts
// Orchestrates run analysis: gaps + LLM/rule-based prompt proposal

import { prisma } from '@/lib/db'
import { parseRunJson, type RawRunJson } from '@/lib/audit-parser'
import { analyzePlanVsRun } from '@/lib/gap-analyzer'
import { parsePlanFromDb } from '@/lib/plan-engine'
import { proposeNextPrompt } from '@/lib/prompt-proposer'
import { stackContextFromJson } from '@/lib/context-collector'
import { isLlmProposeEnabled, proposeWithLlm, type DocPatches } from '@/lib/llm-propose'
import type {
  AuditReport,
  MemoryEntry,
  MvpPlan,
  PlanGap,
  StackContext,
} from '@/types'

export interface AnalysisResult {
  improvedPrompt: string
  rationale: string
  docPatches?: DocPatches
  severitySummary: { blockers: number; warnings: number; info: number }
  suggestedCommands: string[]
  source: 'llm' | 'rules'
  gaps: PlanGap[]
  planStepOrder?: number
  runId?: string
}

export interface AnalyzeRunResult {
  analysis: AnalysisResult
  gaps: PlanGap[]
  stackContext: StackContext | null
  report: AuditReport | null
}

export interface ProposeOptions {
  taskId: string
  runId?: string
  planStepOrder?: number
  useLlm?: boolean
}

async function loadRunContext(taskId: string, runId?: string) {
  const run = runId
    ? await prisma.cursorRun.findUnique({ where: { id: runId } })
    : await prisma.cursorRun.findFirst({
        where: { taskId },
        orderBy: { startedAt: 'desc' },
      })

  let report: AuditReport | null = null
  if (run?.auditJson) {
    try {
      report = parseRunJson(JSON.parse(run.auditJson) as RawRunJson, taskId)
    } catch {
      /* ignore */
    }
  }

  const stackContext = stackContextFromJson(run?.stackContextJson ?? null)
  return { run, report, stackContext }
}

export async function analyzeRun(taskId: string, runId?: string): Promise<AnalyzeRunResult> {
  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) throw new Error('Task not found')

  const planRow = await prisma.plan.findFirst({
    where: { taskId },
    orderBy: { createdAt: 'desc' },
  })
  const plan = planRow ? parsePlanFromDb(planRow) : null

  const { run, report, stackContext } = await loadRunContext(taskId, runId)
  const gaps = plan ? analyzePlanVsRun(plan, report) : []

  const latestCaptured = await prisma.capturedPrompt.findFirst({
    where: { taskId },
    orderBy: { capturedAt: 'desc' },
  })

  const memories = await prisma.memoryEntry.findMany({
    orderBy: { successRate: 'desc' },
    take: 5,
  })

  const analysis = await buildAnalysis({
    taskId,
    taskTitle: task.title,
    originalPrompt: task.originalPrompt,
    capturedPrompt: latestCaptured?.content ?? null,
    plan,
    report,
    gaps,
    stackContext,
    memories: memories.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
    runId: run?.id,
    useLlm: isLlmProposeEnabled(),
  })

  return { analysis, gaps, stackContext, report }
}

async function buildAnalysis(input: {
  taskId: string
  taskTitle: string
  originalPrompt: string
  capturedPrompt?: string | null
  plan?: MvpPlan | null
  report?: AuditReport | null
  gaps: PlanGap[]
  stackContext?: StackContext | null
  memories?: MemoryEntry[]
  planStepOrder?: number
  runId?: string
  useLlm?: boolean
}): Promise<AnalysisResult> {
  const severitySummary = {
    blockers: input.gaps.filter((g) => g.severity === 'blocker').length,
    warnings: input.gaps.filter((g) => g.severity === 'warning').length,
    info: input.gaps.filter((g) => g.severity === 'info').length,
  }

  if (input.report) {
    severitySummary.blockers += input.report.mismatches.filter(
      (m) => m.severity === 'blocker',
    ).length
    severitySummary.warnings += input.report.mismatches.filter(
      (m) => m.severity === 'warning',
    ).length
  }

  const useLlm = input.useLlm !== false && isLlmProposeEnabled()

  if (useLlm) {
    const llm = await proposeWithLlm({
      taskTitle: input.taskTitle,
      originalPrompt: input.originalPrompt,
      capturedPrompt: input.capturedPrompt,
      plan: input.plan,
      report: input.report,
      gaps: input.gaps,
      stackContext: input.stackContext,
      memories: input.memories,
      planStepOrder: input.planStepOrder,
    })

    if (llm) {
      return {
        improvedPrompt: llm.improvedPrompt,
        rationale: llm.rationale,
        docPatches: llm.docPatches,
        suggestedCommands: llm.suggestedCommands,
        source: 'llm',
        gaps: input.gaps,
        severitySummary,
        planStepOrder: input.planStepOrder,
        runId: input.runId ?? input.report?.runId,
      }
    }
  }

  const rule = proposeNextPrompt({
    taskId: input.taskId,
    plan: input.plan,
    report: input.report,
    memories: input.memories,
    planStepOrder: input.planStepOrder,
  })

  const suggestedCommands: string[] = []
  if (input.report?.testsRun.some((t) => t.status === 'fail')) {
    suggestedCommands.push('npm test')
  }
  if (input.report?.blockers.some((b) => b.toLowerCase().includes('typecheck'))) {
    suggestedCommands.push('npm run typecheck')
  }
  if (input.stackContext?.database.orm === 'prisma') {
    suggestedCommands.push('npx prisma migrate dev')
  }

  return {
    improvedPrompt: rule.proposedPrompt,
    rationale: rule.rationale,
    suggestedCommands,
    source: 'rules',
    gaps: input.gaps,
    severitySummary,
    planStepOrder: rule.planStepOrder,
    runId: rule.runId ?? input.runId,
  }
}

export async function proposeFromAnalysis(options: ProposeOptions): Promise<AnalysisResult> {
  const { analysis } = await analyzeRun(options.taskId, options.runId)
  if (options.planStepOrder) {
    analysis.planStepOrder = options.planStepOrder
  }
  if (options.useLlm === false) {
    const task = await prisma.task.findUnique({ where: { id: options.taskId } })
    if (!task) throw new Error('Task not found')
    const planRow = await prisma.plan.findFirst({
      where: { taskId: options.taskId },
      orderBy: { createdAt: 'desc' },
    })
    const plan = planRow ? parsePlanFromDb(planRow) : null
    const { run, report, stackContext } = await loadRunContext(options.taskId, options.runId)
    const gaps = plan ? analyzePlanVsRun(plan, report) : []
    return buildAnalysis({
      taskId: options.taskId,
      taskTitle: task.title,
      originalPrompt: task.originalPrompt,
      plan,
      report,
      gaps,
      stackContext,
      planStepOrder: options.planStepOrder,
      runId: run?.id,
      useLlm: false,
    })
  }
  return analysis
}
