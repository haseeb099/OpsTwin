// GET /api/prompts?taskId= — list proposals for task

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseProposalFromDb } from '@/lib/prompt-proposer'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const taskId = new URL(req.url).searchParams.get('taskId')
    if (!taskId) {
      return NextResponse.json({ error: 'taskId required' }, { status: 400 })
    }

    const rows = await prisma.promptProposal.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return NextResponse.json({
      proposals: rows.map(parseProposalFromDb),
    })
  } catch (err) {
    console.error('[GET /api/prompts]', err)
    return NextResponse.json({ error: 'Failed to fetch prompts' }, { status: 500 })
  }
}
