// POST /api/runs/[id]/analyze — preview analysis without creating a proposal

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { analyzeRun } from '@/lib/analysis-engine'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const run = await prisma.cursorRun.findUnique({ where: { id: params.id } })
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    const result = await analyzeRun(run.taskId, run.id)

    return NextResponse.json({
      analysis: result.analysis,
      gaps: result.gaps,
      stackContext: result.stackContext,
      report: result.report,
    })
  } catch (err) {
    console.error('[POST /api/runs/[id]/analyze]', err)
    return NextResponse.json({ error: 'Failed to analyze run' }, { status: 500 })
  }
}
