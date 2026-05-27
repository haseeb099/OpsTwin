# Technical Requirements Document (TRD)
# OpsTwin — AI Agent MVP Orchestration Platform

| Field | Value |
|---|---|
| **Product** | OpsTwin |
| **Version** | 1.0 |
| **Last updated** | 2026-05-27 |
| **Status** | Draft — planning phase |
| **Related** | [PRD.md](./PRD.md), [SYSTEM-ARCHITECTURE.md](./SYSTEM-ARCHITECTURE.md) |

---

## 1. Purpose

This document defines the **technical requirements** for OpsTwin: stack, interfaces, data contracts, integration points, and quality bars. It translates product requirements into implementable specifications.

---

## 2. System Context

```
┌──────────────┐     ┌──────────────┐     ┌─────────────────────┐
│   Developer  │────▶│   OpsTwin    │────▶│  Coding Agent(s)    │
│   (human)    │◀────│   Platform   │◀────│  Cursor/Claude/…    │
└──────────────┘     └──────┬───────┘     └─────────────────────┘
                            │
                     ┌──────▼───────┐
                     │ SQLite / PG  │
                     └──────────────┘
```

OpsTwin sits between the human and any coding agent. It does not replace the agent; it orchestrates, observes, and improves the loop.

---

## 3. Technology Stack

### 3.1 Current (Phase 0)

| Layer | Technology | Version |
|---|---|---|
| Frontend | Next.js (App Router) | 14.x |
| UI | React 18, inline CSS (OpsTwin.tsx) | — |
| Language | TypeScript | 5.x |
| ORM | Prisma | 5.7 |
| Database | SQLite (dev), PostgreSQL (prod) | — |
| Validation | Zod | 3.22 |
| CLI | Node.js (zero-deps) | ≥ 18 |
| Deployment | Vercel, Docker | — |

### 3.2 Planned additions (Phase 1+)

| Component | Candidate technology |
|---|---|
| LLM for plan/doc generation | OpenAI / Anthropic API (configurable) |
| Terminal capture | Extend audit JSON + CLI tail hook |
| UI capture | Playwright (Phase 5) |
| Job queue (async planning) | In-process first; BullMQ/Redis if needed |

---

## 4. Technical Requirements

### 4.1 Audit contract (TR-AUDIT)

**TR-AUDIT-01:** Every agent run MUST produce `.ops/runs/<run_id>/last_run.json`.

**TR-AUDIT-02:** JSON MUST conform to schema in `.opstwin/rules.md`:

| Field | Type | Required |
|---|---|---|
| `run_id` | string (UUID) | Yes |
| `timestamp` | ISO8601 | Yes |
| `original_prompt` | string | Yes |
| `branch` | string | Yes |
| `agent` | enum string | Yes (Phase 0+) |
| `confidence` | `high\|medium\|low` | Yes |
| `files_changed` | array | Yes |
| `files_inspected` | array | Yes |
| `files_skipped` | array | Yes |
| `todos_left` | array | Yes |
| `expected_changes` | string | Yes |
| `tests_run` | array | Yes |
| `decision_trace` | array | Yes |
| `next_steps` | string[] | Yes |
| `blockers` | string[] | Yes |
| `rules_read` | string[] | No |
| `skills_used` | string[] | No |

**TR-AUDIT-03:** OpsTwin API MUST reject malformed JSON with HTTP 400 and descriptive error.

**TR-AUDIT-04:** Parser (`audit-parser.ts`) MUST normalize raw JSON into `AuditReport` including computed `mismatches`.

### 4.2 API requirements (TR-API)

**TR-API-01:** REST JSON API under `/api/*`.

**TR-API-02:** Endpoints (Phase 0):

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/api/tasks` | List / create tasks |
| GET/PATCH/DELETE | `/api/tasks/[id]` | Task CRUD |
| GET/POST | `/api/runs` | List / ingest runs |
| GET | `/api/runs/[id]` | Full audit + rerun prompt |
| GET/POST | `/api/memory` | Memory entries |
| POST | `/api/outcomes` | Record accept/reject |

**TR-API-03:** Planned endpoints (Phase 1+):

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/plans` | Generate MVP plan from prompt |
| GET/PATCH | `/api/plans/[id]` | Read / approve plan |
| POST | `/api/prompts/propose` | Generate next improved prompt |
| POST | `/api/prompts/[id]/approve` | Approve prompt for dispatch |

**TR-API-04:** All responses MUST use consistent error shape: `{ error: string, details?: unknown }`.

### 4.3 Database requirements (TR-DB)

**TR-DB-01:** Prisma schema as source of truth (see [DATA-MODEL.md](./DATA-MODEL.md)).

**TR-DB-02:** `CursorRun.auditJson` stores full raw JSON for replay and future schema migration.

**TR-DB-03:** SQLite for local dev; Postgres for production (`DATABASE_URL`).

**TR-DB-04:** Planned tables (Phase 1):

| Table | Purpose |
|---|---|
| `plans` | MVP decomposition + doc bundle |
| `plan_steps` | Ordered steps with status |
| `prompt_proposals` | Proposed prompts awaiting approval |
| `terminal_logs` | Terminal output per run (Phase 2) |

### 4.4 CLI requirements (TR-CLI)

**TR-CLI-01:** `opstwin-cli.js` MUST have zero npm dependencies.

**TR-CLI-02:** Commands: `watch`, `upload`, `status`, `rerun`, `memory`, `help`.

**TR-CLI-03:** `watch` MUST poll/watch `.ops/runs/` and POST new JSON to `/api/runs`.

**TR-CLI-04:** Env vars: `OPSTWIN_URL` (default `http://localhost:3000`), `OPSTWIN_TASK_ID`.

**TR-CLI-05:** `opstwin-init.js` MUST copy `.opstwin/` and all agent config files.

### 4.5 Mismatch engine (TR-MISMATCH)

**TR-MISMATCH-01:** Mismatch types: `missing_file`, `test_failure`, `lint_error`, `unexpected_change`.

**TR-MISMATCH-02:** Severity: `blocker` (tests fail, typecheck fail, blockers array non-empty), `warning` (TODOs, low confidence, skipped expected files).

**TR-MISMATCH-03:** Focused rerun prompt MUST include only blockers + warnings, not full original task.

### 4.6 Memory engine (TR-MEMORY)

**TR-MEMORY-01:** `buildMemoryEntry()` derives pattern from task type + primary failure type.

**TR-MEMORY-02:** `patternHash` = hash of `(taskType, failureType)` for deduplication.

**TR-MEMORY-03:** `matchMemoryPattern()` returns ranked suggestions for new tasks (see [MEMORY-LAYERS.md](./MEMORY-LAYERS.md)).

### 4.7 Planning engine (TR-PLAN) — Phase 1

**TR-PLAN-01:** Input: MVP prompt string + optional repo context.

**TR-PLAN-02:** Output: ordered steps, each with goal, constraints, expected files, verification.

**TR-PLAN-03:** Output: linked document bundle (PRD draft, TRD draft, use cases, test plan outline).

**TR-PLAN-04:** All generated docs stored as versioned records; user edits create new version.

**TR-PLAN-05:** Plan status: `draft` → `approved` → `in_progress` → `complete`.

### 4.8 Approval workflow (TR-APPROVE) — Phase 1

**TR-APPROVE-01:** No prompt dispatched without status `approved`.

**TR-APPROVE-02:** Audit trail: who approved, timestamp, diff from proposed.

**TR-APPROVE-03:** Rejected proposals retain history; user can edit and resubmit.

### 4.9 Agent integration (TR-AGENT)

**TR-AGENT-01:** Agent-agnostic; no hard dependency on Cursor APIs in Phase 0–3.

**TR-AGENT-02:** Config files per agent (see README Supported Agents table).

**TR-AGENT-03:** Audit field `agent` identifies source for analytics.

---

## 5. Interface Specifications

### 5.1 Audit upload (POST /api/runs)

```typescript
// Request
{
  taskId: string
  auditJson: object | string  // parsed last_run.json
}

// Response
{
  runId: string
  status: RunStatus
  mismatchCount: number
  focusedRerunPrompt?: string
}
```

### 5.2 Focused rerun prompt format

```
FOCUSED RERUN — OpsTwin
Task: <title>
Run: <runId>
Confidence: <level>

BLOCKERS (must fix):
- ...

WARNINGS (should fix):
- ...

DO NOT RE-DO:
- Files already correctly changed: ...

TARGET:
Fix only the items above. Write updated .ops/runs/<new_run_id>/last_run.json when done.
```

---

## 6. Non-Functional Requirements

See [NON-FUNCTIONAL-REQUIREMENTS.md](./NON-FUNCTIONAL-REQUIREMENTS.md).

Summary:

| ID | Requirement |
|---|---|
| NFR-01 | API p95 latency < 500ms (excluding LLM planning) |
| NFR-02 | Dashboard supports 1000 tasks without pagination regression |
| NFR-03 | CLI watcher detects new file within 2s |
| NFR-04 | No secrets in audit JSON or repo commits |

---

## 7. Security Requirements

See [SECURITY.md](./SECURITY.md).

Summary:

| ID | Requirement |
|---|---|
| SEC-01 | No arbitrary file path execution from audit JSON |
| SEC-02 | Sanitize user prompts before LLM calls (Phase 1) |
| SEC-03 | Rate limit public API endpoints in production |
| SEC-04 | Environment secrets via `.env`, never committed |

---

## 8. Testing Requirements

See [TEST-PLAN.md](./TEST-PLAN.md) and [TEST-CASES.md](./TEST-CASES.md).

| ID | Requirement |
|---|---|
| TEST-01 | Unit tests for `audit-parser.ts` mismatch logic |
| TEST-02 | Unit tests for `memory-engine.ts` pattern matching |
| TEST-03 | API integration tests for all `/api/*` routes |
| TEST-04 | CLI smoke test via `test-opstwin.js` |
| TEST-05 | E2E: create task → upload audit → view report → copy rerun |

---

## 9. Deployment Requirements

| Environment | Database | URL |
|---|---|---|
| Local | SQLite (`file:./dev.db`) | `http://localhost:3000` |
| Production | PostgreSQL (Neon) | Vercel deployment URL |

Required env vars: `DATABASE_URL`, `NEXTAUTH_SECRET` (production).

See [DEPLOYMENT-OPERATIONS.md](./DEPLOYMENT-OPERATIONS.md).

---

## 10. Migration & Compatibility

**TR-MIG-01:** Audit JSON schema changes MUST be backward-compatible or versioned (`schema_version` field).

**TR-MIG-02:** `cursor_runs` table name retained for compatibility; UI may display as "Agent Runs".

**TR-MIG-03:** Prisma migrations via `db push` (dev) and migration files (prod).

---

## 11. Open Technical Decisions

| Decision | Options | Recommendation |
|---|---|---|
| LLM provider for planning | OpenAI, Anthropic, local | Configurable via env |
| Auto-dispatch mechanism | MCP, browser ext, agent API | Defer to Phase 4 |
| Terminal capture | CLI hook vs agent writes to JSON | CLI hook + summary in JSON |
| UI review | Playwright vs manual upload | Manual Phase 2; Playwright Phase 5 |

---

## 12. References

- [SYSTEM-ARCHITECTURE.md](./SYSTEM-ARCHITECTURE.md)
- [API-SPECIFICATION.md](./API-SPECIFICATION.md)
- [DATA-MODEL.md](./DATA-MODEL.md)
- [MEMORY-LAYERS.md](./MEMORY-LAYERS.md)
- `.opstwin/rules.md` — audit JSON schema
