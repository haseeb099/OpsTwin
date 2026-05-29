// CLI connection registry — persisted in SQLite (survives Next.js hot reload)

import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'

export interface CliSession {
  taskId: string
  repoPath: string
  mode: string
  pid?: number
  autoRun?: boolean
  lastSeen: string
}

const STALE_MS = 45_000

type CliRow = {
  taskId: string
  repoPath: string
  mode: string
  pid: number | null
  autoRun?: boolean | number | null
  lastSeen: Date | string
}

function toSession(row: CliRow): CliSession {
  return {
    taskId: row.taskId,
    repoPath: row.repoPath,
    mode: row.mode,
    pid: row.pid ?? undefined,
    autoRun: row.autoRun === true || row.autoRun === 1,
    lastSeen: row.lastSeen instanceof Date ? row.lastSeen.toISOString() : String(row.lastSeen),
  }
}

async function upsertCliSessionRaw(input: {
  taskId: string
  repoPath?: string
  mode?: string
  pid?: number
  autoRun?: boolean
}) {
  const now = new Date().toISOString()
  if (input.autoRun === undefined) {
    await prisma.$executeRaw`
      INSERT INTO CliConnection (taskId, repoPath, mode, pid, autoRun, lastSeen)
      VALUES (${input.taskId}, ${input.repoPath ?? ''}, ${input.mode ?? 'daemon'}, ${input.pid ?? null}, 0, ${now})
      ON CONFLICT(taskId) DO UPDATE SET
        repoPath = excluded.repoPath,
        mode = excluded.mode,
        pid = excluded.pid,
        lastSeen = excluded.lastSeen
    `
  } else {
    const autoRun = input.autoRun ? 1 : 0
    await prisma.$executeRaw`
      INSERT INTO CliConnection (taskId, repoPath, mode, pid, autoRun, lastSeen)
      VALUES (${input.taskId}, ${input.repoPath ?? ''}, ${input.mode ?? 'daemon'}, ${input.pid ?? null}, ${autoRun}, ${now})
      ON CONFLICT(taskId) DO UPDATE SET
        repoPath = excluded.repoPath,
        mode = excluded.mode,
        pid = excluded.pid,
        autoRun = excluded.autoRun,
        lastSeen = excluded.lastSeen
    `
  }
  const rows = await prisma.$queryRaw<CliRow[]>`
    SELECT taskId, repoPath, mode, pid, autoRun, lastSeen FROM CliConnection WHERE taskId = ${input.taskId}
  `
  return toSession(rows[0])
}

async function setCliAutoRunRaw(taskId: string, autoRun: boolean) {
  const now = new Date().toISOString()
  await prisma.$executeRaw`
    INSERT INTO CliConnection (taskId, repoPath, mode, autoRun, lastSeen)
    VALUES (${taskId}, '', 'daemon', ${autoRun ? 1 : 0}, ${now})
    ON CONFLICT(taskId) DO UPDATE SET autoRun = excluded.autoRun, lastSeen = excluded.lastSeen
  `
  const rows = await prisma.$queryRaw<CliRow[]>`
    SELECT taskId, repoPath, mode, pid, autoRun, lastSeen FROM CliConnection WHERE taskId = ${taskId}
  `
  return rows[0] ? toSession(rows[0]) : { taskId, repoPath: '', mode: 'daemon', autoRun, lastSeen: now }
}

async function getCliSessionRaw(taskId: string): Promise<CliSession | null> {
  const rows = await prisma.$queryRaw<CliRow[]>`
    SELECT taskId, repoPath, mode, pid, autoRun, lastSeen FROM CliConnection WHERE taskId = ${taskId}
  `
  if (!rows[0]) return null
  const session = toSession(rows[0])
  const age = Date.now() - new Date(session.lastSeen).getTime()
  if (age > STALE_MS) {
    await prisma.$executeRaw`DELETE FROM CliConnection WHERE taskId = ${taskId}`
    return null
  }
  return session
}

export async function upsertCliSession(input: {
  taskId: string
  repoPath?: string
  mode?: string
  pid?: number
  autoRun?: boolean
}) {
  try {
    const row = await prisma.cliConnection.upsert({
      where: { taskId: input.taskId },
      create: {
        taskId: input.taskId,
        repoPath: input.repoPath ?? '',
        mode: input.mode ?? 'daemon',
        pid: input.pid,
        autoRun: input.autoRun ?? false,
      },
      update: {
        repoPath: input.repoPath ?? '',
        mode: input.mode ?? 'daemon',
        pid: input.pid,
        autoRun: input.autoRun ?? undefined,
        lastSeen: new Date(),
      },
    })
    return toSession(row)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Unknown argument') || msg.includes('cliConnection')) {
      return upsertCliSessionRaw(input)
    }
    return upsertCliSessionRaw(input)
  }
}

export async function setCliAutoRun(taskId: string, autoRun: boolean) {
  try {
    const row = await prisma.cliConnection.upsert({
      where: { taskId },
      create: { taskId, autoRun },
      update: { autoRun, lastSeen: new Date() },
    })
    return { ok: true as const, autoRun: row.autoRun }
  } catch {
    const session = await setCliAutoRunRaw(taskId, autoRun)
    return { ok: true as const, autoRun: session.autoRun ?? autoRun }
  }
}

export async function disconnectCliSession(taskId: string) {
  try {
    await prisma.cliConnection.delete({ where: { taskId } }).catch(() => {})
  } catch {
    await prisma.$executeRaw`DELETE FROM CliConnection WHERE taskId = ${taskId}`
  }
}

export async function getCliSession(taskId: string): Promise<CliSession | null> {
  try {
    const row = await prisma.cliConnection.findUnique({ where: { taskId } })
    if (!row) return null
    const age = Date.now() - row.lastSeen.getTime()
    if (age > STALE_MS) {
      await prisma.cliConnection.delete({ where: { taskId } }).catch(() => {})
      return null
    }
    return toSession(row)
  } catch {
    return getCliSessionRaw(taskId)
  }
}

type CliRunRequestRow = {
  id: string
  taskId: string
  proposalId: string | null
  prompt: string
  status: string
  error: string | null
  createdAt: Date | string
  startedAt: Date | string | null
  finishedAt: Date | string | null
}

function parseRunRequestRow(row: CliRunRequestRow) {
  return {
    id: row.id,
    taskId: row.taskId,
    proposalId: row.proposalId,
    prompt: row.prompt,
    status: row.status,
    error: row.error,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    startedAt: row.startedAt
      ? row.startedAt instanceof Date
        ? row.startedAt
        : new Date(row.startedAt)
      : null,
    finishedAt: row.finishedAt
      ? row.finishedAt instanceof Date
        ? row.finishedAt
        : new Date(row.finishedAt)
      : null,
  }
}

async function findCliRunRequestRaw(
  taskId: string,
  status: string,
): Promise<ReturnType<typeof parseRunRequestRow> | null> {
  const rows = await prisma.$queryRaw<CliRunRequestRow[]>`
    SELECT id, taskId, proposalId, prompt, status, error, createdAt, startedAt, finishedAt
    FROM CliRunRequest
    WHERE taskId = ${taskId} AND status = ${status}
    ORDER BY createdAt DESC
    LIMIT 1
  `
  return rows[0] ? parseRunRequestRow(rows[0]) : null
}

function cliRunRequestDelegate() {
  return (prisma as typeof prisma & { cliRunRequest?: typeof prisma.cliRunRequest }).cliRunRequest
}

export async function findCliRunRequestByStatus(taskId: string, status: 'pending' | 'running') {
  try {
    const delegate = cliRunRequestDelegate()
    if (delegate) {
      const row = await delegate.findFirst({
        where: { taskId, status },
        orderBy: { createdAt: 'desc' },
      })
      return row
    }
  } catch {
    /* fall through */
  }
  try {
    return await findCliRunRequestRaw(taskId, status)
  } catch {
    return null
  }
}

async function findPendingCliRunRequestRaw(taskId: string) {
  const rows = await prisma.$queryRaw<CliRunRequestRow[]>`
    SELECT id, taskId, proposalId, prompt, status, error, createdAt, startedAt, finishedAt
    FROM CliRunRequest
    WHERE taskId = ${taskId} AND status = 'pending'
    ORDER BY createdAt ASC
    LIMIT 1
  `
  return rows[0] ? parseRunRequestRow(rows[0]) : null
}

export async function findPendingCliRunRequest(taskId: string) {
  try {
    const delegate = cliRunRequestDelegate()
    if (delegate) {
      return await delegate.findFirst({
        where: { taskId, status: 'pending' },
        orderBy: { createdAt: 'asc' },
      })
    }
  } catch {
    /* fall through */
  }
  try {
    return await findPendingCliRunRequestRaw(taskId)
  } catch {
    return null
  }
}

async function findCliRunRequestByIdRaw(id: string) {
  const rows = await prisma.$queryRaw<CliRunRequestRow[]>`
    SELECT id, taskId, proposalId, prompt, status, error, createdAt, startedAt, finishedAt
    FROM CliRunRequest WHERE id = ${id}
  `
  return rows[0] ? parseRunRequestRow(rows[0]) : null
}

export async function findCliRunRequestById(id: string) {
  try {
    const delegate = cliRunRequestDelegate()
    if (delegate) {
      return await delegate.findUnique({ where: { id } })
    }
  } catch {
    /* fall through */
  }
  try {
    return await findCliRunRequestByIdRaw(id)
  } catch {
    return null
  }
}

async function queueCliRunRequestRaw(input: {
  taskId: string
  proposalId?: string
  prompt: string
}) {
  const now = new Date().toISOString()
  await prisma.$executeRaw`
    UPDATE CliRunRequest
    SET status = 'cancelled', finishedAt = ${now}
    WHERE taskId = ${input.taskId} AND status = 'pending'
  `
  const id = randomUUID()
  await prisma.$executeRaw`
    INSERT INTO CliRunRequest (id, taskId, proposalId, prompt, status, createdAt)
    VALUES (${id}, ${input.taskId}, ${input.proposalId ?? null}, ${input.prompt}, 'pending', ${now})
  `
  return (await findCliRunRequestByIdRaw(id))!
}

export async function queueCliRunRequest(input: {
  taskId: string
  proposalId?: string
  prompt: string
}) {
  try {
    const delegate = cliRunRequestDelegate()
    if (delegate) {
      await delegate.updateMany({
        where: { taskId: input.taskId, status: 'pending' },
        data: { status: 'cancelled' },
      })
      return await delegate.create({
        data: {
          taskId: input.taskId,
          proposalId: input.proposalId,
          prompt: input.prompt,
          status: 'pending',
        },
      })
    }
  } catch {
    /* fall through */
  }
  return queueCliRunRequestRaw(input)
}

async function updateCliRunRequestRaw(
  id: string,
  data: {
    status: string
    error?: string
    startedAt: Date | null
    finishedAt: Date | null
  },
) {
  await prisma.$executeRaw`
    UPDATE CliRunRequest
    SET status = ${data.status},
        error = ${data.error ?? null},
        startedAt = ${data.startedAt?.toISOString() ?? null},
        finishedAt = ${data.finishedAt?.toISOString() ?? null}
    WHERE id = ${id}
  `
  return (await findCliRunRequestByIdRaw(id))!
}

export async function updateCliRunRequest(
  id: string,
  data: {
    status: 'running' | 'completed' | 'failed' | 'cancelled'
    error?: string
  },
) {
  const existing = await findCliRunRequestById(id)
  if (!existing) return null

  const patch = {
    status: data.status,
    error: data.error,
    startedAt: data.status === 'running' ? new Date() : existing.startedAt,
    finishedAt: ['completed', 'failed', 'cancelled'].includes(data.status)
      ? new Date()
      : existing.finishedAt,
  }

  try {
    const delegate = cliRunRequestDelegate()
    if (delegate) {
      return await delegate.update({
        where: { id },
        data: patch,
      })
    }
  } catch {
    /* fall through */
  }
  return updateCliRunRequestRaw(id, patch)
}

const STALE_RUN_MS = 15 * 60_000

/** Fail orphaned run requests when CLI is disconnected or run hung. */
export async function reconcileStaleRunRequests(taskId: string, connected: boolean) {
  if (connected) return

  const running = await findCliRunRequestByStatus(taskId, 'running')
  if (running) {
    await updateCliRunRequest(running.id, {
      status: 'failed',
      error: 'CLI disconnected — run cancelled',
    })
    return
  }

  const pending = await findCliRunRequestByStatus(taskId, 'pending')
  if (pending && Date.now() - pending.createdAt.getTime() > STALE_RUN_MS) {
    await updateCliRunRequest(pending.id, {
      status: 'cancelled',
      error: 'CLI disconnected — pending run expired',
    })
  }
}

export async function countPendingDeliveries(taskId: string): Promise<number> {
  try {
    return await prisma.promptProposal.count({
      where: {
        taskId,
        deliveredAt: null,
        status: { in: ['approved', 'dispatched'] },
      },
    })
  } catch {
    try {
      const rows = await prisma.$queryRaw<Array<{ c: number | bigint }>>`
        SELECT COUNT(*) as c FROM PromptProposal
        WHERE taskId = ${taskId}
          AND deliveredAt IS NULL
          AND status IN ('approved', 'dispatched')
      `
      return Number(rows[0]?.c ?? 0)
    } catch {
      return 0
    }
  }
}
