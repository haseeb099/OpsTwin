# OpsTwin — Cursor Execution Audit System

> Tracks exactly what Cursor did, what it left, why — and learns from every run.

## What is OpsTwin?

OpsTwin is an audit and memory layer for AI-assisted coding with Cursor. It answers:
- **What** did Cursor change, skip, or leave as a TODO?
- **Why** did it make each non-trivial edit?
- **What's next** — in concrete, ranked steps?
- **What worked before** — so you don't repeat failures?

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│                    OPSTWIN UI (Next.js)                │
│  Dashboard | Live Run Viewer | Audit Report | Memory   │
└────────────┬───────────────────────────────────────────┘
             │ REST API
┌────────────▼───────────────────────────────────────────┐
│                  NEXT.JS API ROUTES                    │
│  /api/tasks  /api/runs  /api/memory  /api/outcomes     │
└────────────┬───────────────────────────────────────────┘
             │
┌────────────▼────────────┐  ┌─────────────────────────┐
│   PRISMA + SQLite/PG    │  │  MEMORY ENGINE           │
│   tasks, cursor_runs,   │  │  Pattern clustering      │
│   file_edits,           │  │  Success rate tracking   │
│   inspected_files,      │  │  Fix suggestion ranking  │
│   outcomes, memory      │  └─────────────────────────┘
└─────────────────────────┘
             ▲
             │ audit JSON upload
┌────────────┴───────────────────────────────────────────┐
│                  CURSOR (AI Agent)                     │
│  Reads: .cursor/rules.mdc, .cursor/skills.md           │
│  Writes: .ops/runs/<run_id>/last_run.json              │
└────────────────────────────────────────────────────────┘
```

---

## Quickstart (Local)

```bash
# 1. Clone and install
git clone https://github.com/your-org/opstwin
cd opstwin
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# 3. Set up database
npm run db:push

# 4. Start dev server
npm run dev
# Open http://localhost:3000
```

---

## Deploy to Vercel (5 minutes)

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
vercel

# 3. Set environment variables in Vercel dashboard:
#    DATABASE_URL  (use Neon or PlanetScale for Postgres)
#    GITHUB_TOKEN
#    NEXTAUTH_SECRET
```

For production database, use [Neon](https://neon.tech) (free tier, Postgres):
1. Create a Neon project
2. Copy connection string to `DATABASE_URL`
3. Change `provider = "sqlite"` to `"postgresql"` in `prisma/schema.prisma`
4. Run `npm run db:push`

---

## Cursor Integration

### Step 1: Add files to your target repo
Copy these files to the repo you're working in with Cursor:
```
.cursor/rules.mdc       ← Cursor reads this automatically
.cursor/skills.md       ← Agent skill reference
.cursor/task-template.md ← Fill this for each task
```

### Step 2: Run a task
Use the task template:
```
TASK: add-payment-webhook
GOAL: Add Stripe webhook handler for payment_intent.succeeded
CONSTRAINTS:
  - Do not change: src/lib/stripe.ts
  - Branch: ops/add-payment-webhook-20241201-1430
  - Add tests for: handlePaymentSuccess()
[... fill template ...]
```

### Step 3: Cursor writes audit log
After running, Cursor writes `.ops/runs/<run_id>/last_run.json` automatically (if you paste `rules.mdc` instructions).

### Step 4: Upload to OpsTwin
Drag-and-drop or POST the JSON to OpsTwin:
```bash
curl -X POST http://localhost:3000/api/runs \
  -H "Content-Type: application/json" \
  -d '{
    "action": "upload_audit",
    "runId": "run_20241201_143022",
    "taskId": "t_abc123",
    "auditJson": { ...contents of last_run.json... }
  }'
```

OpsTwin parses mismatches, generates focused rerun prompts, and adds a memory entry.

---

## File Structure

```
opstwin/
├── .cursor/
│   ├── rules.mdc           ← Cursor agent rules (mandatory audit output)
│   ├── skills.md           ← Named skills Cursor uses
│   └── task-template.md    ← Fill for each task
├── .ops/
│   ├── runs/               ← Run artifacts (checked into feature branch)
│   │   └── <run_id>/
│   │       └── last_run.json
│   └── memory_summary.json ← Periodic memory dump
├── prisma/
│   └── schema.prisma       ← Database schema
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── tasks/route.ts
│   │   │   ├── runs/route.ts
│   │   │   └── memory/route.ts
│   │   └── page.tsx        ← Main UI
│   ├── lib/
│   │   ├── audit-parser.ts ← Parses last_run.json → AuditReport
│   │   └── memory-engine.ts ← Pattern clustering + suggestions
│   └── types/index.ts      ← All TypeScript types
├── vercel.json
├── package.json
└── .env.example
```

---

## Data Model

| Table | Purpose |
|-------|---------|
| `tasks` | Original task intent + metadata |
| `cursor_runs` | Each Cursor execution |
| `file_edits` | Per-file diffs |
| `inspected_files` | Files Cursor read but didn't change |
| `expectations` | What the user expected Cursor to do |
| `outcomes` | User accepted/rejected/modified |
| `memory_entries` | Learned patterns + fix suggestions |

---

## Key Features

### ✅ Audit Log
Every Cursor run produces a structured JSON with: files changed, skipped, TODOs left, decision trace, test results, next steps, confidence level.

### ✅ Mismatch Detection
Automatically compares expected vs actual outputs and flags blockers (test failures, typecheck errors) vs warnings (TODOs, low confidence).

### ✅ Focused Rerun
One-click to generate a bounded rerun prompt that only addresses gaps from the previous run — prevents repeating large tasks.

### ✅ Memory & Pattern Learning
Clusters failures by task type + error type. Tracks fix success rate. Suggests safer plans for future similar tasks.

### ✅ Risk Controls
- Always creates a feature branch — never pushes to main
- Requires explicit user approval before accepting changes
- Lint + typecheck gates before marking complete

---

## Roadmap

- [ ] GitHub App integration (auto-create PR from branch)
- [ ] Slack/email notifications on run complete
- [ ] Live streaming of Cursor actions via webhook
- [ ] Acceptance rate heatmap per task type
- [ ] Auto-apply previously successful fix patterns
- [ ] JIRA/Linear ticket linking

---

## Contributing

PRs welcome. Each PR must include:
1. A Cursor task template used to generate the code
2. The `.ops/runs/<id>/last_run.json` from that run
3. Tests for new API routes

---

## License

MIT
