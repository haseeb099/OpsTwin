// OpsTwin Core Types

export type Confidence = 'high' | 'medium' | 'low'
export type RunStatus = 'running' | 'complete' | 'failed' | 'partial'
export type OutcomeAction = 'accepted' | 'rejected' | 'modified' | 'rerun'
export type Severity = 'blocker' | 'warning' | 'info'

export interface Task {
  id: string
  user: string
  repo: string
  branch: string
  originalPrompt: string
  title: string
  createdAt: string
  status: RunStatus
  lastRunId?: string
}

export interface CursorRun {
  id: string
  taskId: string
  startedAt: string
  finishedAt?: string
  status: RunStatus
  confidence?: Confidence
  branch: string
  cursorVersion?: string
}

export interface FileEdit {
  id: string
  runId: string
  path: string
  diff: string
  linesAdded: number
  linesRemoved: number
}

export interface InspectedFile {
  id: string
  runId: string
  path: string
  reason: string
  touched: boolean
}

export interface TodoItem {
  file: string
  line: number
  reason: string
  suggestedFix?: string
}

export interface TestResult {
  name: string
  status: 'pass' | 'fail' | 'skipped'
  output?: string
  duration?: number
}

export interface DecisionTrace {
  file: string
  decision: string
}

export interface Expectation {
  id: string
  runId: string
  expectedFiles: string[]
  expectedChanges: string
  expectedTests: string[]
}

export interface Outcome {
  id: string
  runId: string
  action: OutcomeAction
  userFeedback?: string
  timeToFixMs?: number
  acceptedAt?: string
}

export interface MemoryEntry {
  id: string
  taskType: string
  patternHash: string
  outcomeSummary: string
  improvementSuggestion: string
  reuseCount: number
  successRate: number
  createdAt: string
}

export interface AuditReport {
  runId: string
  taskId: string
  timestamp: string
  originalPrompt: string
  branch: string
  confidence: Confidence
  filesChanged: FileEdit[]
  filesInspected: InspectedFile[]
  filesSkipped: { path: string; reason: string }[]
  todosLeft: TodoItem[]
  expectedChanges: string
  testsRun: TestResult[]
  decisionTrace: DecisionTrace[]
  nextSteps: string[]
  blockers: string[]
  mismatches: Mismatch[]
  rulesRead: string[]
  skillsUsed: string[]
}

export interface Mismatch {
  type: 'missing_file' | 'test_failure' | 'lint_error' | 'unexpected_change'
  description: string
  severity: Severity
  suggestedFix?: string
}

export interface DashboardMetrics {
  totalTasks: number
  acceptanceRate: number
  avgTimeToFixMs: number
  topFailurePatterns: { pattern: string; count: number }[]
  recentRuns: { runId: string; taskTitle: string; status: RunStatus; confidence: Confidence }[]
}

// ── MVP Planning (Phase 1) ───────────────────────────────────────────────────

export type PlanStatus = 'draft' | 'approved' | 'in_progress' | 'complete'
export type PlanStepStatus = 'pending' | 'in_progress' | 'complete' | 'failed'
export type PromptStatus = 'draft' | 'approved' | 'rejected' | 'dispatched'

export interface PlanStep {
  order: number
  title: string
  goal: string
  constraints: string[]
  expectedFiles: string[]
  verification: string[]
  status: PlanStepStatus
  agentPrompt: string
}

export interface DocumentBundle {
  prd: string
  trd: string
  useCases: string
  testPlan: string
  architecture: string
}

export interface MvpPlan {
  id: string
  taskId: string
  version: number
  originalPrompt: string
  steps: PlanStep[]
  documents: DocumentBundle
  status: PlanStatus
  approvedAt?: string
  createdAt: string
  updatedAt: string
}

export interface PromptProposal {
  id: string
  taskId: string
  planId?: string
  runId?: string
  planStepOrder?: number
  proposedPrompt: string
  rationale: string
  status: PromptStatus
  userEdits?: string
  approvedAt?: string
  dispatchedAt?: string
  createdAt: string
}

export interface PlanGap {
  stepOrder: number
  stepTitle: string
  type: 'not_started' | 'partial' | 'failed' | 'complete'
  expected: string
  actual: string
  severity: Severity
}
