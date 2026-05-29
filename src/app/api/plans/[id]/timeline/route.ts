// GET /api/plans/[id]/timeline — activity feed for Command Center

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { buildPlanTimeline } from '@/lib/plan-timeline'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const row = await prisma.plan.findUnique({ where: { id: params.id } })
    if (!row) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
    }

    const events = await buildPlanTimeline(row.taskId)
    return NextResponse.json({ events })
  } catch (err) {
    console.error('[GET /api/plans/[id]/timeline]', err)
    return NextResponse.json({ error: 'Failed to build timeline' }, { status: 500 })
  }
}
