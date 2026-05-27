// GET  /api/plans?taskId= — latest plan for task
// POST /api/plans — generate MVP plan { taskId }

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { generatePlanWithLlm, getLlmProvider } from '@/lib/llm'
import { parsePlanFromDb } from '@/lib/plan-engine'

export const dynamic = 'force-dynamic'

const CreatePlanSchema = z.object({
  taskId: z.string().min(1),
})

export async function GET(req: NextRequest) {
  try {
    const taskId = new URL(req.url).searchParams.get('taskId')
    if (!taskId) {
      return NextResponse.json({ error: 'taskId query param required' }, { status: 400 })
    }

    const row = await prisma.plan.findFirst({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    })

    if (!row) {
      return NextResponse.json({ plan: null })
    }

    return NextResponse.json({ plan: parsePlanFromDb(row) })
  } catch (err) {
    console.error('[GET /api/plans]', err)
    return NextResponse.json({ error: 'Failed to fetch plan' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { taskId } = CreatePlanSchema.parse(body)

    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const generated = await generatePlanWithLlm({
      taskId: task.id,
      title: task.title,
      repo: task.repo,
      branch: task.branch,
      originalPrompt: task.originalPrompt,
    })

    const existing = await prisma.plan.findFirst({
      where: { taskId },
      orderBy: { version: 'desc' },
    })

    const row = await prisma.plan.create({
      data: {
        taskId,
        version: (existing?.version ?? 0) + 1,
        originalPrompt: task.originalPrompt,
        stepsJson: JSON.stringify(generated.steps),
        documentsJson: JSON.stringify(generated.documents),
        status: 'draft',
      },
    })

    return NextResponse.json(
      { plan: parsePlanFromDb(row), source: generated.source ?? getLlmProvider() },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors.map((e) => e.message).join(', ') },
        { status: 400 },
      )
    }
    console.error('[POST /api/plans]', err)
    return NextResponse.json({ error: 'Failed to generate plan' }, { status: 500 })
  }
}
