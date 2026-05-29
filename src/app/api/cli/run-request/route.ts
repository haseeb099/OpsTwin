// POST /api/cli/run-request — queue Cursor agent run (picked up by daemon)
// GET  /api/cli/run-request?taskId= — daemon polls pending run

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { findPendingCliRunRequest, queueCliRunRequest } from '@/lib/cli-sessions'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const PostSchema = z.object({
  taskId: z.string().min(1),
  proposalId: z.string().optional(),
  prompt: z.string().min(10).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const taskId = new URL(req.url).searchParams.get('taskId')
    if (!taskId) {
      return NextResponse.json({ error: 'taskId required' }, { status: 400 })
    }

    const pending = await findPendingCliRunRequest(taskId)
    return NextResponse.json({ pending: pending ?? null })
  } catch (err) {
    console.error('[GET /api/cli/run-request]', err)
    return NextResponse.json({ error: 'Failed to fetch run request' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = PostSchema.parse(await req.json())

    let prompt = data.prompt
    if (!prompt && data.proposalId) {
      const row = await prisma.promptProposal.findUnique({ where: { id: data.proposalId } })
      if (!row) {
        return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
      }
      prompt = row.userEdits ?? row.proposedPrompt
    }

    if (!prompt || prompt.length < 10) {
      return NextResponse.json(
        { error: 'prompt required (or proposalId with stored prompt)' },
        { status: 400 },
      )
    }

    const row = await queueCliRunRequest({
      taskId: data.taskId,
      proposalId: data.proposalId,
      prompt,
    })

    return NextResponse.json({ runRequest: row }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors.map((e) => e.message).join(', ') }, { status: 400 })
    }
    console.error('[POST /api/cli/run-request]', err)
    return NextResponse.json({ error: 'Failed to queue run' }, { status: 500 })
  }
}
