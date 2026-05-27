# Product Requirements Document (PRD)
# OpsTwin — AI Agent MVP Orchestration Platform

| Field | Value |
|---|---|
| **Product** | OpsTwin |
| **Version** | 1.0 (MVP planning) |
| **Author** | Haseeb |
| **Last updated** | 2026-05-27 |
| **Status** | Draft — planning phase |

---

## 1. Executive Summary

OpsTwin is a **human-in-the-loop orchestration platform** for building MVPs with any AI coding agent (Cursor, Claude Code, Gemini, GitHub Copilot, Codex, Windsurf, Cline, Gravity, etc.).

Today, developers paste a prompt into an agent and hope for the best. OpsTwin closes the loop by:

1. **Planning** — breaking an MVP prompt into steps and generating required engineering documents
2. **Observing** — capturing what the agent did (code, tests, terminal, UI)
3. **Improving** — proposing focused next prompts based on gaps
4. **Approving** — keeping the human in control before each run
5. **Learning** — storing patterns so future MVPs get faster and safer

**Current state (Phase 0):** Audit log, mismatch detection, focused rerun prompts, pattern memory, multi-agent config.  
**Target state (MVP):** Full plan → approve → dispatch → observe → improve → repeat loop.

---

## 2. Problem Statement

### 2.1 Pain points

| Problem | Impact |
|---|---|
| Vague MVP prompts produce inconsistent output | Wasted agent cycles, incomplete MVPs |
| No structured plan before coding starts | Agents over-engineer or miss scope |
| User cannot see intent vs result clearly | Hard to know what to fix next |
| Rerun requires manual prompt crafting | Slow iteration, repeated mistakes |
| No cross-run learning on a project | Same failures recur |
| Agent lock-in | Tools differ; audit trail does not transfer |

### 2.2 Opportunity

A single platform that works with **any coding agent**, enforces **structured documentation**, and runs an **approval-driven iteration loop** until the MVP matches user intent.

---

## 3. Goals & Success Metrics

### 3.1 Product goals

| ID | Goal |
|---|---|
| G1 | Support any coding agent via a single audit contract |
| G2 | Decompose MVP prompts into executable steps with generated docs |
| G3 | Observe agent output (code, terminal, UI) and detect gaps |
| G4 | Propose improved prompts; user approves before each run |
| G5 | Learn from runs to improve future task planning |

### 3.2 Success metrics (MVP)

| Metric | Target |
|---|---|
| Time from MVP prompt to first approved plan | < 5 minutes |
| Agent run acceptance rate (user accepts outcome) | > 60% within 3 iterations |
| Reduction in manual rerun prompt writing | > 70% vs baseline |
| Audit upload success rate (CLI watcher) | > 99% |
| Supported agents with init config | ≥ 8 (Cursor, Claude, Gemini, Copilot, Codex, Windsurf, Cline, Gravity) |

---

## 4. Target Users

| Persona | Description | Primary need |
|---|---|---|
| **Solo founder** | Builds MVP with AI agents, limited SE process | Structured plan + safe iteration |
| **Indie developer** | Uses multiple agents across projects | Agent-agnostic audit and memory |
| **Tech lead** | Oversees team using AI for features | Visibility into what agents changed and why |
| **AI-native team** | Heavy Cursor/Claude usage | Focused reruns, pattern memory, approval workflow |

---

## 5. Product Scope

### 5.1 In scope (MVP)

**Phase 0 — Shipped / in codebase**

- Structured audit JSON (`.ops/runs/<id>/last_run.json`)
- OpsTwin dashboard (tasks, runs, audit report, memory)
- Mismatch detection (missing files, test failures, lint, unexpected changes)
- Focused rerun prompt generation
- Pattern memory engine
- CLI watcher (`opstwin-cli.js`) and init script (`opstwin-init.js`)
- Multi-agent config (`.opstwin/`, agent-specific files)

**Phase 1 — MVP extension (planned)**

- MVP prompt intake → step decomposition
- Auto-generation of PRD, TRD, use cases, test plan, architecture outline
- Approval UI for plan and documents before coding
- Export step prompts for agent paste

**Phase 2 — Observation expansion (planned)**

- Terminal log capture in audit schema
- Build/test output ingestion
- Gap report: approved plan vs agent output

**Phase 3 — Prompt approval pipeline (planned)**

- Proposed next prompt in UI
- User approve / edit / reject
- One-click copy or CLI dispatch

**Phase 4 — Auto-dispatch (future)**

- Inject approved prompts into agent chat via integrations

**Phase 5 — UI/UX review (future)**

- Screenshot / browser capture vs acceptance criteria
- Visual and flow gap detection

### 5.2 Out of scope (MVP)

- Full CI/CD replacement
- Code hosting (GitHub/GitLab features)
- Multi-tenant SaaS billing
- Real-time agent action streaming (roadmap item)
- Auto-merge to production without human approval

---

## 6. Functional Requirements

### 6.1 Task & run management

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| FR-01 | User can create a task with title, repo, branch, and original prompt | P0 | 0 |
| FR-02 | User can list, search, and filter tasks by status | P0 | 0 |
| FR-03 | System ingests audit JSON from any agent via API or CLI | P0 | 0 |
| FR-04 | User can view full audit report per run | P0 | 0 |
| FR-05 | Live run viewer auto-refreshes while status is `running` | P1 | 0 |

### 6.2 Gap detection & iteration

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| FR-10 | System compares expected vs actual and classifies mismatches | P0 | 0 |
| FR-11 | System generates focused rerun prompt from blockers/warnings | P0 | 0 |
| FR-12 | User can accept, reject, or mark outcome as modified | P0 | 0 |
| FR-13 | System proposes improved prompt for next iteration | P0 | 1 |
| FR-14 | User must approve prompt before it is dispatched | P0 | 1 |

### 6.3 Planning & documentation

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| FR-20 | User can submit MVP prompt for step decomposition | P0 | 1 |
| FR-21 | System generates PRD, TRD, use cases, test plan, architecture draft | P0 | 1 |
| FR-22 | User can edit and approve generated documents | P0 | 1 |
| FR-23 | Approved plan exports as ordered agent prompts | P0 | 1 |

### 6.4 Memory & learning

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| FR-30 | System stores pattern entries from completed runs | P0 | 0 |
| FR-31 | New task modal shows hints from similar past runs | P1 | 0 |
| FR-32 | Memory clusters by task type and failure category | P1 | 0 |
| FR-33 | Success rate tracked per pattern over time | P2 | 1 |

### 6.5 Observation (extended)

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| FR-40 | Audit schema includes terminal output summary | P1 | 2 |
| FR-41 | Audit schema includes agent name field | P0 | 0 |
| FR-42 | Gap report compares approved plan step vs run result | P0 | 2 |
| FR-43 | UI/UX screenshot attached to run for review | P2 | 5 |

### 6.6 Agent integration

| ID | Requirement | Priority | Phase |
|---|---|---|---|
| FR-50 | Init script copies config for all supported agents | P0 | 0 |
| FR-51 | Single audit JSON schema works across agents | P0 | 0 |
| FR-52 | CLI watches `.ops/runs/` and auto-uploads | P0 | 0 |

---

## 7. User Experience Requirements

| ID | Requirement |
|---|---|
| UX-01 | Dashboard uses dark theme, monospace typography, status color coding |
| UX-02 | Blockers shown in red, warnings in yellow, success in green |
| UX-03 | One-click copy for focused rerun prompt |
| UX-04 | New task form pre-filled with memory hints when available |
| UX-05 | Approval screen shows diff: original prompt → proposed prompt → user edits |

---

## 8. Dependencies & Assumptions

### 8.1 Assumptions

- User has a coding agent that can edit files and follow project instructions
- User runs OpsTwin locally or on Vercel with Postgres for production
- Agent writes audit JSON per `.opstwin/rules.md` (or manual upload)
- Human approves every automated prompt before agent execution (MVP)

### 8.2 Dependencies

- Next.js 14, Prisma, SQLite/Postgres
- Node.js for CLI tools
- Optional: Postgres (Neon) for production deployment

---

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Agents ignore audit JSON requirement | High | High | Enforce via rules; validate on upload; blockers in UI |
| Auto-dispatch blocked by agent APIs | Medium | Medium | Phase 3 uses copy-paste; Phase 4 adds integrations incrementally |
| UI review false positives | Medium | Medium | Human approval gate; optional automated checks |
| Scope creep on MVP | High | High | Strict phase gates; Phase 0 ship first |

---

## 10. Release Criteria (MVP)

MVP is complete when Phase 0 + Phase 1 are done:

- [ ] All Phase 0 features stable (audit, dashboard, CLI, memory)
- [ ] MVP prompt → steps + documents generated
- [ ] User approval workflow for plan and prompts
- [ ] Gap analysis between approved plan and run results
- [ ] Test plan executed with > 80% pass rate on critical paths
- [ ] Security review checklist completed (see [SECURITY.md](./SECURITY.md))

---

## 11. References

- [TRD.md](./TRD.md)
- [USE-CASES.md](./USE-CASES.md)
- [MVP-ROADMAP.md](./MVP-ROADMAP.md)
- [README.md](../README.md) — project quickstart
