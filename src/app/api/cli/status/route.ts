// GET /api/cli/status?taskId= — dashboard polls CLI connection state + next action

import { NextRequest, NextResponse } from 'next/server'
import { countPendingDeliveries, findCliRunRequestByStatus, getCliSession, reconcileStaleRunRequests } from '@/lib/cli-sessions'
import { prisma } from '@/lib/db'
import { getApprovedPromptText, parseProposalFromDb } from '@/lib/prompt-proposer'

export const dynamic = 'force-dynamic'

export type AutopilotNextAction =
  | 'connect_cli'
  | 'review_draft'
  | 'wait_delivery'
  | 'agent_running'
  | 'run_agent'
  | 'propose_next'
  | 'idle'

function resolveNextAction(input: {
  connected: boolean
  draftProposals: number
  pendingDelivery: number
  pendingRun: boolean
  runningRun: boolean
  lastRunFinishedAt: Date | null | undefined
  lastDeliveredAt: Date | null | undefined
}): AutopilotNextAction {
  if (!input.connected) return 'connect_cli'
  if (input.runningRun) return 'agent_running'
  if (input.draftProposals > 0) return 'review_draft'
  if (input.pendingDelivery > 0 || input.pendingRun) return 'wait_delivery'

  if (input.lastDeliveredAt) {
    const runAt = input.lastRunFinishedAt?.getTime() ?? 0
    const deliveredAt = input.lastDeliveredAt.getTime()
    if (deliveredAt >= runAt) return 'run_agent'
  }

  if (input.lastRunFinishedAt) return 'propose_next'
  return 'idle'
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

export async function GET(req: NextRequest) {
  const taskId = new URL(req.url).searchParams.get('taskId')
  if (!taskId) {
    return NextResponse.json({ error: 'taskId required' }, { status: 400 })
  }

  try {
    const session = await getCliSession(taskId)
    await reconcileStaleRunRequests(taskId, !!session)
    const pendingDelivery = await countPendingDeliveries(taskId)
    const draftProposals = await prisma.promptProposal.count({
      where: { taskId, status: 'draft' },
    })
    const lastRun = await prisma.cursorRun.findFirst({
      where: { taskId },
      orderBy: { finishedAt: 'desc' },
      select: { id: true, finishedAt: true, status: true },
    })
    const lastDeliveredRow = await prisma.promptProposal.findFirst({
      where: { taskId, deliveredAt: { not: null } },
      orderBy: { deliveredAt: 'desc' },
    })

    const pendingRun = await findCliRunRequestByStatus(taskId, 'pending')
    const runningRun = await findCliRunRequestByStatus(taskId, 'running')

    const lastDelivered = lastDeliveredRow
      ? {
          proposalId: lastDeliveredRow.id,
          deliveredAt: lastDeliveredRow.deliveredAt!.toISOString(),
          promptPreview: getApprovedPromptText(parseProposalFromDb(lastDeliveredRow)).slice(0, 280),
        }
      : null

    const nextAction = resolveNextAction({
      connected: !!session,
      draftProposals,
      pendingDelivery,
      pendingRun: !!pendingRun,
      runningRun: !!runningRun,
      lastRunFinishedAt: lastRun?.finishedAt,
      lastDeliveredAt: lastDeliveredRow?.deliveredAt,
    })

    return NextResponse.json({
      connected: !!session,
      session,
      autoRun: session?.autoRun ?? false,
      pendingDelivery,
      draftProposals,
      nextAction,
      pendingRun: pendingRun
        ? { id: pendingRun.id, createdAt: toIso(pendingRun.createdAt) ?? new Date().toISOString() }
        : null,
      runningRun: runningRun
        ? { id: runningRun.id, startedAt: toIso(runningRun.startedAt) }
        : null,
      lastDelivered,
      lastRun: lastRun
        ? {
            id: lastRun.id,
            status: lastRun.status,
            finishedAt: lastRun.finishedAt?.toISOString() ?? null,
          }
        : null,
    })
  } catch (err) {
    console.error('[GET /api/cli/status]', err)
    return NextResponse.json({ error: 'Failed to read CLI status' }, { status: 500 })
  }
}
