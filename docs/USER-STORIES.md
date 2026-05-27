# User Stories
# OpsTwin — AI Agent MVP Orchestration Platform

Format: **As a** [persona], **I want** [goal], **so that** [benefit].

Priority: **P0** (MVP must-have) · **P1** (MVP should-have) · **P2** (post-MVP)

---

## Epic 1: Repository setup

| ID | Story | Priority | Phase | Acceptance |
|---|---|---|---|---|
| US-1.1 | As a developer, I want to run one init command so that my repo works with any coding agent and OpsTwin. | P0 | 0 | `opstwin-init.js` copies all config; `.ops/runs/` exists |
| US-1.2 | As a developer, I want agent-specific config files so that Cursor, Claude, Gemini, etc. all follow the same audit rules. | P0 | 0 | 8+ agent configs copied on init |

---

## Epic 2: Task management

| ID | Story | Priority | Phase | Acceptance |
|---|---|---|---|---|
| US-2.1 | As a developer, I want to create a task with my MVP prompt so that OpsTwin tracks intent across runs. | P0 | 0 | POST `/api/tasks` creates task; visible on dashboard |
| US-2.2 | As a developer, I want to search and filter tasks by status so that I can find work in progress quickly. | P1 | 0 | Search box + status filter work on dashboard |
| US-2.3 | As a developer, I want memory hints when creating a task so that I avoid repeating past mistakes. | P1 | 0 | Similar patterns shown in new task modal |

---

## Epic 3: Agent execution & audit

| ID | Story | Priority | Phase | Acceptance |
|---|---|---|---|---|
| US-3.1 | As a developer, I want the CLI to auto-upload audit JSON so that I don't manually upload after every agent run. | P0 | 0 | `watch` command uploads within 2s of file write |
| US-3.2 | As a developer, I want a full audit report so that I see every file changed, skipped, and why. | P0 | 0 | Run detail shows all audit fields |
| US-3.3 | As a developer, I want live run updates so that I see progress without refreshing. | P1 | 0 | Poll every 5s while status = running |
| US-3.4 | As a developer, I want to know which agent ran the task so that I can compare tools. | P1 | 0 | `agent` field shown in run detail |

---

## Epic 4: Gap detection & iteration

| ID | Story | Priority | Phase | Acceptance |
|---|---|---|---|---|
| US-4.1 | As a developer, I want mismatches classified as blockers vs warnings so that I know what must be fixed first. | P0 | 0 | Red blockers, yellow warnings in UI |
| US-4.2 | As a developer, I want a focused rerun prompt so that the agent fixes only gaps, not the whole task. | P0 | 0 | One-click copy; prompt lists blockers/warnings only |
| US-4.3 | As a developer, I want to accept or reject a run outcome so that OpsTwin learns what worked. | P0 | 0 | Outcome recorded via API; memory updated |
| US-4.4 | As a developer, I want OpsTwin to propose the next improved prompt so that I don't write reruns manually. | P0 | 1 | Proposed prompt shown after run with gaps |
| US-4.5 | As a developer, I want to approve a prompt before it runs so that I stay in control. | P0 | 1 | No dispatch without approval status |

---

## Epic 5: MVP planning & documents

| ID | Story | Priority | Phase | Acceptance |
|---|---|---|---|---|
| US-5.1 | As a founder, I want to paste an MVP idea and get a step plan so that coding starts with structure. | P0 | 1 | Plan with ordered steps generated from prompt |
| US-5.2 | As a developer, I want auto-generated PRD, TRD, use cases, and test plan so that I have proper engineering docs. | P0 | 1 | Document bundle created and editable |
| US-5.3 | As a developer, I want to edit and approve generated docs so that the plan reflects my intent. | P0 | 1 | Edit + approve workflow; version history |
| US-5.4 | As a developer, I want each plan step exported as an agent prompt so that I can execute incrementally. | P0 | 1 | One prompt per step; copy or dispatch |

---

## Epic 6: Extended observation

| ID | Story | Priority | Phase | Acceptance |
|---|---|---|---|---|
| US-6.1 | As a developer, I want terminal output in the audit so that build/test failures are visible. | P1 | 2 | Terminal summary in run detail |
| US-6.2 | As a developer, I want a gap report comparing approved plan vs actual run so that I see plan drift. | P0 | 2 | Side-by-side plan step vs run result |
| US-6.3 | As a developer, I want UI screenshots reviewed against acceptance criteria so that frontend gaps are caught. | P2 | 5 | UI gaps listed in mismatch report |

---

## Epic 7: Memory & learning

| ID | Story | Priority | Phase | Acceptance |
|---|---|---|---|---|
| US-7.1 | As a developer, I want failure patterns clustered by task type so that similar tasks get better over time. | P1 | 0 | Memory entries with patternHash and successRate |
| US-7.2 | As a tech lead, I want to see top failure patterns on the dashboard so that I know where agents struggle. | P2 | 1 | Dashboard metrics show top patterns |

---

## Epic 8: Auto-dispatch (future)

| ID | Story | Priority | Phase | Acceptance |
|---|---|---|---|---|
| US-8.1 | As a developer, I want approved prompts sent to my agent automatically so that I don't copy-paste. | P2 | 4 | Approved prompt appears in agent chat |
| US-8.2 | As a developer, I want the loop to continue until acceptance criteria pass so that MVP completion is automated with human gates. | P2 | 4 | Iteration loop with approval at each step |

---

## Story map (release order)

```
Phase 0: US-1.*, US-2.1, US-3.*, US-4.1–4.3, US-7.1
Phase 1: US-2.2–2.3, US-4.4–4.5, US-5.*, US-7.2
Phase 2: US-6.1–6.2
Phase 4: US-8.*
Phase 5: US-6.3
```
