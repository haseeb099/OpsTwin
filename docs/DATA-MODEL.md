# Data Model
# OpsTwin — Database Schema & Entities

| Version | 1.0 · 2026-05-27 |
| Source | `prisma/schema.prisma` |

---

## 1. Entity relationship diagram

```
┌──────────┐       1:N        ┌─────────────┐
│   Task   │─────────────────▶│  CursorRun  │
└──────────┘                  └──────┬──────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │ 1:N                │ 1:N                  │ 1:N
              ▼                    ▼                      ▼
        ┌──────────┐        ┌─────────────┐        ┌──────────┐
        │ FileEdit │        │InspectedFile│        │ Outcome  │
        └──────────┘        └─────────────┘        └──────────┘
                                     │
                              1:1    │
                                     ▼
                              ┌─────────────┐
                              │ Expectation │
                              └─────────────┘

┌─────────────┐
│ MemoryEntry │  (standalone — keyed by patternHash)
└─────────────┘
```

**Planned (Phase 1):**

```
Task 1:N Plan 1:N PlanStep
Task 1:N PromptProposal
CursorRun 1:N TerminalLog (Phase 2)
```

---

## 2. Current entities

### Task

| Field | Type | Description |
|---|---|---|
| `id` | cuid | Primary key |
| `user` | string | Owner identifier |
| `repo` | string | Repository path or name |
| `branch` | string | Target branch |
| `originalPrompt` | string | MVP / task prompt |
| `title` | string | Short title |
| `createdAt` | DateTime | Created timestamp |
| `updatedAt` | DateTime | Updated timestamp |

**Relations:** `runs: CursorRun[]`

---

### CursorRun

> Display name in UI: "Agent Run" (agent-agnostic). Table name retained for compatibility.

| Field | Type | Description |
|---|---|---|
| `id` | cuid | Primary key |
| `taskId` | string | FK → Task |
| `startedAt` | DateTime | Run start |
| `finishedAt` | DateTime? | Run end |
| `status` | string | `running\|complete\|failed\|partial` |
| `confidence` | string? | `high\|medium\|low` |
| `branch` | string | Git branch used |
| `cursorVersion` | string? | Agent/version metadata |
| `auditJson` | string? | Full raw `last_run.json` |

**Relations:** `fileEdits`, `inspectedFiles`, `expectations`, `outcomes`

---

### FileEdit

| Field | Type | Description |
|---|---|---|
| `id` | cuid | Primary key |
| `runId` | string | FK → CursorRun |
| `path` | string | File path |
| `diff` | string | Unified diff snippet |
| `linesAdded` | int | Lines added |
| `linesRemoved` | int | Lines removed |

---

### InspectedFile

| Field | Type | Description |
|---|---|---|
| `id` | cuid | Primary key |
| `runId` | string | FK → CursorRun |
| `path` | string | File path |
| `reason` | string | Why not changed |
| `touched` | boolean | Whether file was modified |

---

### Expectation

| Field | Type | Description |
|---|---|---|
| `id` | cuid | Primary key |
| `runId` | string | FK → CursorRun (unique) |
| `expectedFiles` | string | JSON array of paths |
| `expectedChanges` | string | Description |
| `expectedTests` | string | JSON array of test names |

---

### Outcome

| Field | Type | Description |
|---|---|---|
| `id` | cuid | Primary key |
| `runId` | string | FK → CursorRun |
| `action` | string | `accepted\|rejected\|modified\|rerun` |
| `userFeedback` | string? | Optional comment |
| `timeToFixMs` | int? | Time to fix if rejected |
| `acceptedAt` | DateTime | Timestamp |

---

### MemoryEntry

| Field | Type | Description |
|---|---|---|
| `id` | cuid | Primary key |
| `taskType` | string | Extracted task category |
| `patternHash` | string | Unique hash (taskType + failureType) |
| `outcomeSummary` | string | Human-readable summary |
| `improvementSuggestion` | string | Actionable advice |
| `reuseCount` | int | Times used as hint |
| `successRate` | float | 0.0 – 1.0 |
| `createdAt` | DateTime | Created |
| `updatedAt` | DateTime | Updated |

---

## 3. Audit JSON schema (file system)

Stored at: `.ops/runs/<run_id>/last_run.json`

Also persisted in: `CursorRun.auditJson`

See `.opstwin/rules.md` for full field list. Key fields:

| Field | Maps to |
|---|---|
| `files_changed[]` | `FileEdit` rows |
| `files_inspected[]` | `InspectedFile` rows |
| `expected_changes` | `Expectation.expectedChanges` |
| `agent` | Metadata (future: `CursorRun.agent` column) |

---

## 4. Planned entities (Phase 1)

### Plan

| Field | Type | Description |
|---|---|---|
| `id` | cuid | Primary key |
| `taskId` | string | FK → Task |
| `version` | int | Document version |
| `originalPrompt` | string | Input prompt |
| `stepsJson` | string | Ordered PlanStep[] |
| `documentsJson` | string | PRD, TRD, etc. |
| `status` | string | Plan lifecycle status |
| `approvedAt` | DateTime? | Approval timestamp |
| `approvedBy` | string? | User identifier |

### PromptProposal

| Field | Type | Description |
|---|---|---|
| `id` | cuid | Primary key |
| `taskId` | string | FK → Task |
| `runId` | string? | Triggering run |
| `planStepId` | string? | Related plan step |
| `proposedPrompt` | string | Generated prompt |
| `rationale` | string | Why this prompt |
| `status` | string | Approval status |
| `userEdits` | string? | User modifications |
| `approvedAt` | DateTime? | Approval time |

### TerminalLog (Phase 2)

| Field | Type | Description |
|---|---|---|
| `id` | cuid | Primary key |
| `runId` | string | FK → CursorRun |
| `command` | string | Command run |
| `exitCode` | int | Exit code |
| `stdout` | string | Truncated stdout |
| `stderr` | string | Truncated stderr |
| `capturedAt` | DateTime | Timestamp |

---

## 5. Indexes (recommended for production)

| Table | Index | Purpose |
|---|---|---|
| `CursorRun` | `taskId` | List runs by task |
| `CursorRun` | `status` | Filter running tasks |
| `MemoryEntry` | `patternHash` | Unique lookup (exists) |
| `MemoryEntry` | `taskType` | Pattern matching |
| `Outcome` | `runId` | Outcome by run |

---

## 6. Data lifecycle

| Event | Action |
|---|---|
| Task created | Insert Task |
| Audit uploaded | Insert CursorRun + children; upsert MemoryEntry |
| Outcome recorded | Insert Outcome; update MemoryEntry successRate |
| Plan approved (Phase 1) | Insert/update Plan |
| Prompt approved (Phase 1) | Insert PromptProposal with status |

**Deletion:** Not implemented in MVP. Future: cascade delete task → runs → edits.

---

## 7. Migration notes

| Change | Approach |
|---|---|
| SQLite → Postgres | Change `provider` in schema; `db push` or migrate |
| Add `agent` column to CursorRun | Optional migration; currently in auditJson |
| Add Plan tables | New Prisma models; seed optional |

---

## 8. References

- [MEMORY-LAYERS.md](./MEMORY-LAYERS.md)
- [API-SPECIFICATION.md](./API-SPECIFICATION.md)
- `prisma/schema.prisma`
