// POST /api/prompts/propose — generate next prompt proposal

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { parsePlanFromDb } from '@/lib/plan-engine'
import { parseRunJson, type RawRunJson } from '@/lib/audit-parser'
import { proposeNextPrompt, parseProposalFromDb } from '@/lib/prompt-proposer'

export const dynamic = 'force-dynamic'

const ProposeSchema = z.object({
  taskId: z.string().min(1),
  runId: z.string().optional(),
  planStepOrder: z.number().int().positive().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = ProposeSchema.parse(body)

    const task = await prisma.task.findUnique({ where: { id: data.taskId } })
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const planRow = await prisma.plan.findFirst({
      where: { taskId: data.taskId },
      orderBy: { createdAt: 'desc' },
    })
    const plan = planRow ? parsePlanFromDb(planRow) : null

    let report = null
    const runId = data.runId
    const run = runId
      ? await prisma.cursorRun.findUnique({ where: { id: runId } })
      : await prisma.cursorRun.findFirst({
          where: { taskId: data.taskId },
          orderBy: { startedAt: 'desc' },
        })

    if (run?.auditJson) {
      try {
        report = parseRunJson(JSON.parse(run.auditJson) as RawRunJson, data.taskId)
      } catch {
        /* ignore */
      }
    }

    const memories = await prisma.memoryEntry.findMany({
      orderBy: { successRate: 'desc' },
      take: 5,
    })

    const proposed = proposeNextPrompt({
      taskId: data.taskId,
      plan,
      report,
      memories: memories.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      })),
      planStepOrder: data.planStepOrder,
    })

    const row = await prisma.promptProposal.create({
      data: {
        taskId: data.taskId,
        planId: planRow?.id,
        runId: run?.id,
        planStepOrder: proposed.planStepOrder,
        proposedPrompt: proposed.proposedPrompt,
        rationale: proposed.rationale,
        status: 'draft',
      },
    })

    return NextResponse.json(
      { proposal: parseProposalFromDb(row) },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors.map((e) => e.message).join(', ') },
        { status: 400 },
      )
    }
    console.error('[POST /api/prompts/propose]', err)
    return NextResponse.json({ error: 'Failed to propose prompt' }, { status: 500 })
  }
}
