// GET  /api/runs/[id]/terminal
// POST /api/runs/[id]/terminal — capture command output

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const TerminalSchema = z.object({
  command: z.string().min(1),
  exitCode: z.number().int(),
  stdout: z.string().default(''),
  stderr: z.string().default(''),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const logs = await prisma.terminalLog.findMany({
      where: { runId: params.id },
      orderBy: { capturedAt: 'desc' },
    })
    return NextResponse.json({ logs })
  } catch (err) {
    console.error('[GET /api/runs/[id]/terminal]', err)
    return NextResponse.json({ error: 'Failed to fetch terminal logs' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const run = await prisma.cursorRun.findUnique({ where: { id: params.id } })
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    const body = await req.json()
    const data = TerminalSchema.parse(body)

    const log = await prisma.terminalLog.create({
      data: {
        runId: params.id,
        command: data.command,
        exitCode: data.exitCode,
        stdout: data.stdout.slice(0, 50000),
        stderr: data.stderr.slice(0, 50000),
      },
    })

    return NextResponse.json({ log }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors.map((e) => e.message).join(', ') }, { status: 400 })
    }
    console.error('[POST /api/runs/[id]/terminal]', err)
    return NextResponse.json({ error: 'Failed to save terminal log' }, { status: 500 })
  }
}
