// src/lib/audit-parser.ts
// Parses .ops/runs/<id>/last_run.json into OpsTwin AuditReport format
// Also computes mismatches between expected and actual outputs

import type { AuditReport, FileEdit, Mismatch, TestResult } from '@/types'

export interface RawRunJson {
  run_id: string
  timestamp: string
  original_prompt: string
  branch: string
  confidence: 'high' | 'medium' | 'low'
  files_changed: { path: string; lines_added: number; lines_removed: number; diff: string }[]
  files_inspected: { path: string; touched: boolean; reason: string }[]
  files_skipped: { path: string; reason: string }[]
  todos_left: { file: string; line: number; reason: string; suggested_fix?: string }[]
  expected_changes: string
  tests_run: { name: string; status: 'pass' | 'fail' | 'skipped'; output?: string }[]
  decision_trace: { file: string; decision: string }[]
  next_steps: string[]
  blockers: string[]
  rules_read?: string[]
  skills_used?: string[]
}

export function parseRunJson(raw: RawRunJson, taskId: string): AuditReport {
  const mismatches = computeMismatches(raw)

  return {
    runId: raw.run_id,
    taskId,
    timestamp: raw.timestamp,
    originalPrompt: raw.original_prompt,
    branch: raw.branch,
    confidence: raw.confidence,
    filesChanged: raw.files_changed.map((f, i) => ({
      id: `fe-${i}`,
      runId: raw.run_id,
      path: f.path,
      diff: f.diff,
      linesAdded: f.lines_added,
      linesRemoved: f.lines_removed,
    })),
    filesInspected: raw.files_inspected.map((f, i) => ({
      id: `if-${i}`,
      runId: raw.run_id,
      path: f.path,
      reason: f.reason,
      touched: f.touched,
    })),
    filesSkipped: raw.files_skipped,
    todosLeft: raw.todos_left.map(t => ({
      file: t.file,
      line: t.line,
      reason: t.reason,
      suggestedFix: t.suggested_fix,
    })),
    expectedChanges: raw.expected_changes,
    testsRun: raw.tests_run,
    decisionTrace: raw.decision_trace,
    nextSteps: raw.next_steps,
    blockers: raw.blockers,
    mismatches,
    rulesRead: raw.rules_read ?? [],
    skillsUsed: raw.skills_used ?? [],
  }
}

function computeMismatches(raw: RawRunJson): Mismatch[] {
  const mismatches: Mismatch[] = []

  // Check for failed tests
  const failedTests = raw.tests_run.filter(t => t.status === 'fail')
  for (const test of failedTests) {
    mismatches.push({
      type: 'test_failure',
      description: `Test "${test.name}" failed`,
      severity: 'blocker',
      suggestedFix: `Re-run focused task: fix ${test.name}`,
    })
  }

  // Check for blockers
  for (const blocker of raw.blockers) {
    mismatches.push({
      type: 'missing_file',
      description: blocker,
      severity: 'blocker',
    })
  }

  // Check confidence
  if (raw.confidence === 'low') {
    mismatches.push({
      type: 'unexpected_change',
      description: 'Cursor reported low confidence — manual review required',
      severity: 'warning',
      suggestedFix: 'Review all diffs carefully before accepting',
    })
  }

  // TODOs are warnings
  for (const todo of raw.todos_left) {
    mismatches.push({
      type: 'missing_file',
      description: `TODO left in ${todo.file}:${todo.line} — ${todo.reason}`,
      severity: 'warning',
      suggestedFix: todo.suggested_fix,
    })
  }

  return mismatches
}

export function computePatternHash(taskType: string, failureType: string): string {
  return Buffer.from(`${taskType}::${failureType}`).toString('base64').slice(0, 12)
}

export function extractTaskType(prompt: string): string {
  const lower = prompt.toLowerCase()
  if (lower.includes('refactor')) return 'refactor'
  if (lower.includes('add') || lower.includes('create')) return 'feature'
  if (lower.includes('fix') || lower.includes('bug')) return 'bugfix'
  if (lower.includes('test')) return 'testing'
  if (lower.includes('migrate')) return 'migration'
  return 'general'
}

export function generateFocusedRerunPrompt(report: AuditReport): string {
  const missed = report.filesSkipped.map(f => f.path).join(', ')
  const failedTests = report.testsRun.filter(t => t.status === 'fail').map(t => t.name).join(', ')
  const todos = report.todosLeft.map(t => `${t.file}:${t.line}`).join(', ')

  return `FOCUSED RERUN from run ${report.runId}

Previous run: ${report.originalPrompt}

ONLY address these gaps:
${missed ? `- Files skipped that need attention: ${missed}` : ''}
${failedTests ? `- Fix failing tests: ${failedTests}` : ''}
${todos ? `- Resolve TODOs at: ${todos}` : ''}
${report.blockers.join('\n- ')}

CONSTRAINT: Only change what's listed above. Do not re-run the full task.
Branch from: ${report.branch}
Confidence required: high`
}
