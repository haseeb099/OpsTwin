// POST /api/prompts/capture — store captured agent prompt
// GET  /api/prompts/capture?taskId= — latest captured prompts

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import type { CapturedPromptRecord } from '@/types'

export const dynamic = 'force-dynamic'

const CaptureSchema = z.object({
  taskId: z.string().min(1),
  content: z.string().min(1),
  source: z.enum(['inbound_file', 'dashboard', 'agent_audit']).default('inbound_file'),
})

function toRecord(row: {
  id: string
  taskId: string
  source: string
  content: string
  capturedAt: Date
}): CapturedPromptRecord {
  return {
    id: row.id,
    taskId: row.taskId,
    source: row.source,
    content: row.content,
    capturedAt: row.capturedAt.toISOString(),
  }
}

export async function GET(req: NextRequest) {
  try {
    const taskId = new URL(req.url).searchParams.get('taskId')
    if (!taskId) {
      return NextResponse.json({ error: 'taskId required' }, { status: 400 })
    }

    const prompts = await prisma.capturedPrompt.findMany({
      where: { taskId },
      orderBy: { capturedAt: 'desc' },
      take: 10,
    })

    return NextResponse.json({
      prompts: prompts.map(toRecord),
      latest: prompts[0] ? toRecord(prompts[0]) : null,
    })
  } catch (err) {
    console.error('[GET /api/prompts/capture]', err)
    return NextResponse.json({ error: 'Failed to fetch captured prompts' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = CaptureSchema.parse(body)

    const task = await prisma.task.findUnique({ where: { id: data.taskId } })
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    const row = await prisma.capturedPrompt.create({
      data: {
        taskId: data.taskId,
        content: data.content,
        source: data.source,
      },
    })

    return NextResponse.json({ prompt: toRecord(row) }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors.map((e) => e.message).join(', ') },
        { status: 400 },
      )
    }
    console.error('[POST /api/prompts/capture]', err)
    return NextResponse.json({ error: 'Failed to capture prompt' }, { status: 500 })
  }
}
