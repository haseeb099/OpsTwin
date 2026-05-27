# Use Cases
# OpsTwin — AI Agent MVP Orchestration Platform

| Version | 1.0 · 2026-05-27 |

---

## Actors

| Actor | Description |
|---|---|
| **Developer** | Primary user; submits MVP prompts, approves plans and prompts |
| **Coding Agent** | External AI tool (Cursor, Claude, Gemini, etc.) |
| **OpsTwin Platform** | Web UI, API, memory engine, planning engine |
| **CLI Watcher** | `opstwin-cli.js` running in target repo |
| **System** | Database, file system (`.ops/runs/`) |

---

## UC-01: Initialize repository for OpsTwin

| Field | Value |
|---|---|
| **Actor** | Developer |
| **Preconditions** | OpsTwin server running; target repo exists |
| **Trigger** | Developer runs `node opstwin-init.js /path/to/repo` |

### Main flow

1. Developer runs init script in or pointing to target repo.
2. System copies `.opstwin/`, agent configs, `.ops/runs/`, and `opstwin-cli.js`.
3. System prints next-steps guide.
4. Developer starts CLI watcher with `OPSTWIN_TASK_ID`.

### Postconditions

- Target repo has audit rules and agent config.
- `.ops/runs/` directory exists.

### Alternate flows

- **1a.** Target is OpsTwin project itself → script exits with error.

---

## UC-02: Create task and run coding agent

| Field | Value |
|---|---|
| **Actor** | Developer, Coding Agent |
| **Preconditions** | Repo initialized; OpsTwin dashboard accessible |
| **Trigger** | Developer creates new MVP task |

### Main flow

1. Developer opens OpsTwin dashboard and clicks **New Task**.
2. Developer enters title, repo, branch, and original MVP prompt.
3. System shows memory hints from similar past tasks (if any).
4. Developer saves task and copies task ID.
5. Developer fills `.opstwin/task-template.md` and pastes into coding agent.
6. Agent reads rules, executes task, writes `last_run.json`.
7. CLI watcher uploads audit JSON to OpsTwin.
8. Dashboard shows run status and audit report.

### Postconditions

- Task and run records exist in database.
- Audit report available with mismatches.

---

## UC-03: Review audit and accept/reject outcome

| Field | Value |
|---|---|
| **Actor** | Developer |
| **Preconditions** | Run completed; audit ingested |
| **Trigger** | Developer opens run detail view |

### Main flow

1. Developer views audit report: files changed, skipped, TODOs, tests, decision trace.
2. System displays mismatches as blockers (red) and warnings (yellow).
3. Developer reviews gap between expected and actual.
4. Developer clicks **Accept**, **Reject**, or **Modified**.
5. System records outcome via `/api/outcomes`.
6. System updates memory entry if applicable.

### Postconditions

- Outcome stored with optional feedback.
- Memory pattern updated for future hints.

---

## UC-04: Generate and use focused rerun prompt

| Field | Value |
|---|---|
| **Actor** | Developer, Coding Agent |
| **Preconditions** | Run has blockers or warnings |
| **Trigger** | Developer clicks **Create Focused Rerun** |

### Main flow

1. System generates prompt targeting only blockers and warnings.
2. Developer copies prompt to clipboard.
3. Developer pastes prompt into coding agent.
4. Agent fixes gaps and writes new `last_run.json`.
5. CLI watcher uploads new run.
6. Developer compares runs until acceptance.

### Postconditions

- New run linked to same task.
- Iteration continues until no blockers.

### Alternate flows

- **1a.** No mismatches → system shows "No mismatches — focused rerun not needed".

---

## UC-05: Submit MVP prompt for planning (Phase 1)

| Field | Value |
|---|---|
| **Actor** | Developer |
| **Preconditions** | Phase 1 planning engine deployed |
| **Trigger** | Developer submits raw MVP idea |

### Main flow

1. Developer pastes MVP prompt into planning intake.
2. System decomposes into ordered steps (auth, DB, API, UI, tests, etc.).
3. System generates document bundle: PRD draft, TRD draft, use cases, test plan, architecture outline.
4. Developer reviews and edits documents in UI.
5. Developer approves plan.
6. System exports step-by-step agent prompts.

### Postconditions

- Plan status = `approved`.
- Documents versioned and stored.
- Step prompts ready for agent execution.

---

## UC-06: Approve improved prompt before next run (Phase 1)

| Field | Value |
|---|---|
| **Actor** | Developer |
| **Preconditions** | Previous run complete; gaps detected |
| **Trigger** | System proposes next prompt |

### Main flow

1. System analyzes: original prompt + approved plan + run results + memory.
2. System generates proposed improved prompt.
3. Developer reviews diff (proposed vs previous).
4. Developer edits if needed and clicks **Approve**.
5. System marks prompt as approved.
6. Developer copies to agent (Phase 3) or auto-dispatch (Phase 4).

### Postconditions

- Approval audit trail recorded.
- Approved prompt ready for execution.

### Alternate flows

- **4a.** Developer rejects → system retains proposal; developer can request regeneration.

---

## UC-07: Monitor live run

| Field | Value |
|---|---|
| **Actor** | Developer |
| **Preconditions** | Run status = `running` |
| **Trigger** | Developer opens run viewer |

### Main flow

1. Dashboard polls run status every 5 seconds.
2. UI updates when audit JSON arrives or status changes.
3. Developer observes progress without manual refresh.

### Postconditions

- Developer has real-time visibility into in-flight runs.

---

## UC-08: Learn from memory patterns

| Field | Value |
|---|---|
| **Actor** | Developer, OpsTwin Platform |
| **Preconditions** | Multiple runs exist for similar task types |
| **Trigger** | Developer creates new task |

### Main flow

1. System matches current prompt against memory entries.
2. System surfaces warnings and improvement suggestions in new task modal.
3. Developer incorporates hints into task template.
4. Agent run benefits from prior patterns.

### Postconditions

- Reduced repeat failures on similar tasks.

---

## UC-09: Capture terminal output (Phase 2)

| Field | Value |
|---|---|
| **Actor** | CLI Watcher, Coding Agent |
| **Preconditions** | Terminal hook or agent writes terminal summary |
| **Trigger** | Agent runs build/test commands |

### Main flow

1. Agent or CLI captures terminal output (stdout/stderr summary).
2. Output attached to audit JSON or separate upload.
3. Gap analyzer includes terminal failures in mismatch report.
4. Improved prompt targets specific terminal errors.

### Postconditions

- Terminal evidence available in run detail.

---

## UC-10: UI/UX gap review (Phase 5)

| Field | Value |
|---|---|
| **Actor** | Developer, OpsTwin Platform |
| **Preconditions** | App running; screenshots or Playwright capture available |
| **Trigger** | Run marked complete |

### Main flow

1. System captures screenshots of key UI flows.
2. System compares against acceptance criteria from approved plan.
3. System flags visual/flow gaps (missing elements, broken navigation).
4. System includes UI gaps in proposed improved prompt.
5. Developer approves prompt for UI fix iteration.

### Postconditions

- UI gaps tracked alongside code gaps.

---

## Use case map by phase

| Use case | Phase 0 | Phase 1 | Phase 2 | Phase 5 |
|---|---|---|---|---|
| UC-01 Init repo | ✓ | ✓ | ✓ | ✓ |
| UC-02 Create task | ✓ | ✓ | ✓ | ✓ |
| UC-03 Review audit | ✓ | ✓ | ✓ | ✓ |
| UC-04 Focused rerun | ✓ | ✓ | ✓ | ✓ |
| UC-05 MVP planning | — | ✓ | ✓ | ✓ |
| UC-06 Approve prompt | — | ✓ | ✓ | ✓ |
| UC-07 Live run | ✓ | ✓ | ✓ | ✓ |
| UC-08 Memory | ✓ | ✓ | ✓ | ✓ |
| UC-09 Terminal | — | — | ✓ | ✓ |
| UC-10 UI review | — | — | — | ✓ |
