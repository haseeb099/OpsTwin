# API Specification
# OpsTwin REST API

| Version | 1.0 · 2026-05-27 |
| Base URL | `http://localhost:3000` (dev) |

---

## 1. Conventions

| Item | Value |
|---|---|
| Format | JSON |
| Encoding | UTF-8 |
| Errors | `{ "error": string, "details"?: unknown }` |
| Auth | None (Phase 0 local); API key planned (production) |

---

## 2. Tasks

### GET /api/tasks

List all tasks, optionally filtered by repo.

**Query parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| `repo` | string | No | Filter by repository |

**Response 200:**

```json
{
  "tasks": [
    {
      "id": "clx...",
      "user": "dev",
      "repo": "my-app",
      "branch": "main",
      "originalPrompt": "...",
      "title": "Add webhook",
      "createdAt": "2026-05-27T...",
      "updatedAt": "2026-05-27T...",
      "runs": [ /* latest run summary */ ]
    }
  ]
}
```

---

### POST /api/tasks

Create a new task.

**Request body:**

```json
{
  "user": "dev",
  "repo": "my-app",
  "branch": "main",
  "originalPrompt": "Add Stripe webhook for payment_intent.succeeded...",
  "title": "Add Stripe webhook"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `user` | string | Yes | min 1 |
| `repo` | string | Yes | min 1 |
| `branch` | string | No | default `main` |
| `originalPrompt` | string | Yes | min 10 chars |
| `title` | string | Yes | min 1 |

**Response 201:** `{ "task": Task }`

**Response 400:** Validation error

---

### GET /api/tasks/[id]

Get single task with runs.

**Response 200:** `{ "task": Task }`

**Response 404:** Task not found

---

### PATCH /api/tasks/[id]

Update task fields.

**Response 200:** `{ "task": Task }`

---

### DELETE /api/tasks/[id]

Delete task and related runs.

**Response 200:** `{ "success": true }`

---

## 3. Runs

### GET /api/runs

List runs, optionally filtered by task.

**Query parameters:**

| Param | Type | Required |
|---|---|---|
| `taskId` | string | No |

**Response 200:**

```json
{
  "runs": [
    {
      "id": "clx...",
      "taskId": "clx...",
      "startedAt": "...",
      "finishedAt": "...",
      "status": "complete",
      "confidence": "medium",
      "branch": "ops/add-webhook-20260527-1430",
      "fileEdits": [],
      "inspectedFiles": [],
      "outcomes": [],
      "task": { "title": "...", "repo": "..." }
    }
  ]
}
```

---

### POST /api/runs

Two actions via `action` field.

#### Action: `start`

Start a new run (mark as running).

**Request:**

```json
{
  "action": "start",
  "taskId": "clx...",
  "branch": "ops/my-task-20260527-1430",
  "cursorVersion": "cursor-1.0"
}
```

**Response 201:** `{ "run": CursorRun }`

#### Action: `upload_audit`

Upload agent audit JSON (primary ingestion path).

**Request:**

```json
{
  "action": "upload_audit",
  "taskId": "clx...",
  "runId": "clx...",
  "auditJson": { /* last_run.json content */ }
}
```

| Field | Type | Required |
|---|---|---|
| `action` | `"upload_audit"` | Yes |
| `taskId` | string | Yes |
| `auditJson` | object | Yes |
| `runId` | string | No | Updates existing run if provided |

**Response 200:**

```json
{
  "run": CursorRun,
  "report": AuditReport,
  "focusedRerunPrompt": "FOCUSED RERUN — OpsTwin\n..."
}
```

**Response 400:** Invalid JSON or schema

**Response 404:** Task or run not found

---

### GET /api/runs/[id]

Get run with parsed audit report and rerun prompt.

**Response 200:**

```json
{
  "run": CursorRun,
  "report": AuditReport,
  "focusedRerunPrompt": "..." | null
}
```

**Response 404:** Run not found

---

## 4. Memory

### GET /api/memory

List memory entries.

**Response 200:**

```json
{
  "entries": [
    {
      "id": "clx...",
      "taskType": "add-webhook",
      "patternHash": "abc123",
      "outcomeSummary": "2 files changed, 1 tests failed",
      "improvementSuggestion": "Run tests before accepting...",
      "reuseCount": 3,
      "successRate": 0.67,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

---

### POST /api/memory

Upsert memory entry (typically called internally after audit upload).

---

## 5. Outcomes

### POST /api/outcomes

Record user decision on a run.

**Request:**

```json
{
  "runId": "clx...",
  "action": "accepted",
  "userFeedback": "Looks good",
  "timeToFixMs": 0
}
```

| Field | Type | Values |
|---|---|---|
| `action` | string | `accepted`, `rejected`, `modified`, `rerun` |
| `userFeedback` | string | Optional |
| `timeToFixMs` | number | Optional |

**Response 201:** `{ "outcome": Outcome }`

---

## 6. Planned endpoints (Phase 1)

### POST /api/plans

Generate MVP plan from prompt.

**Request:** `{ "taskId": "...", "prompt": "..." }`

**Response:** `{ "plan": MvpPlan }`

---

### PATCH /api/plans/[id]

Update or approve plan.

**Request:** `{ "status": "approved", "documents": { ... } }`

---

### POST /api/prompts/propose

Generate improved prompt from gaps.

**Request:** `{ "taskId": "...", "runId": "..." }`

**Response:** `{ "proposal": PromptProposal }`

---

### POST /api/prompts/[id]/approve

Approve prompt for dispatch.

**Request:** `{ "userEdits": "optional edited prompt" }`

---

### GET /api/health (Phase 1)

**Response 200:** `{ "status": "ok", "db": "connected" }`

---

## 7. Type definitions

See `src/types/index.ts` for:

- `AuditReport`, `Mismatch`, `MemoryEntry`
- `RunStatus`, `Confidence`, `OutcomeAction`, `Severity`

---

## 8. CLI mapping

| CLI command | API call |
|---|---|
| `upload` | POST `/api/runs` action=`upload_audit` |
| `status` | GET `/api/runs?taskId=` |
| `rerun` | GET `/api/runs/[id]` → print `focusedRerunPrompt` |
| `memory` | GET `/api/memory` |

---

## 9. References

- [TRD.md](./TRD.md)
- [DATA-MODEL.md](./DATA-MODEL.md)
- `.opstwin/rules.md`
