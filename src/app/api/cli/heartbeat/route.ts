// POST /api/cli/heartbeat — CLI daemon registers liveness for a task

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { upsertCliSession } from '@/lib/cli-sessions'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  taskId: z.string().min(1),
  repoPath: z.string().optional(),
  mode: z.string().default('daemon'),
  pid: z.number().optional(),
  autoRun: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const data = BodySchema.parse(await req.json())
    const session = await upsertCliSession({
      taskId: data.taskId,
      repoPath: data.repoPath,
      mode: data.mode,
      pid: data.pid,
      autoRun: data.autoRun,
    })
    return NextResponse.json({ ok: true, taskId: data.taskId, session })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors.map((e) => e.message).join(', ') }, { status: 400 })
    }
    console.error('[POST /api/cli/heartbeat]', err)
    return NextResponse.json({ error: 'Heartbeat failed' }, { status: 500 })
  }
}
