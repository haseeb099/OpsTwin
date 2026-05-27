# Glossary
# OpsTwin — Terms & Definitions

| Version | 1.0 · 2026-05-27 |

---

| Term | Definition |
|---|---|
| **Agent** | Any AI coding tool that edits files and follows instructions (Cursor, Claude Code, Gemini, Copilot, Codex, Windsurf, Cline, Gravity, etc.) |
| **Audit JSON** | Structured record at `.ops/runs/<run_id>/last_run.json` describing what the agent did |
| **Audit report** | Parsed view of audit JSON (`AuditReport`) with computed mismatches |
| **Blocker** | Mismatch severity — must fix before accepting (test failure, typecheck fail, explicit blockers) |
| **Coding agent** | Synonym for Agent |
| **Confidence** | Agent self-assessment: `high`, `medium`, or `low` |
| **CursorRun** | Database record of one agent execution (displayed as "Agent Run"; name retained for compatibility) |
| **Decision trace** | Per-file rationale for non-trivial edits in audit JSON |
| **Focused rerun prompt** | Scoped prompt targeting only blockers and warnings from previous run |
| **Gap analysis** | Comparison of expected/approved intent vs actual agent output |
| **Human-in-the-loop** | User must approve plan or prompt before agent executes next step |
| **Memory entry** | Learned pattern stored in `MemoryEntry` table |
| **Mismatch** | Detected gap between expected and actual (type + severity) |
| **MVP** | Minimum Viable Product — smallest shippable version of user's product idea |
| **MVP plan** | Ordered steps decomposed from user's MVP prompt (Phase 1) |
| **OpsTwin** | This platform — audit, memory, and orchestration layer |
| **Orchestration loop** | Plan → approve → run agent → observe → propose → approve → repeat |
| **Outcome** | User decision on a run: accepted, rejected, modified, or rerun |
| **Pattern hash** | Unique key for memory deduplication: hash(taskType + failureType) |
| **Phase 0** | Current shipped baseline: audit + memory |
| **Phase 1** | MVP extension: planning + approval + prompt proposal |
| **PRD** | Product Requirements Document |
| **Prompt proposal** | System-generated next prompt awaiting user approval (Phase 1) |
| **Task** | Top-level unit of work with original MVP/feature prompt |
| **Task template** | `.opstwin/task-template.md` — structured prompt form for agents |
| **Terminal observation** | Capture of build/test command output (Phase 2) |
| **TRD** | Technical Requirements Document |
| **Warning** | Mismatch severity — should fix (TODOs, low confidence, skipped files) |
| **Watcher** | `opstwin-cli.js watch` — monitors `.ops/runs/` for new audit files |

---

## Acronyms

| Acronym | Meaning |
|---|---|
| API | Application Programming Interface |
| CLI | Command Line Interface |
| E2E | End-to-end |
| LLM | Large Language Model |
| MVP | Minimum Viable Product |
| NFR | Non-Functional Requirement |
| ORM | Object-Relational Mapping (Prisma) |
| PRD | Product Requirements Document |
| REST | Representational State Transfer |
| SDD | Software Design Document |
| TRD | Technical Requirements Document |
| UI | User Interface |
| UX | User Experience |
| XSS | Cross-Site Scripting |

---

## File paths

| Path | Purpose |
|---|---|
| `.opstwin/rules.md` | Universal audit rules for all agents |
| `.opstwin/skills.md` | Named agent skills |
| `.opstwin/task-template.md` | Task prompt template |
| `.ops/runs/<id>/last_run.json` | Audit output per run |
| `.ops/memory_summary.json` | Periodic memory export |
| `docs/` | Software engineering documentation |
| `opstwin-cli.js` | CLI watcher and uploader |
| `opstwin-init.js` | One-command repo setup |
