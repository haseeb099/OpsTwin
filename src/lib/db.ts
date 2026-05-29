// src/lib/db.ts
// Singleton Prisma client — prevents exhausting the connection pool during
// Next.js dev hot-reload, where every reload would otherwise spawn a new client.

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

/** Dev hot-reload keeps a stale singleton when schema adds new models. */
function healStaleDevClient(existing: PrismaClient | undefined): PrismaClient {
  if (process.env.NODE_ENV === 'production' || !existing) return existing ?? createPrismaClient()
  const delegate = (existing as PrismaClient & { cliRunRequest?: unknown }).cliRunRequest
  if (delegate) return existing
  console.warn('[db] Stale Prisma client (missing cliRunRequest) — recreating after schema change')
  void existing.$disconnect().catch(() => {})
  return createPrismaClient()
}

export const prisma = healStaleDevClient(globalForPrisma.prisma)

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
