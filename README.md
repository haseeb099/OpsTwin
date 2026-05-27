# OpsTwin — AI Agent Execution Audit System

> Tracks exactly what your coding agent did, what it left, why — and learns from every run.

**Works with any coding agent:** Cursor, Claude Code, Gemini, GitHub Copilot, OpenAI Codex, Windsurf, Cline, Gravity, Continue, and any tool that can edit files and follow project instructions.

![Next.js 14](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![MIT License](https://img.shields.io/badge/License-MIT-green)

---

## What is OpsTwin?

OpsTwin is a structured audit and memory layer for AI-assisted development. It is **agent-agnostic** — the same workflow works whether you use Cursor, Claude, Gemini, Copilot, Codex, or any other coding agent.

Every time an agent runs a task in your codebase, OpsTwin captures a detailed JSON record of every file changed, every decision made, every TODO left behind, and every test that passed or failed. It then surfaces mismatches between what you expected and what actually happened, generates a focused rerun prompt targeting only the gaps, and clusters patterns across runs so future tasks benefit from everything that has been tried before. The result is a closed feedback loop that makes AI-assisted coding progressively safer, faster, and more predictable on your specific project.

---

## Supported Coding Agents

OpsTwin uses a single audit contract (`.ops/runs/<run_id>/last_run.json`). Any agent that writes that file is supported.

| Agent | Config loaded automatically | Setup guide |
|---|---|---|
| **Cursor** | `.cursor/rules.mdc`, `.cursor/skills.md` | [`.opstwin/agents/cursor.md`](.opstwin/agents/cursor.md) |
| **Claude Code** | `CLAUDE.md`, `.opstwin/` | [`.opstwin/agents/claude.md`](.opstwin/agents/claude.md) |
| **Gemini** | `GEMINI.md`, `.opstwin/` | [`.opstwin/agents/gemini.md`](.opstwin/agents/gemini.md) |
| **GitHub Copilot** | `.github/copilot-instructions.md` | [`.opstwin/agents/copilot-codex.md`](.opstwin/agents/copilot-codex.md) |
| **OpenAI Codex** | `.github/copilot-instructions.md`, `AGENTS.md` | [`.opstwin/agents/copilot-codex.md`](.opstwin/agents/copilot-codex.md) |
| **Windsurf** | `.windsurfrules`, `.opstwin/` | [`.opstwin/agents/windsurf.md`](.opstwin/agents/windsurf.md) |
| **Cline** | `.clinerules`, `.opstwin/` | [`.opstwin/agents/cline.md`](.opstwin/agents/cline.md) |
| **Gravity** | `GRAVITY.md`, `.opstwin/` | [`.opstwin/agents/gravity.md`](.opstwin/agents/gravity.md) |
| **Any other agent** | `AGENTS.md`, `.opstwin/rules.md` | Paste `.opstwin/task-template.md` as your prompt |

Run `node opstwin-init.js` in any repo to copy all agent config files in one command.

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
│              ANY CODING AGENT                          │
│  Cursor · Claude · Gemini · Copilot · Codex · …      │
│  Reads: .opstwin/rules.md + agent-specific config    │
│  Writes: .ops/runs/<run_id>/last_run.json              │
└────────────────────────────────────────────────────────┘
```

---

## Features

- **Agent-agnostic audit log** — Every agent run produces the same structured JSON: files changed, files skipped, TODOs left in code, decision trace, test results, next steps, confidence score, and which agent ran it. Nothing goes unrecorded.

- **Mismatch detection** — OpsTwin automatically compares what you expected against what the agent actually produced and classifies every gap. Hard failures (broken tests, type errors, missing required changes) are promoted to blockers; soft gaps (leftover TODOs, low confidence scores) are filed as warnings.

- **Focused rerun prompt** — A one-click copy-to-clipboard button generates a tightly scoped rerun prompt that addresses only the blockers and warnings from the previous run. The agent gets a precise target instead of re-running the entire task from scratch.

- **Pattern memory** — OpsTwin clusters failures by task type and error category across all runs, tracks fix success rates over time, and surfaces ranked improvement suggestions for future similar tasks.

- **Dashboard search & status filter** — Find any task or run instantly via full-text search, and filter by status (pending, running, completed, failed).

- **Memory-based hints in new task modal** — When you create a new task, OpsTwin looks up past runs with similar goals and injects relevant warnings and proven patterns — before the agent even starts.

- **Auto-poll for live runs** — The run viewer automatically refreshes every 5 seconds while a run is in progress.

- **Rules & skills tracking** — Each audit record captures which configuration files the agent read during the run, so you can confirm your guidance is being picked up.

- **CLI watcher (`opstwin-cli.js`)** — A zero-dependency Node.js CLI that watches `.ops/runs/` and uploads new JSON files automatically the moment any agent finishes writing.

- **One-command init (`opstwin-init.js`)** — Copies universal `.opstwin/` rules plus agent-specific config for Cursor, Claude, Gemini, Copilot, Codex, Windsurf, Cline, Gravity, and more.

---

## Documentation

Full software engineering docs for the MVP are in [`docs/`](./docs/README.md):

- **[Quick Start](./docs/QUICKSTART.md)** ← read this first
- [PRD](./docs/PRD.md) · [TRD](./docs/TRD.md) · [Use Cases](./docs/USE-CASES.md)
- [System Architecture](./docs/SYSTEM-ARCHITECTURE.md) · [Memory Layers](./docs/MEMORY-LAYERS.md)
- [Security](./docs/SECURITY.md) · [Test Plan](./docs/TEST-PLAN.md) · [MVP Roadmap](./docs/MVP-ROADMAP.md)

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

## Agent Integration

### Step 1: Initialize your target repo

```bash
node opstwin-init.js /path/to/your/repo
```

This copies:

```
.opstwin/                  ← Universal rules (all agents)
  rules.md                 ← Mandatory audit JSON schema
  skills.md                ← Named skills
  task-template.md         ← Fill for each task
  agents/                  ← Per-agent setup guides

AGENTS.md                  ← Universal agent instructions
CLAUDE.md                  ← Claude Code
GEMINI.md                  ← Gemini
GRAVITY.md                 ← Gravity
.github/copilot-instructions.md  ← Copilot / Codex
.windsurfrules             ← Windsurf
.clinerules                ← Cline
.cursor/                   ← Cursor (rules.mdc, skills.md, task-template.md)
.ops/runs/                 ← Audit output directory
opstwin-cli.js             ← Auto-upload watcher
```

### Step 2: Fill in the task template

Open `.opstwin/task-template.md` and fill in the task details before each agent session:

```
TASK: add-payment-webhook
GOAL: Add Stripe webhook handler for payment_intent.succeeded
CONSTRAINTS:
  - Do not change: src/lib/stripe.ts
  - Branch: ops/add-payment-webhook-20241201-1430
  - Add tests for: handlePaymentSuccess()
CONTEXT:
  - Agent: claude
```

### Step 3: Run your agent

Paste the filled template as your first message. Your agent reads its config automatically and writes `.ops/runs/<run_id>/last_run.json` when it finishes. The CLI watcher (or a manual upload) sends that file to OpsTwin.

**Examples by agent:**

| Agent | What to do |
|---|---|
| **Cursor** | Paste template → Cursor reads `.cursor/rules.mdc` |
| **Claude Code** | Paste template → Claude reads `CLAUDE.md` |
| **Gemini** | Paste template + include `.opstwin/rules.md` in context |
| **Copilot / Codex** | Paste template in Copilot Chat or Workspace |
| **Windsurf / Cline / Gravity** | Paste template → agent reads its rules file |
| **Other** | Paste template + attach `AGENTS.md` |

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

`opstwin-init.js` sets up any repository for OpsTwin in a single command.

```bash
# Initialize OpsTwin in the current directory
node opstwin-init.js

# Initialize OpsTwin in a specific directory
node opstwin-init.js /path/to/your/repo
```

The script will:
1. Copy `.opstwin/` universal rules and per-agent setup guides
2. Copy agent-specific config (Cursor, Claude, Gemini, Copilot, Codex, Windsurf, Cline, Gravity)
3. Create `.ops/runs/`
4. Copy `opstwin-cli.js` into the target repo
5. Print a step-by-step next-steps guide

---

## File Structure

```
opstwin/
├── .opstwin/
│   ├── rules.md            ← Universal audit rules (all agents)
│   ├── skills.md           ← Named skills
│   ├── task-template.md    ← Fill for each task
│   └── agents/             ← Per-agent setup guides
├── .cursor/                ← Cursor-specific config
├── AGENTS.md               ← Universal agent instructions
├── CLAUDE.md               ← Claude Code
├── GEMINI.md               ← Gemini
├── GRAVITY.md              ← Gravity
├── .github/
│   └── copilot-instructions.md  ← Copilot / Codex
├── .windsurfrules          ← Windsurf
├── .clinerules             ← Cline
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
| `cursor_runs` | Each agent execution (any coding agent) |
| `file_edits` | Per-file diffs |
| `inspected_files` | Files the agent read but did not change |
| `expectations` | What the user expected the agent to do |
| `outcomes` | User accepted / rejected / modified |
| `memory_entries` | Learned patterns + fix suggestions |

---

## Roadmap

- [ ] GitHub App integration (auto-create PR from branch)
- [ ] Slack / email notifications on run complete
- [ ] Live streaming of agent actions via webhook
- [ ] Acceptance rate heatmap per task type
- [ ] Auto-apply previously successful fix patterns
- [ ] JIRA / Linear ticket linking
- [ ] Agent filter on dashboard (Cursor vs Claude vs Gemini, etc.)

---

## Contributing

PRs are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

Every PR must include:
1. The task template used to generate the code (from any coding agent)
2. The `.ops/runs/<id>/last_run.json` from that run
3. Tests for any new or modified API routes

---

## Credits

Built by [Haseeb](https://github.com/haseeb099). If you use or build on this project, attribution is required — please link back to this repository.

---

## License

[MIT](./LICENSE) © 2026 Haseeb (haseeb099)
