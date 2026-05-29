// POST /api/prompts/propose — generate next prompt proposal via analysis engine

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { proposeFromAnalysis } from '@/lib/analysis-engine'
import { parseProposalFromDb } from '@/lib/prompt-proposer'
import { getLlmProposeProvider } from '@/lib/llm-propose'

export const dynamic = 'force-dynamic'

const ProposeSchema = z.object({
  taskId: z.string().min(1),
  runId: z.string().optional(),
  planStepOrder: z.number().int().positive().optional(),
  useLlm: z.boolean().optional(),
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

    const analysis = await proposeFromAnalysis({
      taskId: data.taskId,
      runId: data.runId,
      planStepOrder: data.planStepOrder,
      useLlm: data.useLlm,
    })

    const runId =
      data.runId ??
      analysis.runId ??
      (
        await prisma.cursorRun.findFirst({
          where: { taskId: data.taskId },
          orderBy: { startedAt: 'desc' },
        })
      )?.id

    const row = await prisma.promptProposal.create({
      data: {
        taskId: data.taskId,
        planId: planRow?.id,
        runId,
        planStepOrder: analysis.planStepOrder,
        proposedPrompt: analysis.improvedPrompt,
        rationale: analysis.rationale,
        status: 'draft',
      },
    })

    return NextResponse.json(
      {
        proposal: parseProposalFromDb(row),
        source: analysis.source,
        llmProvider: getLlmProposeProvider(),
        suggestedCommands: analysis.suggestedCommands,
        docPatches: analysis.docPatches,
      },
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
