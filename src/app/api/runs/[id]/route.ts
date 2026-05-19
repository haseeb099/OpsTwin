// src/app/api/runs/[id]/route.ts
// GET /api/runs/[id] — fetch a run, rebuild its AuditReport from stored auditJson,
// and include a generated focusedRerunPrompt so the UI can copy it directly.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { parseRunJson, generateFocusedRerunPrompt } from '@/lib/audit-parser'
import type { RawRunJson } from '@/lib/audit-parser'
import type { AuditReport } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const run = await prisma.cursorRun.findUnique({
      where: { id: params.id },
      include: {
        fileEdits: true,
        inspectedFiles: true,
        outcomes: { orderBy: { acceptedAt: 'desc' } },
        task: true,
      },
    })

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    let report: AuditReport | null = null
    let focusedRerunPrompt: string | null = null

    if (run.auditJson) {
      try {
        const raw = JSON.parse(run.auditJson) as RawRunJson
        report = parseRunJson(raw, run.taskId)
        focusedRerunPrompt =
          report.mismatches.length > 0 ? generateFocusedRerunPrompt(report) : null
      } catch (parseErr) {
        console.error('[GET /api/runs/[id]] auditJson parse failed', parseErr)
      }
    }

    return NextResponse.json({ run, report, focusedRerunPrompt })
  } catch (err) {
    console.error('[GET /api/runs/[id]]', err)
    return NextResponse.json({ error: 'Failed to fetch run' }, { status: 500 })
  }
}
