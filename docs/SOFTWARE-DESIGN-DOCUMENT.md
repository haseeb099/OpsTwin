# Software Design Document (SDD)
# OpsTwin — Module Design & Interfaces

| Version | 1.0 · 2026-05-27 |
| Related | [SYSTEM-ARCHITECTURE.md](./SYSTEM-ARCHITECTURE.md), [TRD.md](./TRD.md) |

---

## 1. Module map

```
src/
├── app/
│   ├── api/           # HTTP handlers (thin)
│   ├── page.tsx       # Dashboard entry
│   ├── layout.tsx     # Root layout
│   └── upload/        # Manual upload page
├── components/
│   └── OpsTwin.tsx    # Full dashboard UI
├── lib/
│   ├── db.ts          # Prisma client singleton
│   ├── audit-parser.ts
│   └── memory-engine.ts
└── types/
    └── index.ts       # Shared TypeScript types

opstwin-cli.js         # CLI watcher/uploader
opstwin-init.js        # Repo initializer
.opstwin/              # Universal agent rules
```

---

## 2. Core modules

### 2.1 `audit-parser.ts`

**Purpose:** Transform raw agent audit JSON into structured report with mismatches.

**Public functions:**

| Function | Input | Output |
|---|---|---|
| `parseAuditReport(raw, taskId)` | Raw JSON + taskId | `AuditReport` |
| `computeMismatches(raw)` | Raw JSON | `Mismatch[]` |
| `generateFocusedRerunPrompt(report)` | `AuditReport` | `string` |
| `extractTaskType(prompt)` | string | task type slug |
| `computePatternHash(taskType, failureType)` | strings | hash string |

**Mismatch logic:**

```
IF tests_run contains fail → blocker (test_failure)
IF blockers array non-empty → blocker
IF expected file missing from files_changed → blocker (missing_file)
IF lint/typecheck fail → blocker (lint_error)
IF todos_left.length > 0 → warning
IF confidence === 'low' → warning
IF files_skipped includes expected file → warning
```

### 2.2 `memory-engine.ts`

**Purpose:** Learn from runs; suggest improvements for similar tasks.

**Public functions:**

| Function | Input | Output |
|---|---|---|
| `buildMemoryEntry(report)` | `AuditReport` | Memory entry fields |
| `matchMemoryPattern(prompt, memories)` | string + entries | `MemorySuggestion[]` |
| `rankSuggestions(suggestions)` | array | sorted by successRate |

**Design decisions:**

- Pattern keyed by `(taskType, primaryFailureType)` — simple, effective for MVP
- `successRate` = 1 if no blockers, else 0 per run (rolling average over time planned)
- Suggestions include `safetyLevel`: safe | caution | risky

### 2.3 `db.ts`

- Prisma client singleton
- Prevents multiple instances in Next.js hot reload

### 2.4 API handlers (pattern)

Each route handler:

1. Parse request (Zod validation where applicable)
2. Call Prisma / lib functions
3. Return JSON response
4. Catch errors → `{ error: message }` with appropriate status

**Run ingestion flow (`POST /api/runs`):**

```
1. Validate taskId exists
2. Parse auditJson
3. parseAuditReport()
4. Create CursorRun + FileEdit + InspectedFile records
5. Upsert Expectation if present
6. buildMemoryEntry() → upsert MemoryEntry
7. Return runId, mismatches, focusedRerunPrompt
```

### 2.5 `OpsTwin.tsx` (UI)

**State domains:**

| State | Scope |
|---|---|
| `tasks` | Dashboard list |
| `selectedTask` | Task detail + runs |
| `selectedRun` | Audit report |
| `memories` | Memory panel |
| `newTaskModal` | Create form + hints |

**Key user actions:**

| Action | API call |
|---|---|
| Create task | POST `/api/tasks` |
| Load runs | GET `/api/runs?taskId=` |
| Load report | GET `/api/runs/[id]` |
| Accept/reject | POST `/api/outcomes` |
| Copy rerun | GET `/api/runs/[id]` → clipboard |

---

## 3. Planned modules (Phase 1)

### 3.1 `plan-engine.ts`

```typescript
interface PlanStep {
  order: number
  title: string
  goal: string
  constraints: string[]
  expectedFiles: string[]
  verification: string[]
  status: 'pending' | 'in_progress' | 'complete' | 'failed'
}

interface MvpPlan {
  id: string
  taskId: string
  originalPrompt: string
  steps: PlanStep[]
  documents: DocumentBundle
  status: 'draft' | 'approved' | 'in_progress' | 'complete'
}

interface DocumentBundle {
  prd: string
  trd: string
  useCases: string
  testPlan: string
  architecture: string
}
```

### 3.2 `prompt-proposer.ts`

```typescript
interface PromptProposal {
  id: string
  runId: string
  planStepId?: string
  proposedPrompt: string
  rationale: string
  status: 'draft' | 'approved' | 'rejected' | 'dispatched'
  approvedAt?: Date
  userEdits?: string
}

function proposeNextPrompt(input: {
  originalPrompt: string
  approvedPlan?: MvpPlan
  lastReport: AuditReport
  memory: MemoryEntry[]
}): PromptProposal
```

### 3.3 `gap-analyzer.ts`

```typescript
interface PlanGap {
  stepId: string
  type: 'not_started' | 'partial' | 'failed' | 'complete'
  expected: string
  actual: string
  severity: Severity
}

function analyzePlanVsRun(plan: MvpPlan, report: AuditReport): PlanGap[]
```

### 3.4 `approval-store.ts`

- Version documents and prompts
- Record approval events (immutable log)
- Enforce: no dispatch without `approved` status

---

## 4. CLI design (`opstwin-cli.js`)

| Command | Args | Behavior |
|---|---|---|
| `watch` | — | fs.watch `.ops/runs/` recursive |
| `upload` | path, taskId | POST single file |
| `status` | taskId | GET last run summary |
| `rerun` | taskId | Print focused rerun to stdout |
| `memory` | — | GET top 5 memory entries |

**Watch algorithm:**

```
FOR each new last_run.json:
  IF not already uploaded (mtime/hash cache):
    POST /api/runs { taskId, auditJson }
    LOG success/failure
```

---

## 5. Agent contract design

**File:** `.opstwin/rules.md`

Agents MUST:
1. Read rules before task
2. Work on `ops/<task>-<timestamp>` branch
3. Write audit JSON on completion
4. Set `agent` field to tool name
5. Include decision_trace for non-trivial edits

OpsTwin MUST NOT:
- Assume agent API availability (Phase 0–3)
- Execute shell commands from audit JSON
- Trust diff content without sanitization in UI (escape HTML)

---

## 6. Error handling

| Layer | Strategy |
|---|---|
| API | try/catch → JSON error + HTTP status |
| Parser | Validate required fields; default empty arrays |
| CLI | Exit code 1 on failure; stderr message |
| UI | Toast notifications for user-facing errors |

---

## 7. Extension points

| Extension | Hook |
|---|---|
| New mismatch type | Add to `computeMismatches()` + types |
| New agent | Add config file + init copy list |
| New observation signal | Extend audit JSON schema + parser |
| New LLM provider | `plan-engine` adapter interface |
| Auto-dispatch | `dispatch/` module per agent (Phase 4) |

---

## 8. References

- [DATA-MODEL.md](./DATA-MODEL.md)
- [API-SPECIFICATION.md](./API-SPECIFICATION.md)
- [MEMORY-LAYERS.md](./MEMORY-LAYERS.md)
