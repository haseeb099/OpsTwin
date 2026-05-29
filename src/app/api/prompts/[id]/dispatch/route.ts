// POST /api/prompts/[id]/dispatch — mark dispatched + return prompt for agent injection

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseProposalFromDb, getApprovedPromptText } from '@/lib/prompt-proposer'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const existing = await prisma.promptProposal.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    if (existing.status === 'rejected') {
      return NextResponse.json({ error: 'Cannot dispatch rejected proposal' }, { status: 400 })
    }

    const row = await prisma.promptProposal.update({
      where: { id: params.id },
      data: {
        status: 'dispatched',
        dispatchedAt: new Date(),
        deliveredAt: null,
        approvedAt: existing.approvedAt ?? new Date(),
      },
    })

    const proposal = parseProposalFromDb(row)
    const prompt = getApprovedPromptText(proposal)

    return NextResponse.json({
      proposal,
      prompt,
      dispatchFiles: {
        primary: '.ops/dispatch/pending-prompt.md',
        cursor: '.cursor/pending-task.md',
      },
      instructions:
        'Write prompt to .ops/dispatch/pending-prompt.md in target repo. Agent reads this file automatically per .opstwin/rules.md',
    })
  } catch (err) {
    console.error('[POST /api/prompts/[id]/dispatch]', err)
    return NextResponse.json({ error: 'Failed to dispatch' }, { status: 500 })
  }
}
