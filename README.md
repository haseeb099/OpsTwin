# OpsTwin — Agent Orchestration Platform

> Install in your repo. Any coding agent writes audits. OpsTwin plans your MVP, watches every run, finds gaps, and delivers better prompts.

**Repository:** [github.com/haseeb099/OpsTwin](https://github.com/haseeb099/OpsTwin)

**Works with any coding agent:** Cursor, Claude Code, Gemini, GitHub Copilot, OpenAI Codex, Windsurf, Cline, Gravity, Continue, and any tool that can edit files and follow project instructions.

![Next.js 14](https://img.shields.io/badge/Next.js-14-black?logo=next.js&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![MIT License](https://img.shields.io/badge/License-MIT-green)

---

## What is OpsTwin?

OpsTwin is an **agent-agnostic orchestration layer** for AI-assisted development. You describe an MVP once; OpsTwin breaks it into steps, generates docs (PRD, TRD, architecture), sends focused prompts to your agent, audits what actually happened, and proposes improved prompts until the job is done.

```
YOU → idea     GROQ → plan     YOU → approve     AGENT → code
  → OPSTWIN → audit     GROQ → better prompt     → repeat
```

Every agent run produces a structured audit JSON: files changed, files skipped, tests, terminal output, decision trace, and confidence score. OpsTwin compares **plan vs reality**, surfaces blockers and warnings, and generates a **focused rerun prompt** that targets only the gaps.

---

## The loop (6 steps)

| Step | Who | What |
|------|-----|------|
| 1 | You | Create a task (+ button) with your MVP idea |
| 2 | OpsTwin + Groq | **Generate MVP Plan** — steps, PRD, TRD, tests, architecture |
| 3 | You | Review docs, **Approve Plan** |
| 4 | Agent | Copy step prompt or **Dispatch to Agent** → Cursor/Claude builds |
| 5 | OpsTwin | **Audit** tab — files, terminal, screenshots, test results |
| 6 | OpsTwin + Groq | **Propose Next Prompt** → approve → paste into agent again |

Use the **? Guide** sidebar item for the full walkthrough with CLI setup hints.

---

## Quickstart

### 1. Clone and run OpsTwin

```bash
git clone https://github.com/haseeb099/OpsTwin.git
cd OpsTwin
npm install
cp .env.example .env.local
npm run db:push
npm run dev:fresh
```

Open **http://localhost:3000**

### 2. Configure environment (`.env.local`)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | `file:./dev.db` for local SQLite |
| `GROQ_API_KEY` | Groq API key for AI planning (optional; falls back to rules) |
| `GROQ_MODEL` | e.g. `llama-3.3-70b-versatile` |
| `LLM_PROVIDER` | `groq` or `openai` |
| `OPSTWIN_AUTO_PROPOSE` | Auto-create draft proposal on audit upload |
| `OPSTWIN_LLM_PROPOSE` | Use LLM for propose when key set (default `true`) |
| `OPSTWIN_ADMIN_PASSWORD` | Required when auth is enabled |

### 3. Connect your code project

From the OpsTwin folder, initialize any target repo:

```bash
node opstwin-init.js /path/to/your/project
```

This copies `.opstwin/`, agent configs, `.ops/runs/`, and `opstwin-cli.js` into your project.

### 4. Copy your task ID

Create a task with the **+** button, then copy the UUID from any of these places:

| Location | How |
|----------|-----|
| **Success modal** | Shown right after **Start Task** — click **Copy** |
| **Task cards** | Each card on the dashboard lists a compact ID + **Copy** |
| **Task detail** | Open a task — ID appears under the title on Plan / Audit tabs |
| **Search** | Paste a full or partial UUID to filter tasks |
| **Browser URL** | `http://localhost:3000/?task=<uuid>` when a task is selected |
| **Upload page** | Task dropdown shows IDs; selected task has **Copy** |

You only need the task ID once to configure the CLI watcher below.

### 5. Start the watcher (in your project folder)

**Windows PowerShell:**

```powershell
cd D:\path\to\your\project
$env:OPSTWIN_URL="http://localhost:3000"
$env:OPSTWIN_TASK_ID="your-task-id-from-dashboard"
node opstwin-cli.js watch
```

**Linux/macOS:**

```bash
export OPSTWIN_URL=http://localhost:3000
export OPSTWIN_TASK_ID=your-task-id-from-dashboard
node opstwin-cli.js watch
```

Leave this running. When your agent writes `.ops/runs/<id>/last_run.json`, OpsTwin updates automatically.

**Alternative — pass task ID per command (no env var):**

```powershell
node opstwin-cli.js watch <task-id>
node opstwin-cli.js upload .ops/runs/<run_id>/last_run.json <task-id>
```

### 6. Test that everything works

With the dev server running:

```bash
node test-opstwin.js
```

Expected: **21/21 tests passed**

See **[docs/FUTURE-VISION.md](./docs/FUTURE-VISION.md)** for the full auto-watch vision and **[docs/QUICKSTART.md](./docs/QUICKSTART.md)** for a 5-minute first run.

---

## Supported coding agents

OpsTwin uses one audit contract: `.ops/runs/<run_id>/last_run.json`. Any agent that writes that file is supported.

| Agent | Config loaded automatically | Setup guide |
|-------|----------------------------|-------------|
| **Cursor** | `.cursor/rules.mdc`, `.cursor/skills.md` | [`.opstwin/agents/cursor.md`](.opstwin/agents/cursor.md) |
| **Claude Code** | `CLAUDE.md`, `.opstwin/` | [`.opstwin/agents/claude.md`](.opstwin/agents/claude.md) |
| **Gemini** | `GEMINI.md`, `.opstwin/` | [`.opstwin/agents/gemini.md`](.opstwin/agents/gemini.md) |
| **GitHub Copilot** | `.github/copilot-instructions.md` | [`.opstwin/agents/copilot-codex.md`](.opstwin/agents/copilot-codex.md) |
| **OpenAI Codex** | `.github/copilot-instructions.md`, `AGENTS.md` | [`.opstwin/agents/copilot-codex.md`](.opstwin/agents/copilot-codex.md) |
| **Windsurf** | `.windsurfrules`, `.opstwin/` | [`.opstwin/agents/windsurf.md`](.opstwin/agents/windsurf.md) |
| **Cline** | `.clinerules`, `.opstwin/` | [`.opstwin/agents/cline.md`](.opstwin/agents/cline.md) |
| **Gravity** | `GRAVITY.md`, `.opstwin/` | [`.opstwin/agents/gravity.md`](.opstwin/agents/gravity.md) |
| **Any other** | `AGENTS.md`, `.opstwin/rules.md` | Paste `.opstwin/task-template.md` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     OPSTWIN UI (Next.js)                        │
│  Dashboard · MVP Plan · Audit · Memory · Guide                  │
└────────────┬────────────────────────────────────────────────────┘
             │ REST API
┌────────────▼────────────────────────────────────────────────────┐
│  /api/tasks  /api/plans  /api/prompts  /api/runs  /api/memory  │
│  /api/outcomes  /api/auth  /api/health                          │
└────────────┬────────────────────────────────────────────────────┘
             │
┌────────────▼──────────────┐  ┌──────────────────────────────────┐
│  PRISMA + SQLite/Postgres │  │  ENGINES                         │
│  tasks, plans, prompts,   │  │  plan-engine (Groq/OpenAI)       │
│  runs, file_edits,        │  │  gap-analyzer                    │
│  terminal_logs,           │  │  prompt-proposer                 │
│  screenshots, memory      │  │  memory-engine                   │
└───────────────────────────┘  └──────────────────────────────────┘
             ▲
             │ audit JSON + CLI watch
┌────────────┴────────────────────────────────────────────────────┐
│              ANY CODING AGENT                                   │
│  Reads: .opstwin/rules.md + agent-specific config               │
│  Writes: .ops/runs/<run_id>/last_run.json                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Features

### Orchestration (MVP loop)

- **MVP plan generation** — Groq or OpenAI decomposes your idea into steps plus PRD, TRD, use cases, test plan, and architecture docs
- **Plan approval workflow** — Review and edit documents before any agent runs
- **Prompt proposal & dispatch** — Gap-aware next prompts; write to `.ops/dispatch/pending-prompt.md` for agents to read
- **Plan vs run gap analysis** — Compares approved steps against actual audit results

### Audit & memory

- **Agent-agnostic audit log** — Files changed, skipped, inspected, TODOs, tests, decision trace, confidence
- **Mismatch detection** — Blockers (failed tests, missing changes) and warnings (TODOs, low confidence)
- **Focused rerun prompt** — One-click copy of a scoped fix prompt for the next agent run
- **Pattern memory** — Learns from accepted/rejected outcomes; hints shown when creating new tasks
- **Terminal & screenshot capture** — Upload test output and UI screenshots per run

### Dashboard & CLI

- **Task dashboard** — Search, status filters, live polling for running jobs
- **MVP Plan + Audit tabs** — Per-task planning and run review
- **Guide view** — Full step-by-step reference (sidebar ? icon)
- **CLI watcher** — Auto-upload audits from `.ops/runs/`
- **One-command init** — `opstwin-init.js` sets up any repo for all supported agents
- **Optional auth** — Password-protected dashboard for production

---

## CLI reference

`opstwin-cli.js` is zero-dependency Node.js. Run it from **your code project** (after `opstwin-init.js`).

```bash
# Watch .ops/runs/ and auto-upload (recommended)
node opstwin-cli.js watch

# Upload a specific audit file
node opstwin-cli.js upload .ops/runs/<run_id>/last_run.json <taskId>

# Fetch approved prompt → .ops/dispatch/pending-prompt.md
node opstwin-cli.js dispatch <proposalId>

# One-click propose → approve → dispatch
node opstwin-cli.js next --yes

# Upload audit + prompt file + terminal
node opstwin-cli.js sync

# Watch .ops/prompts/inbound.md for captured prompts
node opstwin-cli.js prompt-watch

# Run a command and capture terminal output for the next upload
node opstwin-cli.js run npm test

# Upload terminal log to a run
node opstwin-cli.js terminal <runId>

# Upload a screenshot
node opstwin-cli.js screenshot <runId> screenshot.png

# Show last run status
node opstwin-cli.js status <taskId>

# Print focused rerun prompt to stdout
node opstwin-cli.js rerun <taskId>

# Show top memory entries
node opstwin-cli.js memory

node opstwin-cli.js help
```

| Variable | Default | Description |
|----------|---------|-------------|
| `OPSTWIN_URL` | `http://localhost:3000` | OpsTwin server URL |
| `OPSTWIN_TASK_ID` | _(none)_ | Default task ID for watch/upload |

---

## Agent integration

### Initialize your repo

```bash
# From the OpsTwin repo, point at your project:
node opstwin-init.js /path/to/your/repo

# Or, if opstwin-cli.js is already copied into your project:
node opstwin-init.js
```

### Typical session

1. Create a task in the OpsTwin dashboard → click **Copy** on the task ID (card, header, or success modal)
2. Set `OPSTWIN_TASK_ID` and run `node opstwin-cli.js watch` in your code project (see Quickstart step 5)
3. **Generate MVP Plan** → **Approve Plan**
4. **Copy prompt** on Step 1 (or **Dispatch to Agent** after proposing a prompt)
5. Paste into Cursor / Claude / your agent in the target repo
6. Agent writes `.ops/runs/<id>/last_run.json` (per `.opstwin/rules.md`)
7. CLI watcher uploads it → open **Audit** tab
8. **Propose Next Prompt** → approve → repeat

Manual upload: use the **Upload audit** page or drag `last_run.json` there.

---

## npm scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run dev:fresh` | Regenerate Prisma client, then start dev |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run db:push` | Apply Prisma schema to database |
| `npm run db:studio` | Open Prisma Studio |

---

## File structure

```
OpsTwin/
├── .opstwin/               ← Universal agent rules + per-agent guides
├── docs/                   ← Full SE documentation (PRD, TRD, architecture, …)
├── prisma/schema.prisma    ← Database schema
├── src/
│   ├── app/api/            ← REST routes (tasks, plans, prompts, runs, auth, …)
│   ├── components/         ← OpsTwin dashboard, TaskIdChip, PlanView, WorkflowGuide, …
│   └── lib/                ← plan-engine, gap-analyzer, prompt-proposer, llm, auth
├── opstwin-cli.js          ← Watch, upload, dispatch, run, terminal, screenshot
├── opstwin-init.js         ← One-command repo setup
├── test-opstwin.js         ← E2E API test suite (16 tests)
└── .env.example
```

Your **target project** (after init):

```
your-project/
├── .opstwin/               ← Audit contract + agent rules
├── .ops/
│   ├── runs/               ← Agent writes last_run.json here
│   ├── dispatch/           ← Dispatched prompts for agents
│   └── terminal/           ← Captured command output
├── AGENTS.md, CLAUDE.md, …  ← Agent-specific entry points
└── opstwin-cli.js          ← Copied by init
```

---

## Data model

| Table | Purpose |
|-------|---------|
| `tasks` | MVP ideas and original prompts |
| `plans` | Generated MVP plans (steps + documents JSON) |
| `prompt_proposals` | AI-proposed and approved agent prompts |
| `cursor_runs` | Agent execution records |
| `file_edits` | Per-file diffs |
| `inspected_files` | Files read but not changed |
| `terminal_logs` | Captured command output |
| `run_screenshots` | UI screenshots per run |
| `expectations` | What the user expected |
| `outcomes` | Accepted / rejected / modified |
| `memory_entries` | Learned patterns and fix suggestions |
| `auth_sessions` | Dashboard login sessions |

---

## Documentation

Full software engineering docs in [`docs/`](./docs/README.md):

- **[Quick Start](./docs/QUICKSTART.md)** ← start here
- [PRD](./docs/PRD.md) · [TRD](./docs/TRD.md) · [Use Cases](./docs/USE-CASES.md)
- [System Architecture](./docs/SYSTEM-ARCHITECTURE.md) · [Memory Layers](./docs/MEMORY-LAYERS.md)
- [API Specification](./docs/API-SPECIFICATION.md) · [Security](./docs/SECURITY.md)
- [Test Plan](./docs/TEST-PLAN.md) · [MVP Roadmap](./docs/MVP-ROADMAP.md)

---

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Set environment variables in the Vercel dashboard:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string (e.g. [Neon](https://neon.tech)) |
| `GROQ_API_KEY` | For AI planning and prompt improvement |
| `OPSTWIN_ADMIN_PASSWORD` | Dashboard login password |

For Postgres, change `provider = "sqlite"` to `"postgresql"` in `prisma/schema.prisma`, then run `npm run db:push`.

---

## Roadmap

- [ ] GitHub App integration (auto-create PR from branch)
- [ ] Slack / email notifications on run complete
- [ ] Live streaming of agent actions via webhook
- [ ] Acceptance rate heatmap per task type
- [ ] Auto-apply previously successful fix patterns
- [ ] JIRA / Linear ticket linking
- [ ] Agent filter on dashboard (Cursor vs Claude vs Gemini)

---

## Contributing

PRs are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

Every PR should include:

1. The task template used to generate the code
2. The `.ops/runs/<id>/last_run.json` from that run
3. Tests for any new or modified API routes

---

## Credits

Built by [Haseeb](https://github.com/haseeb099). If you use or build on this project, attribution is required — please link back to [this repository](https://github.com/haseeb099/OpsTwin).

---

## License

[MIT](./LICENSE) © 2026 Haseeb (haseeb099)
