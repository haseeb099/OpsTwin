# MVP Roadmap
# OpsTwin — Phased Implementation Plan

| Version | 1.0 · 2026-05-27 |

---

## Overview

```
Phase 0 ──▶ Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 4 ──▶ Phase 5
 Audit       Plan +      Terminal    Copy        Auto        UI/UX
 Memory      Approve     observe     dispatch    dispatch    review
 (NOW)       (MVP)       (MVP+)      (MVP+)      (Future)    (Future)
```

**MVP v1.0 release = Phase 0 + Phase 1 complete**

---

## Phase 0: Audit & Memory ✅ (current)

**Goal:** Agent-agnostic audit trail with gap detection and memory.

| Deliverable | Status |
|---|---|
| Audit JSON contract (`.opstwin/rules.md`) | Done |
| Multi-agent config + init script | Done |
| Dashboard (tasks, runs, audit, memory) | Done |
| Mismatch detection + focused rerun | Done |
| CLI watcher + upload | Done |
| Outcome tracking | Done |
| Pattern memory | Done |

**Exit criteria:** [ACCEPTANCE-CRITERIA.md](./ACCEPTANCE-CRITERIA.md) Phase 0

**Estimated effort:** Complete

---

## Phase 1: Planning & Approval 🎯 (next)

**Goal:** MVP prompt → steps + docs → user approval → improved prompts.

| Deliverable | Description |
|---|---|
| Planning intake UI | Paste MVP prompt |
| Plan engine | Decompose into ordered steps |
| Doc generator | PRD, TRD, use cases, test plan, architecture drafts |
| Document editor | Edit + version docs in UI |
| Approval workflow | Approve plan before coding |
| Prompt proposer | Generate next prompt from gaps |
| Prompt approval | Approve before export/dispatch |
| Plan vs result gap | Compare approved step vs run outcome |
| DB: Plan, PromptProposal | New Prisma models |
| API: `/api/plans`, `/api/prompts/*` | New routes |

**Dependencies:**
- LLM API key (OpenAI or Anthropic)
- Phase 0 stable

**Exit criteria:** [ACCEPTANCE-CRITERIA.md](./ACCEPTANCE-CRITERIA.md) Phase 1

**Estimated effort:** 4–6 weeks

---

## Phase 2: Terminal & Build Observation

**Goal:** Capture terminal output; include in gap analysis.

| Deliverable | Description |
|---|---|
| Terminal field in audit JSON | `terminal_output` summary |
| CLI tail hook (optional) | Capture build/test output |
| TerminalLog table | Store command, exit code, stdout/stderr |
| Mismatch from terminal | Failed commands → blockers |
| Improved prompt references | Specific error lines |

**Exit criteria:** [ACCEPTANCE-CRITERIA.md](./ACCEPTANCE-CRITERIA.md) Phase 2

**Estimated effort:** 2–3 weeks

---

## Phase 3: Prompt Dispatch (copy-first)

**Goal:** Reduce friction after approval; still human-in-the-loop.

| Deliverable | Description |
|---|---|
| One-click approved prompt copy | Enhanced UI |
| `opstwin-cli.js dispatch` | CLI command |
| Approval confirmation toast | UX polish |
| Dispatch audit log | Record when prompt sent |

**Exit criteria:** [ACCEPTANCE-CRITERIA.md](./ACCEPTANCE-CRITERIA.md) Phase 3

**Estimated effort:** 1–2 weeks

---

## Phase 4: Auto-Dispatch

**Goal:** Inject approved prompts into agent chat automatically.

| Deliverable | Description |
|---|---|
| Cursor integration | MCP or extension hook |
| Claude Code integration | CLI or API hook |
| At least one agent E2E | Full approve → auto-run loop |
| Safety: approval still required | No autonomous without gate |

**Risk:** Agent API availability varies by vendor.

**Estimated effort:** 4–8 weeks (agent-dependent)

---

## Phase 5: UI/UX Review

**Goal:** Visual and flow gap detection.

| Deliverable | Description |
|---|---|
| Screenshot capture | Playwright or manual upload |
| Acceptance criteria check | Compare UI vs plan |
| UI gap mismatches | New mismatch type |
| UI fix prompts | Included in proposal |

**Estimated effort:** 3–4 weeks

---

## Future (post-MVP)

| Item | Description |
|---|---|
| GitHub App | Auto-create PR from branch |
| Slack/email notifications | Run complete alerts |
| Live agent streaming | Webhook of agent actions |
| Acceptance rate heatmap | By task type |
| Auto-apply fix patterns | From memory |
| JIRA/Linear linking | Ticket integration |
| Multi-user auth | Teams |
| Agent performance dashboard | Compare Cursor vs Claude vs Gemini |

---

## Recommended build order

```
1. Complete Phase 0 test suite (TEST-CASES.md P0)
2. Add auth for production (SECURITY.md)
3. Build plan-engine + doc generator (Phase 1)
4. Build approval UI (Phase 1)
5. Build prompt proposer (Phase 1)
6. Ship MVP v1.0
7. Terminal capture (Phase 2)
8. Dispatch improvements (Phase 3–4)
9. UI review (Phase 5)
```

---

## Documentation deliverables (this phase) ✅

All planning documents created in `/docs`:

- PRD, TRD, use cases, user stories
- System architecture, SDD, memory layers
- Security, NFR, data model, API spec
- Test plan, test cases, acceptance criteria
- Deployment ops, roadmap, glossary

---

## References

- [PRD.md](./PRD.md)
- [ACCEPTANCE-CRITERIA.md](./ACCEPTANCE-CRITERIA.md)
- [README.md](../README.md)
