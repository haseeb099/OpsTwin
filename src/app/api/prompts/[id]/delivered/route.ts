// POST /api/prompts/[id]/delivered — CLI confirms prompt written to repo

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseProposalFromDb } from '@/lib/prompt-proposer'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const existing = await prisma.promptProposal.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    const row = await prisma.promptProposal.update({
      where: { id: params.id },
      data: { deliveredAt: new Date() },
    })

    return NextResponse.json({ proposal: parseProposalFromDb(row) })
  } catch (err) {
    console.error('[POST /api/prompts/[id]/delivered]', err)
    return NextResponse.json({ error: 'Failed to mark delivered' }, { status: 500 })
  }
}
