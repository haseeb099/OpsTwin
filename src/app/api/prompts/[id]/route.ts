// PATCH /api/prompts/[id] — approve or reject proposal

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { parseProposalFromDb, getApprovedPromptText } from '@/lib/prompt-proposer'

export const dynamic = 'force-dynamic'

const PatchSchema = z.object({
  action: z.enum(['approve', 'reject']),
  userEdits: z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const data = PatchSchema.parse(body)

    const existing = await prisma.promptProposal.findUnique({ where: { id: params.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })
    }

    if (data.action === 'reject') {
      const row = await prisma.promptProposal.update({
        where: { id: params.id },
        data: { status: 'rejected' },
      })
      return NextResponse.json({ proposal: parseProposalFromDb(row) })
    }

    const row = await prisma.promptProposal.update({
      where: { id: params.id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        userEdits: data.userEdits ?? existing.userEdits,
      },
    })

    const proposal = parseProposalFromDb(row)

    return NextResponse.json({
      proposal,
      approvedPrompt: getApprovedPromptText(proposal),
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.errors.map((e) => e.message).join(', ') },
        { status: 400 },
      )
    }
    console.error('[PATCH /api/prompts/[id]]', err)
    return NextResponse.json({ error: 'Failed to update proposal' }, { status: 500 })
  }
}
