// PATCH /api/cli/run-request/[id] — daemon updates run status

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { findCliRunRequestById, updateCliRunRequest } from '@/lib/cli-sessions'

export const dynamic = 'force-dynamic'

const PatchSchema = z.object({
  status: z.enum(['running', 'completed', 'failed', 'cancelled']),
  error: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data = PatchSchema.parse(await req.json())
    const existing = await findCliRunRequestById(params.id)
    if (!existing) {
      return NextResponse.json({ error: 'Run request not found' }, { status: 404 })
    }

    const row = await updateCliRunRequest(params.id, {
      status: data.status,
      error: data.error,
    })

    return NextResponse.json({ runRequest: row })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors.map((e) => e.message).join(', ') }, { status: 400 })
    }
    console.error('[PATCH /api/cli/run-request/[id]]', err)
    return NextResponse.json({ error: 'Failed to update run request' }, { status: 500 })
  }
}
