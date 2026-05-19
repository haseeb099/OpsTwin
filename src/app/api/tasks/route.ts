// src/app/api/tasks/route.ts
// GET /api/tasks         — list all tasks (optionally filtered by ?repo=)
// POST /api/tasks        — create a new task

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

const CreateTaskSchema = z.object({
  user: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().default('main'),
  originalPrompt: z.string().min(10),
  title: z.string().min(1),
})

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const repo = searchParams.get('repo')

    const tasks = await prisma.task.findMany({
      where: repo ? { repo } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: {
            fileEdits: true,
            inspectedFiles: true,
          },
        },
      },
    })

    return NextResponse.json({ tasks })
  } catch (err) {
    console.error('[GET /api/tasks]', err)
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = CreateTaskSchema.parse(body)

    const task = await prisma.task.create({ data })

    return NextResponse.json({ task }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: `Invalid input: ${err.errors.map((e) => e.message).join(', ')}` },
        { status: 400 },
      )
    }
    console.error('[POST /api/tasks]', err)
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
  }
}
