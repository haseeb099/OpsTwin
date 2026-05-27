// GET  /api/runs/[id]/screenshots
// POST /api/runs/[id]/screenshots — upload UI screenshot (base64 data URL)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const ScreenshotSchema = z.object({
  label: z.string().default('screenshot'),
  dataUrl: z.string().min(20).max(5_000_000),
})

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const screenshots = await prisma.runScreenshot.findMany({
      where: { runId: params.id },
      orderBy: { capturedAt: 'desc' },
    })
    return NextResponse.json({ screenshots })
  } catch (err) {
    console.error('[GET /api/runs/[id]/screenshots]', err)
    return NextResponse.json({ error: 'Failed to fetch screenshots' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const run = await prisma.cursorRun.findUnique({ where: { id: params.id } })
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }

    const body = await req.json()
    const data = ScreenshotSchema.parse(body)

    const screenshot = await prisma.runScreenshot.create({
      data: {
        runId: params.id,
        label: data.label,
        dataUrl: data.dataUrl,
      },
    })

    return NextResponse.json({ screenshot }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors.map((e) => e.message).join(', ') }, { status: 400 })
    }
    console.error('[POST /api/runs/[id]/screenshots]', err)
    return NextResponse.json({ error: 'Failed to save screenshot' }, { status: 500 })
  }
}
