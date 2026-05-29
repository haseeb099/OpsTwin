// GET   /api/plans/[id]
// PATCH /api/plans/[id] — approve plan or update step status

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { parsePlanFromDb } from '@/lib/plan-engine'
import { analyzePlanVsRun, advanceAfterManualComplete, applyStepAction, isPlanComplete } from '@/lib/gap-analyzer'
import { parseRunJson, type RawRunJson } from '@/lib/audit-parser'
import type { PlanStep } from '@/types'

export const dynamic = 'force-dynamic'

const PatchPlanSchema = z.object({
  action: z.enum(['approve', 'update_steps', 'complete', 'update_documents', 'step_action']),
  steps: z.array(z.record(z.unknown())).optional(),
  stepOrder: z.number().int().positive().optional(),
  stepAction: z.enum(['mark_done', 'mark_failed', 'skip', 'reset', 'activate']).optional(),
  documents: z
    .object({
      prd: z.string(),
      trd: z.string(),
      useCases: z.string(),
      testPlan: z.string(),
      architecture: z.string(),
      erd: z.string().optional(),
    })
    .optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const row = await prisma.plan.findUnique({ where: { id: params.id } })
    if (!row) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const plan = parsePlanFromDb(row)

    const latestRun = await prisma.cursorRun.findFirst({
      where: { taskId: plan.taskId },
      orderBy: { startedAt: 'desc' },
    })

    let report = null
    if (latestRun?.auditJson) {
      try {
        report = parseRunJson(JSON.parse(latestRun.auditJson) as RawRunJson, plan.taskId)
      } catch {
        /* ignore parse errors */
      }
    }

    const gaps = analyzePlanVsRun(plan, report)

    return NextResponse.json({ plan, gaps, latestRunId: latestRun?.id ?? null })
  } catch (err) {
    console.error('[GET /api/plans/[id]]', err)
    return NextResponse.json({ error: 'Failed to fetch plan' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const data = PatchPlanSchema.parse(body)

    const existing = await prisma.plan.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    if (data.action === 'approve') {
      const steps = JSON.parse(existing.stepsJson) as PlanStep[]
      const now = new Date().toISOString()
      if (steps[0]) {
        steps[0].status = 'in_progress'
        steps[0].startedAt = now
      }

      const row = await prisma.plan.update({
        where: { id: params.id },
        data: {
          status: 'approved',
          approvedAt: new Date(),
          stepsJson: JSON.stringify(steps),
        },
      })
      return NextResponse.json({ plan: parsePlanFromDb(row) })
    }

    if (data.action === 'update_steps' && data.steps) {
      const row = await prisma.plan.update({
        where: { id: params.id },
        data: {
          stepsJson: JSON.stringify(data.steps),
          status: 'in_progress',
        },
      })
      return NextResponse.json({ plan: parsePlanFromDb(row) })
    }

    if (data.action === 'complete') {
      const row = await prisma.plan.update({
        where: { id: params.id },
        data: { status: 'complete' },
      })
      return NextResponse.json({ plan: parsePlanFromDb(row) })
    }

    if (data.action === 'step_action') {
      if (!data.stepOrder || !data.stepAction) {
        return NextResponse.json({ error: 'stepOrder and stepAction required' }, { status: 400 })
      }
      let steps = JSON.parse(existing.stepsJson) as PlanStep[]
      steps = applyStepAction(steps, data.stepOrder, data.stepAction)
      if (['mark_done', 'skip'].includes(data.stepAction)) {
        steps = advanceAfterManualComplete(steps, data.stepOrder)
      }
      const allComplete = isPlanComplete(steps)
      const row = await prisma.plan.update({
        where: { id: params.id },
        data: {
          stepsJson: JSON.stringify(steps),
          status: allComplete ? 'complete' : 'in_progress',
        },
      })
      return NextResponse.json({ plan: parsePlanFromDb(row) })
    }

    if (data.action === 'update_documents' && data.documents) {
      const row = await prisma.plan.update({
        where: { id: params.id },
        data: {
          documentsJson: JSON.stringify(data.documents),
          version: existing.version + 1,
        },
      })
      return NextResponse.json({ plan: parsePlanFromDb(row) })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors.map((e) => e.message).join(', ') },
        { status: 400 },
      )
    }
    console.error('[PATCH /api/plans/[id]]', err)
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
  }
}
