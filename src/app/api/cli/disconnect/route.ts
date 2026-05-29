// POST /api/cli/disconnect — clear CLI session for a task (dashboard or CLI)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { disconnectCliSession } from '@/lib/cli-sessions'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  taskId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const data = BodySchema.parse(await req.json())
    await disconnectCliSession(data.taskId)
    return NextResponse.json({ ok: true, taskId: data.taskId, connected: false })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors.map((e) => e.message).join(', ') }, { status: 400 })
    }
    console.error('[POST /api/cli/disconnect]', err)
    return NextResponse.json({ error: 'Disconnect failed' }, { status: 500 })
  }
}
