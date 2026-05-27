// src/app/api/tasks/[id]/route.ts
// GET    /api/tasks/[id]  — single task with all its runs
// PATCH  /api/tasks/[id]  — update a subset of fields (title, branch)
// DELETE /api/tasks/[id]  — cascade-delete a task and all its runs

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  branch: z.string().min(1).optional(),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        runs: {
          orderBy: { startedAt: 'desc' },
          include: {
            fileEdits: true,
            inspectedFiles: true,
            outcomes: { orderBy: { acceptedAt: 'desc' } },
          },
        },
      },
    })

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    return NextResponse.json({ task })
  } catch (err) {
    console.error('[GET /api/tasks/[id]]', err)
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const data = UpdateTaskSchema.parse(body)

    const task = await prisma.task.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json({ task })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: `Invalid input: ${err.errors.map((e) => e.message).join(', ')}` },
        { status: 400 },
      )
    }
    console.error('[PATCH /api/tasks/[id]]', err)
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Cascade manually because SQLite + Prisma does not auto-cascade.
    const runs = await prisma.cursorRun.findMany({
      where: { taskId: params.id },
      select: { id: true },
    })
    const runIds = runs.map((r) => r.id)

    await prisma.$transaction([
      prisma.promptProposal.deleteMany({ where: { taskId: params.id } }),
      prisma.plan.deleteMany({ where: { taskId: params.id } }),
      prisma.terminalLog.deleteMany({ where: { runId: { in: runIds } } }),
      prisma.runScreenshot.deleteMany({ where: { runId: { in: runIds } } }),
      prisma.outcome.deleteMany({ where: { runId: { in: runIds } } }),
      prisma.fileEdit.deleteMany({ where: { runId: { in: runIds } } }),
      prisma.inspectedFile.deleteMany({ where: { runId: { in: runIds } } }),
      prisma.expectation.deleteMany({ where: { runId: { in: runIds } } }),
      prisma.cursorRun.deleteMany({ where: { taskId: params.id } }),
      prisma.task.delete({ where: { id: params.id } }),
    ])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/tasks/[id]]', err)
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
  }
}
