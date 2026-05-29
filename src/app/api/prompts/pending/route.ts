// GET /api/prompts/pending?taskId= — proposals dispatched but not yet delivered to repo

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApprovedPromptText, parseProposalFromDb } from '@/lib/prompt-proposer'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const taskId = new URL(req.url).searchParams.get('taskId')
    if (!taskId) {
      return NextResponse.json({ error: 'taskId required' }, { status: 400 })
    }

    const rows = await prisma.promptProposal.findMany({
      where: {
        taskId,
        deliveredAt: null,
        status: { in: ['approved', 'dispatched'] },
      },
      orderBy: { dispatchedAt: 'asc' },
    })

    return NextResponse.json({
      pending: rows.map((row) => {
        const proposal = parseProposalFromDb(row)
        return {
          proposal,
          prompt: getApprovedPromptText(proposal),
        }
      }),
    })
  } catch (err) {
    console.error('[GET /api/prompts/pending]', err)
    return NextResponse.json({ error: 'Failed to fetch pending deliveries' }, { status: 500 })
  }
}
