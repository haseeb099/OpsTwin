# Acceptance Criteria
# OpsTwin MVP — Definition of Done

| Version | 1.0 · 2026-05-27 |

This document defines **when the MVP is done** at each phase. All criteria in a phase must pass before moving to the next.

---

## Phase 0: Audit & Memory (current baseline)

### AC-0.1 Repository initialization

- [ ] `node opstwin-init.js <repo>` copies `.opstwin/`, all agent configs, `.ops/runs/`, `opstwin-cli.js`
- [ ] No npm install required for init or CLI
- [ ] Init refuses to run against OpsTwin project root

### AC-0.2 Task lifecycle

- [ ] User can create task via dashboard with title, repo, branch, prompt
- [ ] User can list tasks with search and status filter
- [ ] Task shows linked runs and latest status

### AC-0.3 Audit ingestion

- [ ] Agent writes valid `last_run.json` per `.opstwin/rules.md`
- [ ] CLI `watch` uploads new files within 2 seconds
- [ ] CLI `upload` works for manual upload
- [ ] Invalid JSON returns HTTP 400 with clear error
- [ ] Parser produces `AuditReport` with computed mismatches

### AC-0.4 Audit report UI

- [ ] Run detail shows: files changed, inspected, skipped, TODOs, tests, decision trace, blockers, next steps
- [ ] Blockers displayed as red; warnings as yellow
- [ ] Confidence level visible
- [ ] Live polling every 5s while run status = `running`

### AC-0.5 Iteration

- [ ] Focused rerun prompt generated from blockers + warnings only
- [ ] One-click copy to clipboard works
- [ ] User can accept, reject, or mark modified via UI
- [ ] Outcome persisted to database

### AC-0.6 Memory

- [ ] Memory entry created/updated after run with mismatches
- [ ] New task modal shows hints from similar patterns
- [ ] `opstwin-cli.js memory` returns top entries

### AC-0.7 Multi-agent

- [ ] Audit JSON includes `agent` field
- [ ] Config exists for: Cursor, Claude, Gemini, Copilot/Codex, Windsurf, Cline, Gravity
- [ ] Same audit schema works regardless of agent

---

## Phase 1: Planning & Approval

### AC-1.1 MVP planning intake

- [ ] User can submit raw MVP prompt
- [ ] System returns ordered steps (min 3, max 20)
- [ ] Each step has: title, goal, constraints, expected outputs, verification

### AC-1.2 Document generation

- [ ] System generates draft: PRD, TRD, use cases, test plan, architecture outline
- [ ] Documents stored and versioned
- [ ] User can edit each document in UI
- [ ] User can approve document bundle

### AC-1.3 Approval workflow

- [ ] Plan status transitions: `draft` → `approved` → `in_progress` → `complete`
- [ ] Prompt proposals require explicit user approval
- [ ] Approval records: timestamp, user, diff from proposed

### AC-1.4 Improved prompt proposal

- [ ] After run with gaps, system proposes next prompt
- [ ] Proposal references: original intent, approved plan step, mismatches, memory
- [ ] User can edit, approve, or reject proposal
- [ ] Approved prompt exportable (copy or file)

### AC-1.5 Plan vs result gap

- [ ] For each approved plan step, system shows expected vs actual
- [ ] Incomplete steps flagged in dashboard

---

## Phase 2: Terminal & build observation

### AC-2.1 Terminal capture

- [ ] Audit JSON or companion upload includes terminal summary
- [ ] Failed commands appear as blockers in mismatch report
- [ ] Improved prompt references specific terminal errors

---

## Phase 3: Prompt dispatch (copy-first)

### AC-3.1 Dispatch without auto-inject

- [ ] Approved prompt one-click copy with confirmation toast
- [ ] CLI command: `opstwin-cli.js dispatch <promptId>`

---

## Phase 4: Auto-dispatch (future)

### AC-4.1 Agent integration

- [ ] At least one agent supports automatic prompt injection
- [ ] Human approval still required before dispatch

---

## Phase 5: UI/UX review (future)

### AC-5.1 Visual gap detection

- [ ] Screenshots attached to run
- [ ] UI gaps listed alongside code gaps
- [ ] Improved prompt includes UI fix instructions

---

## Global quality gates (all phases)

| Gate | Criteria |
|---|---|
| **Tests** | Critical test cases in [TEST-CASES.md](./TEST-CASES.md) pass |
| **Security** | [SECURITY.md](./SECURITY.md) checklist complete for deployed env |
| **Docs** | API changes reflected in [API-SPECIFICATION.md](./API-SPECIFICATION.md) |
| **Performance** | API p95 < 500ms (excl. LLM); CLI detect < 2s |

---

## MVP release definition

**MVP v1.0 = Phase 0 complete + Phase 1 complete + global quality gates.**

Phase 2+ are enhancements, not blockers for initial MVP release.
