// src/lib/context-collector.ts
// Stack context types + server-side parsing of CLI-collected context

import { z } from 'zod'
import type { StackContext } from '@/types'

const StackContextSchema = z.object({
  frontend: z
    .object({
      framework: z.string().optional(),
      changedFiles: z.array(z.string()).default([]),
      routes: z.array(z.string()).optional(),
    })
    .default({ changedFiles: [] }),
  backend: z
    .object({
      apiRoutes: z.array(z.string()).optional(),
      changedFiles: z.array(z.string()).default([]),
    })
    .default({ changedFiles: [] }),
  database: z
    .object({
      orm: z.string().optional(),
      models: z.array(z.string()).optional(),
      migrationsPending: z.boolean().optional(),
    })
    .default({}),
  tests: z
    .object({
      failed: z.array(z.string()).default([]),
      passed: z.number().default(0),
      failedCount: z.number().default(0),
    })
    .default({ failed: [], passed: 0, failedCount: 0 }),
  git: z
    .object({
      branch: z.string().optional(),
    })
    .optional(),
})

export function parseStackContext(raw: unknown): StackContext | null {
  if (!raw || typeof raw !== 'object') return null
  const result = StackContextSchema.safeParse(raw)
  return result.success ? result.data : null
}

export function stackContextFromJson(json: string | null | undefined): StackContext | null {
  if (!json) return null
  try {
    return parseStackContext(JSON.parse(json))
  } catch {
    return null
  }
}

export function summarizeStackContext(ctx: StackContext | null): string {
  if (!ctx) return 'No stack context'
  const parts: string[] = []
  if (ctx.frontend.framework) parts.push(`FE: ${ctx.frontend.framework}`)
  if (ctx.frontend.changedFiles.length) parts.push(`FE files: ${ctx.frontend.changedFiles.length}`)
  if (ctx.backend.apiRoutes?.length) parts.push(`API routes: ${ctx.backend.apiRoutes.length}`)
  if (ctx.database.orm) parts.push(`DB: ${ctx.database.orm}`)
  if (ctx.tests.failedCount > 0) parts.push(`Tests failed: ${ctx.tests.failedCount}`)
  return parts.length ? parts.join(' · ') : 'Stack scanned'
}
