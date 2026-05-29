// POST /api/cli/settings — toggle auto-run for connected CLI

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { setCliAutoRun } from '@/lib/cli-sessions'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  taskId: z.string().min(1),
  autoRun: z.boolean(),
})

export async function POST(req: NextRequest) {
  try {
    const data = BodySchema.parse(await req.json())
    const result = await setCliAutoRun(data.taskId, data.autoRun)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors.map((e) => e.message).join(', ') }, { status: 400 })
    }
    console.error('[POST /api/cli/settings]', err)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
