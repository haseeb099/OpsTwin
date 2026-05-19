// src/lib/memory-engine.ts
// Clusters failure patterns, ranks fixes, and suggests safer plans

import type { MemoryEntry, AuditReport } from '@/types'
import { computePatternHash, extractTaskType } from './audit-parser'

export interface MemorySuggestion {
  pattern: string
  previousFix: string
  successRate: number
  suggestedPlan: string[]
  safetyLevel: 'safe' | 'caution' | 'risky'
}

export function buildMemoryEntry(report: AuditReport): Omit<MemoryEntry, 'id' | 'createdAt' | 'updatedAt'> {
  const taskType = extractTaskType(report.originalPrompt)
  const failureType = report.mismatches.length > 0
    ? report.mismatches[0].type
    : 'none'

  const patternHash = computePatternHash(taskType, failureType)

  const outcomeSummary = [
    `${report.filesChanged.length} files changed`,
    `${report.filesSkipped.length} skipped`,
    `${report.testsRun.filter(t => t.status === 'fail').length} tests failed`,
    `confidence: ${report.confidence}`,
  ].join(', ')

  const improvementSuggestion = deriveImprovement(report)

  return {
    taskType,
    patternHash,
    outcomeSummary,
    improvementSuggestion,
    reuseCount: 0,
    successRate: report.mismatches.filter(m => m.severity === 'blocker').length === 0 ? 1 : 0,
  }
}

function deriveImprovement(report: AuditReport): string {
  if (report.confidence === 'low') {
    return 'Split task into smaller scoped runs. Add explicit file constraints.'
  }
  if (report.testsRun.some(t => t.status === 'fail')) {
    return 'Run tests before accepting. Create focused rerun targeting test failures only.'
  }
  if (report.todosLeft.length > 3) {
    return 'Task was too broad. Break into sub-tasks per file or module.'
  }
  if (report.filesSkipped.length > report.filesChanged.length) {
    return 'Cursor skipped more than it changed. Be more explicit about target files.'
  }
  return 'Task completed successfully. No adjustment needed.'
}

export function matchMemoryPattern(
  currentPrompt: string,
  memories: MemoryEntry[]
): MemorySuggestion | null {
  const taskType = extractTaskType(currentPrompt)
  const relevant = memories.filter(m => m.taskType === taskType && m.reuseCount > 0)

  if (relevant.length === 0) return null

  // Sort by success rate descending
  const best = relevant.sort((a, b) => b.successRate - a.successRate)[0]

  return {
    pattern: best.taskType,
    previousFix: best.improvementSuggestion,
    successRate: best.successRate,
    suggestedPlan: deriveSafePlan(best),
    safetyLevel: best.successRate > 0.8 ? 'safe' : best.successRate > 0.5 ? 'caution' : 'risky',
  }
}

function deriveSafePlan(entry: MemoryEntry): string[] {
  const base = [
    `Use task type: ${entry.taskType}`,
    'Create feature branch first',
    'Run lint before accepting',
  ]

  if (entry.successRate < 0.7) {
    base.push('Limit scope to 1-2 files max')
    base.push('Run tests immediately after each file edit')
  }

  base.push(entry.improvementSuggestion)
  return base
}

export async function summarizeMemoryToFile(entries: MemoryEntry[]): Promise<string> {
  const summary = entries.map(e => ({
    pattern: e.taskType,
    patternHash: e.patternHash,
    failure_type: e.outcomeSummary,
    fix_applied: e.improvementSuggestion,
    success_rate: e.successRate,
    reuse: e.reuseCount > 0,
  }))
  return JSON.stringify(summary, null, 2)
}
