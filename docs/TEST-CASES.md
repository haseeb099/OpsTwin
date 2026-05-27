# Test Cases
# OpsTwin — Detailed Test Cases

| Version | 1.0 · 2026-05-27 |

Format: **ID** | Priority | Module | Steps | Expected Result

---

## 1. Audit parser (unit)

### TC-PARSER-01 — Parse valid audit JSON

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Module** | audit-parser |
| **Preconditions** | `.ops/runs/example/last_run.json` exists |

**Steps:**
1. Load example JSON
2. Call `parseRunJson(raw, taskId)`

**Expected:**
- Returns `AuditReport` with all fields populated
- `mismatches` includes typecheck failure as blocker

---

### TC-PARSER-02 — Test failure → blocker mismatch

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Input** | audit JSON with `tests_run: [{ status: "fail" }]` |

**Expected:**
- Mismatch type `test_failure`, severity `blocker`

---

### TC-PARSER-03 — Low confidence → warning

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Input** | `confidence: "low"`, no test failures |

**Expected:**
- Warning mismatch present

---

### TC-PARSER-04 — Focused rerun excludes full task

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Input** | Report with 2 blockers, 1 warning |

**Expected:**
- Prompt contains BLOCKERS and WARNINGS sections
- Prompt contains "DO NOT RE-DO"
- Prompt does not contain full original MVP prompt

---

### TC-PARSER-05 — Missing required field

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Input** | JSON without `files_changed` |

**Expected:**
- Parser handles gracefully (empty array or validation error)

---

## 2. Memory engine (unit)

### TC-MEM-01 — Build memory entry from failed run

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Input** | AuditReport with test_failure blocker |

**Expected:**
- `successRate` = 0
- `improvementSuggestion` mentions tests

---

### TC-MEM-02 — Build memory entry from clean run

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Input** | AuditReport with no blockers |

**Expected:**
- `successRate` = 1
- Suggestion: "No adjustment needed"

---

### TC-MEM-03 — Pattern hash deduplication

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Input** | Same taskType + failureType twice |

**Expected:**
- Same `patternHash`; upsert not duplicate

---

### TC-MEM-04 — Match memory for new task

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Input** | Prompt "add stripe webhook" + existing memory entries |

**Expected:**
- Returns ranked suggestions with successRate

---

## 3. API — Tasks

### TC-API-T01 — Create task

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Request** | POST `/api/tasks` with valid body |

**Expected:** HTTP 201, task object returned

---

### TC-API-T02 — Create task invalid prompt

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Request** | POST with `originalPrompt: "short"` |

**Expected:** HTTP 400

---

### TC-API-T03 — List tasks

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Request** | GET `/api/tasks` |

**Expected:** HTTP 200, `{ tasks: [] }` or populated array

---

## 4. API — Runs

### TC-API-R01 — Upload audit (happy path)

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Request** | POST `/api/runs` action=`upload_audit` with example JSON |

**Expected:**
- HTTP 200
- Run status updated to `complete` or `partial`
- `report.mismatches` populated
- `focusedRerunPrompt` present if mismatches exist

---

### TC-API-R02 — Upload audit task not found

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Request** | POST with invalid `taskId` |

**Expected:** HTTP 404

---

### TC-API-R03 — Upload invalid JSON body

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Request** | POST with malformed body |

**Expected:** HTTP 400

---

### TC-API-R04 — Get run with report

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Request** | GET `/api/runs/[id]` after upload |

**Expected:**
- HTTP 200
- `run`, `report`, `focusedRerunPrompt` in response

---

### TC-API-R05 — Start run

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Request** | POST action=`start` |

**Expected:** HTTP 201, status=`running`

---

## 5. API — Outcomes

### TC-API-O01 — Accept outcome

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Request** | POST `/api/outcomes` action=`accepted` |

**Expected:** HTTP 201, outcome recorded

---

### TC-API-O02 — Reject with feedback

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Request** | POST action=`rejected`, userFeedback set |

**Expected:** HTTP 201, feedback stored

---

## 6. API — Memory

### TC-API-M01 — List memory entries

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Request** | GET `/api/memory` |

**Expected:** HTTP 200, entries array

---

## 7. CLI

### TC-CLI-01 — Help command

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Command** | `node opstwin-cli.js help` |

**Expected:** Usage text printed, exit 0

---

### TC-CLI-02 — Upload command

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Command** | `node opstwin-cli.js upload .ops/runs/example/last_run.json <taskId>` |

**Expected:** Success message, run in DB

---

### TC-CLI-03 — Watch detects new file

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Steps** | Start watch; write new last_run.json |

**Expected:** Auto-upload within 2 seconds

---

### TC-CLI-04 — Rerun command

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Command** | `node opstwin-cli.js rerun <taskId>` |

**Expected:** Focused rerun prompt printed to stdout

---

## 8. Init script

### TC-INIT-01 — Init target repo

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Command** | `node opstwin-init.js /tmp/test-repo` |

**Expected:**
- `.opstwin/`, `.cursor/`, `.ops/runs/`, agent files, `opstwin-cli.js` exist

---

### TC-INIT-02 — Refuse self-init

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Command** | `node opstwin-init.js .` (from OpsTwin root) |

**Expected:** Error message, exit 1

---

## 9. UI (manual E2E)

### TC-UI-01 — Dashboard loads

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Steps** | Open `http://localhost:3000` |

**Expected:** Task list or empty state visible

---

### TC-UI-02 — Create task flow

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Steps** | New Task → fill form → save |

**Expected:** Task appears in list

---

### TC-UI-03 — View audit report

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Steps** | Select task → select run |

**Expected:** Files, tests, mismatches displayed

---

### TC-UI-04 — Copy focused rerun

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Steps** | Click Create Focused Rerun |

**Expected:** Toast success; clipboard contains prompt

---

### TC-UI-05 — Accept run outcome

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Steps** | Click Accept on run detail |

**Expected:** Outcome saved; UI feedback

---

### TC-UI-06 — Live poll

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Steps** | Open run with status running |

**Expected:** UI refreshes without manual reload

---

## 10. Security

### TC-SEC-01 — Path traversal in audit path

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Input** | `files_changed: [{ path: "../../etc/passwd" }]` |

**Expected:** Rejected or sanitized; not executed

---

### TC-SEC-02 — XSS in diff content

| Field | Value |
|---|---|
| **Priority** | P0 |
| **Input** | diff containing `<script>alert(1)</script>` |

**Expected:** Rendered as text, not executed

---

### TC-SEC-03 — Oversized audit JSON

| Field | Value |
|---|---|
| **Priority** | P1 |
| **Input** | JSON > 5 MB |

**Expected:** HTTP 413 or 400 (when limit implemented)

---

## 11. Phase 1 (planned)

### TC-PLAN-01 — Generate MVP plan

**Expected:** Ordered steps + document bundle returned

### TC-PLAN-02 — Approve plan without edit

**Expected:** Status `approved`; steps unlocked

### TC-PROMPT-01 — Propose improved prompt after gaps

**Expected:** Proposal references mismatches + plan step

### TC-PROMPT-02 — Cannot dispatch unapproved prompt

**Expected:** HTTP 403 or blocked in UI

---

## 12. Test execution log template

| Date | Tester | Case ID | Result | Notes |
|---|---|---|---|---|
| | | TC-API-R01 | PASS/FAIL | |
