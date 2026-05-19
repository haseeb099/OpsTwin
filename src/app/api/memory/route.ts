// src/app/api/memory/route.ts
// GET  /api/memory?prompt=...   — list entries + optional pattern-match suggestion
// GET  /api/memory?format=summary — JSON dump used by .ops/memory_summary.json
// POST /api/memory              — { action: "record_outcome", runId, outcomeAction }

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { matchMemoryPattern, summarizeMemoryToFile } from '@/lib/memory-engine'
import type { MemoryEntry } from '@/types'

export const dynamic = 'force-dynamic'

const RecordOutcomeSchema = z.object({
  action: z.literal('record_outcome'),
  runId: z.string().min(1),
  outcomeAction: z.enum(['accepted', 'rejected', 'modified', 'rerun']),
  userFeedback: z.string().optional(),
})

function toMemoryEntry(row: {
  id: string
  taskType: string
  patternHash: string
  outcomeSummary: string
  improvementSuggestion: string
  reuseCount: number
  successRate: number
  createdAt: Date
}): MemoryEntry {
  return {
    id: row.id,
    taskType: row.taskType,
    patternHash: row.patternHash,
    outcomeSummary: row.outcomeSummary,
    improvementSuggestion: row.improvementSuggestion,
    reuseCount: row.reuseCount,
    successRate: row.successRate,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const prompt = searchParams.get('prompt')
    const format = searchParams.get('format')

    const rows = await prisma.memoryEntry.findMany({
      orderBy: [{ successRate: 'desc' }, { reuseCount: 'desc' }],
    })
    const entries = rows.map(toMemoryEntry)

    if (format === 'summary') {
      const summary = await summarizeMemoryToFile(entries)
      return new Response(summary, {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (prompt) {
      const suggestion = matchMemoryPattern(prompt, entries)
      return NextResponse.json({ suggestion, entries })
    }

    return NextResponse.json({ entries })
  } catch (err) {
    console.error('[GET /api/memory]', err)
    return NextResponse.json({ error: 'Failed to fetch memory' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = RecordOutcomeSchema.parse(body)

    const run = await prisma.cursorRun.findUnique({
      where: { id: data.runId },
      include: { task: true },
    })
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    // Find the memory entry tied to this run's task type (best-effort: most
    // recent entry for the task type). If none exist we just no-op.
    const promptForType = run.task.originalPrompt
    const lower = promptForType.toLowerCase()
    const taskType = lower.includes('refactor')
      ? 'refactor'
      : lower.includes('fix') || lower.includes('bug')
        ? 'bugfix'
        : lower.includes('test')
          ? 'testing'
          : lower.includes('migrate')
            ? 'migration'
            : lower.includes('add') || lower.includes('create')
              ? 'feature'
              : 'general'

    const entry = await prisma.memoryEntry.findFirst({
      where: { taskType },
      orderBy: { createdAt: 'desc' },
    })

    if (entry) {
      const accepted = data.outcomeAction === 'accepted'
      const nextReuse = entry.reuseCount + 1
      const nextSuccess =
        (entry.successRate * entry.reuseCount + (accepted ? 1 : 0)) / nextReuse

      await prisma.memoryEntry.update({
        where: { id: entry.id },
        data: { reuseCount: nextReuse, successRate: nextSuccess },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: `Invalid input: ${err.errors.map((e) => e.message).join(', ')}` },
        { status: 400 },
      )
    }
    console.error('[POST /api/memory]', err)
    return NextResponse.json({ error: 'Failed to record outcome' }, { status: 500 })
  }
}
