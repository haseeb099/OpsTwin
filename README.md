# OpsTwin — Cursor Execution Audit System

> Tracks exactly what Cursor did, what it left, why — and learns from every run.

![Next.js 14](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![MIT License](https://img.shields.io/badge/License-MIT-green)

---

## What is OpsTwin?

OpsTwin is a structured audit and memory layer for AI-assisted development with Cursor. Every time Cursor runs a task in your codebase, OpsTwin captures a detailed JSON record of every file changed, every decision made, every TODO left behind, and every test that passed or failed. It then surfaces mismatches between what you expected and what actually happened, generates a focused rerun prompt targeting only the gaps, and clusters patterns across runs so future tasks benefit from everything that has been tried before. The result is a closed feedback loop that makes Cursor progressively safer, faster, and more predictable on your specific project.

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

## Features

- **Structured Audit Log** — Every Cursor run produces a structured JSON record containing: files changed, files skipped, TODOs left in code, the decision trace behind each non-trivial edit, test results, next recommended steps, and an overall confidence score. Nothing Cursor does goes unrecorded.

- **Mismatch Detection** — OpsTwin automatically compares what you expected against what Cursor actually produced and classifies every gap. Hard failures (broken tests, type errors, missing required changes) are promoted to blockers; soft gaps (leftover TODOs, low confidence scores) are filed as warnings — so you always know exactly where to focus.

- **Focused Rerun Prompt** — A one-click copy-to-clipboard button generates a tightly scoped rerun prompt that addresses only the blockers and warnings from the previous run. Cursor gets a precise target instead of re-running the entire task from scratch, cutting wasted cycles dramatically.

- **Pattern Memory** — OpsTwin clusters failures by task type and error category across all runs, tracks fix success rates over time, and surfaces ranked improvement suggestions for future similar tasks. The longer you use it, the smarter its hints become.

- **Dashboard Search & Status Filter** — Find any task or run instantly via full-text search, and filter by status (pending, running, completed, failed) to get a live picture of everything in flight.

- **Memory-Based Hints in New Task Modal** — When you create a new task, OpsTwin looks up past runs with similar goals and injects relevant warnings and proven patterns directly into the task creation form — before Cursor even starts.

- **Auto-Poll for Live Runs** — The run viewer automatically refreshes every 5 seconds while a run is in progress, giving you a live window into what Cursor is doing without any manual page reloads.

- **Rules & Skills Tracking** — Each audit record captures which `.cursor/` configuration files (rules, skills) Cursor actually read during the run, so you can confirm your guidance files are being picked up and audit which rules influenced which decisions.

- **CLI Watcher (`opstwin-cli.js`)** — A zero-dependency Node.js CLI that watches `.ops/runs/` for new JSON files and uploads them to OpsTwin automatically the moment Cursor finishes writing. Zero-touch integration — no manual uploads, no scripts to trigger.

- **One-Command Init (`opstwin-init.js`)** — Copies all required `.cursor/` files, creates the `.ops/runs/` directory, and drops `opstwin-cli.js` into any target repository in a single command. Any repo is OpsTwin-ready in seconds.

---

## Quickstart

```bash
git clone https://github.com/haseeb099/OpsTwin.git
cd OpsTwin
npm install
cp .env.example .env.local
npm run db:push
npm run dev
# Open http://localhost:3000
```

---

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Set these environment variables in the Vercel dashboard:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string (e.g. [Neon](https://neon.tech) free tier) |
| `NEXTAUTH_SECRET` | Random secret for session signing |

For Postgres, change `provider = "sqlite"` to `"postgresql"` in `prisma/schema.prisma`, then run `npm run db:push`.

---

## Cursor Integration

### Step 1: Copy `.cursor/` files to your target repo

```
.cursor/rules.mdc        ← Cursor reads this automatically on every run
.cursor/skills.md        ← Named skill definitions Cursor can reference
.cursor/task-template.md ← Fill this out for each new task
```

Or use the init script to do this in one command (see [Init Script](#init-script) below).

### Step 2: Fill in the task template

Open `.cursor/task-template.md` and fill in the task details before each Cursor session:

```
TASK: add-payment-webhook
GOAL: Add Stripe webhook handler for payment_intent.succeeded
CONSTRAINTS:
  - Do not change: src/lib/stripe.ts
  - Branch: ops/add-payment-webhook-20241201-1430
  - Add tests for: handlePaymentSuccess()
```

### Step 3: Paste into Cursor and run

Paste the filled template as your first message to Cursor. Cursor will read `rules.mdc` and `skills.md` automatically and write `.ops/runs/<run_id>/last_run.json` when it finishes. The CLI watcher (or a manual upload) sends that file to OpsTwin.

---

## CLI Usage

`opstwin-cli.js` is a zero-dependency Node.js tool for integrating OpsTwin into any workflow.

```bash
# Watch .ops/runs/ and auto-upload every new JSON file (recommended)
node opstwin-cli.js watch

# Upload a specific run file manually
node opstwin-cli.js upload .ops/runs/run_20241201_143022/last_run.json <taskId>

# Show the last run status for a task
node opstwin-cli.js status <taskId>

# Print the focused rerun prompt for the last run (pipe into clipboard)
node opstwin-cli.js rerun <taskId>

# Show the top 5 memory entries
node opstwin-cli.js memory

# Show help
node opstwin-cli.js help
```

**Environment variables:**

| Variable | Default | Description |
|---|---|---|
| `OPSTWIN_URL` | `http://localhost:3000` | Base URL of the OpsTwin server |
| `OPSTWIN_TASK_ID` | _(none)_ | Default task ID when not passed as a CLI argument |

**Example (Linux/macOS):**
```bash
export OPSTWIN_URL=https://your-opstwin.vercel.app
export OPSTWIN_TASK_ID=t_abc123
node opstwin-cli.js watch
```

**Example (Windows PowerShell):**
```powershell
$env:OPSTWIN_URL="https://your-opstwin.vercel.app"
$env:OPSTWIN_TASK_ID="t_abc123"
node opstwin-cli.js watch
```

---

## Init Script

`opstwin-init.js` sets up any repository for OpsTwin in a single command — no manual file copying required.

```bash
# Initialize OpsTwin in the current directory
node opstwin-init.js

# Initialize OpsTwin in a specific directory
node opstwin-init.js /path/to/your/repo
```

The script will:
1. Create `.cursor/` and copy `rules.mdc`, `skills.md`, and `task-template.md`
2. Create `.ops/runs/`
3. Copy `opstwin-cli.js` into the target repo
4. Print a step-by-step next-steps guide

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
├── opstwin-cli.js          ← Zero-dependency CLI watcher/uploader
├── opstwin-init.js         ← One-command repo initializer
├── vercel.json
├── package.json
└── .env.example
```

---

## Data Model

| Table | Purpose |
|---|---|
| `tasks` | Original task intent + metadata |
| `cursor_runs` | Each Cursor execution |
| `file_edits` | Per-file diffs |
| `inspected_files` | Files Cursor read but did not change |
| `expectations` | What the user expected Cursor to do |
| `outcomes` | User accepted / rejected / modified |
| `memory_entries` | Learned patterns + fix suggestions |

---

## Roadmap

- [ ] GitHub App integration (auto-create PR from branch)
- [ ] Slack / email notifications on run complete
- [ ] Live streaming of Cursor actions via webhook
- [ ] Acceptance rate heatmap per task type
- [ ] Auto-apply previously successful fix patterns
- [ ] JIRA / Linear ticket linking

---

## Contributing

PRs are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

Every PR must include:
1. The Cursor task template used to generate the code
2. The `.ops/runs/<id>/last_run.json` from that run
3. Tests for any new or modified API routes

---

## Credits

Built by [Haseeb](https://github.com/haseeb099). If you use or build on this project, attribution is required — please link back to this repository.

---

## License

[MIT](./LICENSE) © 2026 Haseeb (haseeb099)
