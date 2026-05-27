// GET /api/health — quick health check

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await prisma.task.count()
    return NextResponse.json({ status: 'ok', db: 'connected' })
  } catch {
    return NextResponse.json({ status: 'degraded', db: 'error' }, { status: 503 })
  }
}
