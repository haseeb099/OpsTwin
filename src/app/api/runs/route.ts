// src/app/api/runs/route.ts
// GET  /api/runs?taskId=... — list runs (optionally filtered)
// POST /api/runs            — supports two actions:
//   { action: "start",        taskId, branch, cursorVersion? }
//   { action: "upload_audit", runId?, taskId, auditJson }

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { parseRunJson, generateFocusedRerunPrompt } from '@/lib/audit-parser'
import { buildMemoryEntry } from '@/lib/memory-engine'
import type { RawRunJson } from '@/lib/audit-parser'

export const dynamic = 'force-dynamic'

const StartRunSchema = z.object({
  action: z.literal('start'),
  taskId: z.string().min(1),
  branch: z.string().min(1),
  cursorVersion: z.string().optional(),
})

const UploadAuditSchema = z.object({
  action: z.literal('upload_audit'),
  runId: z.string().optional(),
  taskId: z.string().min(1),
  auditJson: z.record(z.any()),
})

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const taskId = searchParams.get('taskId')

    const runs = await prisma.cursorRun.findMany({
      where: taskId ? { taskId } : undefined,
      orderBy: { startedAt: 'desc' },
      include: {
        fileEdits: true,
        inspectedFiles: true,
        outcomes: { orderBy: { acceptedAt: 'desc' } },
        task: { select: { title: true, repo: true } },
      },
    })

    return NextResponse.json({ runs })
  } catch (err) {
    console.error('[GET /api/runs]', err)
    return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body is not valid JSON' }, { status: 400 })
  }

  const action = (body as { action?: string } | null)?.action

  try {
    if (action === 'start') {
      const data = StartRunSchema.parse(body)

      const task = await prisma.task.findUnique({ where: { id: data.taskId } })
      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      }

      const run = await prisma.cursorRun.create({
        data: {
          taskId: data.taskId,
          branch: data.branch,
          cursorVersion: data.cursorVersion,
          status: 'running',
        },
      })

      return NextResponse.json({ run }, { status: 201 })
    }

    if (action === 'upload_audit') {
      const data = UploadAuditSchema.parse(body)
      const raw = data.auditJson as unknown as RawRunJson
      const report = parseRunJson(raw, data.taskId)

      const status = report.mismatches.some((m) => m.severity === 'blocker')
        ? 'partial'
        : 'complete'

      // Resolve or create the run record so the upload-from-file flow works
      // even without a prior /api/runs?action=start call.
      const targetRunId = data.runId ?? report.runId
      const existing = targetRunId
        ? await prisma.cursorRun.findUnique({ where: { id: targetRunId } })
        : null

      const run = existing
        ? await prisma.cursorRun.update({
            where: { id: existing.id },
            data: {
              status,
              confidence: report.confidence,
              branch: report.branch,
              finishedAt: new Date(),
              auditJson: JSON.stringify(data.auditJson),
              fileEdits: {
                deleteMany: {},
                create: report.filesChanged.map((f) => ({
                  path: f.path,
                  diff: f.diff,
                  linesAdded: f.linesAdded,
                  linesRemoved: f.linesRemoved,
                })),
              },
              inspectedFiles: {
                deleteMany: {},
                create: report.filesInspected.map((f) => ({
                  path: f.path,
                  reason: f.reason,
                  touched: f.touched,
                })),
              },
            },
            include: { fileEdits: true, inspectedFiles: true },
          })
        : await prisma.cursorRun.create({
            data: {
              id: targetRunId,
              taskId: data.taskId,
              status,
              confidence: report.confidence,
              branch: report.branch,
              finishedAt: new Date(),
              auditJson: JSON.stringify(data.auditJson),
              fileEdits: {
                create: report.filesChanged.map((f) => ({
                  path: f.path,
                  diff: f.diff,
                  linesAdded: f.linesAdded,
                  linesRemoved: f.linesRemoved,
                })),
              },
              inspectedFiles: {
                create: report.filesInspected.map((f) => ({
                  path: f.path,
                  reason: f.reason,
                  touched: f.touched,
                })),
              },
            },
            include: { fileEdits: true, inspectedFiles: true },
          })

      // Build / upsert a memory entry keyed by patternHash.
      const memEntry = buildMemoryEntry(report)
      await prisma.memoryEntry.upsert({
        where: { patternHash: memEntry.patternHash },
        create: memEntry,
        update: {
          outcomeSummary: memEntry.outcomeSummary,
          improvementSuggestion: memEntry.improvementSuggestion,
        },
      })

      const focusedRerunPrompt =
        report.mismatches.length > 0 ? generateFocusedRerunPrompt(report) : null

      return NextResponse.json({
        run,
        report,
        focusedRerunPrompt,
        memoryEntry: memEntry,
      })
    }

    return NextResponse.json({ error: `Unknown action: ${action ?? '(none)'}` }, { status: 400 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: `Invalid input: ${err.errors.map((e) => e.message).join(', ')}` },
        { status: 400 },
      )
    }
    console.error('[POST /api/runs]', err)
    return NextResponse.json({ error: 'Failed to process run' }, { status: 500 })
  }
}
