# Memory Layers
# OpsTwin — Memory Architecture Design

| Version | 1.0 · 2026-05-27 |

---

## 1. Overview

OpsTwin uses a **layered memory model** to support the MVP orchestration loop: from ephemeral run data to long-lived project patterns. Each layer has different scope, lifetime, and retrieval purpose.

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: PROJECT MEMORY                                     │
│  Cross-task patterns, acceptance rates, doc templates        │
│  Storage: MemoryEntry table · .ops/memory_summary.json       │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: PATTERN MEMORY                                     │
│  Failure/fix clusters by task type + error category          │
│  Storage: MemoryEntry.patternHash · successRate              │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: RUN MEMORY (Audit)                                 │
│  Single execution: files, tests, decisions, mismatches       │
│  Storage: CursorRun · FileEdit · auditJson blob              │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: SESSION / TASK MEMORY                              │
│  Original prompt, approved plan, prompt approval history     │
│  Storage: Task · Plan · PromptProposal (Phase 1)             │
├─────────────────────────────────────────────────────────────┤
│  Layer 0: EPHEMERAL (Agent context)                          │
│  In-flight agent chat — outside OpsTwin unless audited       │
│  Captured only via last_run.json                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Layer definitions

### Layer 0: Ephemeral (agent session)

| Attribute | Value |
|---|---|
| **Scope** | Single agent chat session |
| **Lifetime** | Until agent session ends |
| **OpsTwin visibility** | Indirect — only what agent writes to audit JSON |
| **Purpose** | Not stored by OpsTwin; audit JSON is the capture point |

**Design note:** OpsTwin does not intercept agent chat in Phase 0–3. All session memory must be distilled into `last_run.json`.

---

### Layer 1: Task memory

| Attribute | Value |
|---|---|
| **Scope** | One MVP task / feature |
| **Lifetime** | Duration of task + archive |
| **Storage** | `Task`, planned `Plan`, `PromptProposal` |
| **Retrieval** | Task detail UI, run history |

**Contents:**

| Data | Source |
|---|---|
| Original MVP prompt | User input |
| Repo, branch, title | User input |
| Approved plan (Phase 1) | Planning engine + user edits |
| Approved prompts (Phase 1) | Prompt proposer + user approval |
| All runs for task | `CursorRun[]` |

**Retrieval triggers:**

- Open task in dashboard
- Generate next prompt for task
- Compare runs within same task

---

### Layer 2: Run memory (audit)

| Attribute | Value |
|---|---|
| **Scope** | Single agent execution |
| **Lifetime** | Permanent (immutable after ingest) |
| **Storage** | `CursorRun`, `FileEdit`, `InspectedFile`, `Expectation`, `Outcome`, `auditJson` |
| **Retrieval** | Run detail, gap analysis, rerun generation |

**Contents:**

| Data | Field |
|---|---|
| Files changed + diffs | `FileEdit`, `files_changed` |
| Files inspected/skipped | `InspectedFile`, audit JSON |
| Tests, TODOs, blockers | audit JSON |
| Decision trace | audit JSON |
| Mismatches (computed) | `AuditReport.mismatches` |
| User outcome | `Outcome` |

**Write path:** Agent → `last_run.json` → CLI → API → parser → DB

**Read path:** GET `/api/runs/[id]` → UI + prompt proposer

---

### Layer 3: Pattern memory

| Attribute | Value |
|---|---|
| **Scope** | Cross-run, same project |
| **Lifetime** | Persistent; updated on each relevant run |
| **Storage** | `MemoryEntry` |
| **Retrieval** | New task hints, prompt proposer, dashboard metrics |

**Pattern key:**

```
patternHash = hash(taskType + primaryFailureType)

taskType     = extractTaskType(originalPrompt)  // e.g. "add-webhook"
failureType  = first mismatch type or "none"
```

**Entry fields:**

| Field | Purpose |
|---|---|
| `outcomeSummary` | Human-readable run summary |
| `improvementSuggestion` | Actionable advice for similar tasks |
| `successRate` | Rolling success (0–1) |
| `reuseCount` | Times pattern was surfaced as hint |

**Matching algorithm (`matchMemoryPattern`):**

1. Extract task type from new prompt
2. Filter memory entries with same or similar task type
3. Rank by `successRate` desc, then `reuseCount` desc
4. Return top N suggestions with `safetyLevel`

**Improvement derivation (current rules):**

| Condition | Suggestion |
|---|---|
| confidence = low | Split task; add file constraints |
| tests fail | Run tests first; focused rerun on failures |
| todos > 3 | Task too broad; break into sub-tasks |
| skipped > changed | Be explicit about target files |
| else | No adjustment needed |

---

### Layer 4: Project memory

| Attribute | Value |
|---|---|
| **Scope** | Entire repository / product |
| **Lifetime** | Long-term |
| **Storage** | `MemoryEntry` aggregate, `.ops/memory_summary.json`, future doc templates |
| **Retrieval** | Dashboard metrics, planning engine context |

**Contents (current + planned):**

| Data | Status |
|---|---|
| Top failure patterns | Partial (dashboard metrics planned) |
| Acceptance rate by task type | Planned |
| Successful fix patterns | Planned (roadmap: auto-apply) |
| Approved doc templates | Phase 1 |
| Agent performance comparison | Future (by `agent` field) |

**File backup:** `.ops/memory_summary.json` — periodic export for repo commit alongside code.

---

## 3. Memory flow diagram

```
                    ┌──────────────┐
                    │  MVP Prompt  │
                    └──────┬───────┘
                           ▼
              ┌────────────────────────┐
              │  L1: Task + Plan       │◀──── L4: Project patterns
              └────────────┬───────────┘
                           ▼
              ┌────────────────────────┐
              │  Agent executes        │
              └────────────┬───────────┘
                           ▼
              ┌────────────────────────┐
              │  L2: Run audit JSON    │
              └────────────┬───────────┘
                           ▼
         ┌─────────────────┴─────────────────┐
         ▼                                   ▼
┌─────────────────┐               ┌─────────────────┐
│ L3: Pattern     │               │ Outcome + Gap   │
│ upsert          │               │ analysis        │
└────────┬────────┘               └────────┬────────┘
         │                                   │
         └──────────────┬────────────────────┘
                        ▼
              ┌────────────────────────┐
              │  L1: Next prompt       │
              │  (proposed → approved) │
              └────────────────────────┘
```

---

## 4. Memory in the orchestration loop

| Step | Layers read | Layers written |
|---|---|---|
| Create task | L3, L4 hints | L1 |
| Approve plan | — | L1 |
| Agent run | L1 (step prompt) | L2 |
| Ingest audit | L1 | L2, L3 |
| User outcome | L2 | L2 (Outcome), L3 (update rate) |
| Propose next prompt | L1, L2, L3, L4 | L1 (PromptProposal) |
| Approve prompt | L1 | L1 |
| Next agent run | L1 | L2 |

---

## 5. Planned schema extensions (Phase 1)

```prisma
model Plan {
  id             String   @id
  taskId         String
  originalPrompt String
  stepsJson      String   // PlanStep[]
  documentsJson  String   // DocumentBundle
  status         String
  version        Int
  approvedAt     DateTime?
}

model PromptProposal {
  id             String   @id
  taskId         String
  runId          String?
  proposedPrompt String
  rationale      String
  status         String   // draft|approved|rejected|dispatched
  userEdits      String?
  approvedAt     DateTime?
}
```

---

## 6. Retention & privacy

| Layer | Retention | Notes |
|---|---|---|
| L0 | Not stored | — |
| L1–L2 | Until user deletes task | Future: delete API |
| L3–L4 | Indefinite | Anonymize prompts if needed |
| auditJson | Full blob kept | May contain code diffs — treat as sensitive |

**Do not store:** API keys, passwords, `.env` contents in memory layers. Audit parser should flag secrets (future).

---

## 7. References

- [DATA-MODEL.md](./DATA-MODEL.md)
- `src/lib/memory-engine.ts`
- `.opstwin/skills.md` — skill: memory-pattern
