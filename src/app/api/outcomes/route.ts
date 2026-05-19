// src/app/api/outcomes/route.ts
// POST /api/outcomes — record an accept / reject / modify / rerun decision for a run.
// Side-effect: updates the related memory entry's success rate via /api/memory.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { extractTaskType } from '@/lib/audit-parser'

export const dynamic = 'force-dynamic'

const OutcomeSchema = z.object({
  runId: z.string().min(1),
  action: z.enum(['accepted', 'rejected', 'modified', 'rerun']),
  userFeedback: z.string().optional(),
  timeToFixMs: z.number().int().nonnegative().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = OutcomeSchema.parse(body)

    const run = await prisma.cursorRun.findUnique({
      where: { id: data.runId },
      include: { task: true },
    })
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    const outcome = await prisma.outcome.create({
      data: {
        runId: data.runId,
        action: data.action,
        userFeedback: data.userFeedback,
        timeToFixMs: data.timeToFixMs,
      },
    })

    // Update the corresponding memory entry's success rate so we learn from
    // every outcome (not only on the first record_outcome call).
    const taskType = extractTaskType(run.task.originalPrompt)
    const entry = await prisma.memoryEntry.findFirst({
      where: { taskType },
      orderBy: { createdAt: 'desc' },
    })

    if (entry) {
      const accepted = data.action === 'accepted'
      const nextReuse = entry.reuseCount + 1
      const nextSuccess =
        (entry.successRate * entry.reuseCount + (accepted ? 1 : 0)) / nextReuse
      await prisma.memoryEntry.update({
        where: { id: entry.id },
        data: { reuseCount: nextReuse, successRate: nextSuccess },
      })
    }

    return NextResponse.json({ outcome }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: `Invalid input: ${err.errors.map((e) => e.message).join(', ')}` },
        { status: 400 },
      )
    }
    console.error('[POST /api/outcomes]', err)
    return NextResponse.json({ error: 'Failed to record outcome' }, { status: 500 })
  }
}
