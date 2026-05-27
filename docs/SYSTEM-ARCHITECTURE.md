# System Architecture
# OpsTwin — AI Agent MVP Orchestration Platform

| Version | 1.0 · 2026-05-27 |

---

## 1. Architecture overview

OpsTwin is a **three-tier system** with an external coding agent and CLI bridge:

```
                         ┌─────────────────────────────────┐
                         │         DEVELOPER (Human)        │
                         │  Approve plans · Approve prompts │
                         └───────────────┬─────────────────┘
                                         │
                    ┌────────────────────▼────────────────────┐
                    │           OPSTWIN PLATFORM               │
                    │  ┌─────────────┐  ┌──────────────────┐  │
                    │  │  Web UI     │  │  Planning Engine │  │
                    │  │  (Next.js)  │  │  (Phase 1)       │  │
                    │  └──────┬──────┘  └────────┬─────────┘  │
                    │         │                   │            │
                    │  ┌──────▼───────────────────▼─────────┐  │
                    │  │         API Layer (/api/*)          │  │
                    │  └──────┬───────────────────┬─────────┘  │
                    │         │                   │            │
                    │  ┌──────▼──────┐  ┌─────────▼────────┐  │
                    │  │ Audit Parser│  │  Memory Engine   │  │
                    │  │ Mismatch    │  │  Pattern Match   │  │
                    │  └──────┬──────┘  └─────────┬────────┘  │
                    │         │                   │            │
                    │  ┌──────▼───────────────────▼─────────┐  │
                    │  │     Prisma ORM · SQLite / Postgres   │  │
                    │  └──────────────────────────────────────┘  │
                    └────────────────────┬────────────────────┘
                                         │ REST
                    ┌────────────────────▼────────────────────┐
                    │         opstwin-cli.js (Watcher)         │
                    │  watch · upload · status · rerun         │
                    └────────────────────┬────────────────────┘
                                         │ reads/writes
                    ┌────────────────────▼────────────────────┐
                    │           TARGET REPOSITORY              │
                    │  .opstwin/ · .ops/runs/ · source code   │
                    └────────────────────┬────────────────────┘
                                         │
                    ┌────────────────────▼────────────────────┐
                    │         CODING AGENT (External)          │
                    │  Cursor · Claude · Gemini · Codex · …  │
                    └─────────────────────────────────────────┘
```

---

## 2. Component descriptions

### 2.1 Web UI (`src/components/OpsTwin.tsx`)

| Responsibility | Details |
|---|---|
| Dashboard | Task list, search, status filter, metrics |
| Run viewer | Audit report, mismatches, live poll |
| Task modal | Create task, memory hints |
| Actions | Accept/reject, copy rerun prompt |

**Tech:** React client component, fetch to `/api/*`, inline CSS design tokens.

### 2.2 API layer (`src/app/api/`)

| Route | Module | Responsibility |
|---|---|---|
| `/api/tasks` | `tasks/route.ts` | Task CRUD |
| `/api/tasks/[id]` | `tasks/[id]/route.ts` | Single task |
| `/api/runs` | `runs/route.ts` | Ingest + list runs |
| `/api/runs/[id]` | `runs/[id]/route.ts` | Audit report + rerun |
| `/api/memory` | `memory/route.ts` | Pattern entries |
| `/api/outcomes` | `outcomes/route.ts` | Accept/reject |

**Planned (Phase 1):** `/api/plans`, `/api/prompts/*`

### 2.3 Audit parser (`src/lib/audit-parser.ts`)

- Parses raw `last_run.json` → `AuditReport`
- Computes mismatches (expected vs actual)
- Extracts task type for memory
- Generates focused rerun prompt

### 2.4 Memory engine (`src/lib/memory-engine.ts`)

- Builds memory entries from audit reports
- Pattern hash deduplication
- Matches patterns for new task hints
- Ranks fix suggestions by success rate

### 2.5 Planning engine (Phase 1 — planned)

```
MVP Prompt → LLM → Step Plan + Doc Bundle → User Approval → Step Prompts
```

Components:
- **Plan generator** — decomposes prompt into steps
- **Doc generator** — PRD, TRD, use cases, test plan drafts
- **Prompt proposer** — next improved prompt from gaps
- **Approval store** — versioned plans and prompts

### 2.6 CLI bridge (`opstwin-cli.js`)

- Zero-dependency Node.js
- Watches `.ops/runs/` for new JSON
- POSTs to `/api/runs`
- Commands: status, rerun, memory

### 2.7 Agent config (`.opstwin/` + agent files)

- Universal rules in `.opstwin/rules.md`
- Per-agent wrappers (Cursor, Claude, Gemini, etc.)
- Enforces audit JSON contract

---

## 3. Data flows

### 3.1 Happy path (Phase 0)

```
1. Developer creates task (UI)
2. Developer runs agent with task template
3. Agent writes .ops/runs/<id>/last_run.json
4. CLI watcher POSTs to /api/runs
5. audit-parser computes mismatches
6. memory-engine updates patterns
7. Developer views report, copies rerun or accepts
```

### 3.2 Planned loop (Phase 1+)

```
1. Developer submits MVP prompt
2. Planning engine → steps + docs
3. Developer approves plan
4. For each step:
   a. Export agent prompt
   b. Agent runs → audit ingested
   c. Gap analyzer compares plan step vs result
   d. Prompt proposer → improved prompt
   e. Developer approves → next iteration
5. All steps complete → MVP done
```

### 3.3 Observation signals (current + planned)

| Signal | Source | Phase |
|---|---|---|
| Code changes | `files_changed` in audit JSON | 0 |
| Skipped files | `files_skipped` | 0 |
| Tests | `tests_run` | 0 |
| TODOs | `todos_left` | 0 |
| Decisions | `decision_trace` | 0 |
| Terminal | `terminal_output` (planned) | 2 |
| UI | Screenshots (planned) | 5 |
| User outcome | `/api/outcomes` | 0 |

---

## 4. Deployment architecture

### 4.1 Local development

```
Developer machine
├── OpsTwin (npm run dev :3000)
├── SQLite (prisma/dev.db)
├── Target repo + opstwin-cli.js watch
└── Coding agent IDE
```

### 4.2 Production (Vercel)

```
Vercel Edge/Node
├── Next.js app
├── Postgres (Neon)
└── Env: DATABASE_URL, NEXTAUTH_SECRET

Developer machine
├── Target repo + CLI → OPSTWIN_URL=https://...
└── Coding agent
```

### 4.3 Docker (optional)

```
docker-compose.yml
├── opstwin service (Dockerfile)
└── volume: /data for SQLite or external Postgres
```

---

## 5. Integration boundaries

| Boundary | Protocol | Owner |
|---|---|---|
| UI ↔ API | REST JSON | OpsTwin |
| CLI ↔ API | REST JSON | OpsTwin |
| Agent ↔ Repo | File writes | External agent |
| Agent ↔ OpsTwin | Audit JSON only (Phase 0–3) | Contract in `.opstwin/rules.md` |
| Planning ↔ LLM | HTTPS API (Phase 1) | OpsTwin + provider |

**Principle:** OpsTwin never executes agent code. It observes file outputs and API uploads.

---

## 6. Scalability considerations

| Concern | Current | Future |
|---|---|---|
| Tasks/runs | Single SQLite DB | Postgres + indexes on taskId, status |
| Audit JSON size | Stored as text blob | Compress or S3 for large diffs |
| LLM planning | N/A | Queue async jobs; poll status |
| Multi-user | Single user string on task | Auth + tenant isolation |

---

## 7. Failure modes

| Failure | Detection | Recovery |
|---|---|---|
| Agent skips audit JSON | No upload; run stuck `running` | Manual upload; blocker in agent rules |
| Invalid JSON | API 400 | Fix JSON; re-upload |
| CLI watcher down | No auto-upload | Manual `upload` command |
| DB unavailable | API 500 | Retry; local queue in CLI (future) |
| LLM planning timeout | Phase 1 | Retry; fallback to manual plan |

---

## 8. References

- [SOFTWARE-DESIGN-DOCUMENT.md](./SOFTWARE-DESIGN-DOCUMENT.md)
- [MEMORY-LAYERS.md](./MEMORY-LAYERS.md)
- [DATA-MODEL.md](./DATA-MODEL.md)
- [API-SPECIFICATION.md](./API-SPECIFICATION.md)
