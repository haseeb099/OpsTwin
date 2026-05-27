# Test Plan
# OpsTwin — Testing Strategy

| Version | 1.0 · 2026-05-27 |

---

## 1. Purpose

Define testing strategy, scope, environments, and responsibilities for OpsTwin MVP (Phase 0 + Phase 1).

---

## 2. Test scope

### In scope

| Area | Phase | Priority |
|---|---|---|
| Audit parser & mismatch engine | 0 | P0 |
| Memory engine | 0 | P0 |
| REST API routes | 0 | P0 |
| CLI commands | 0 | P0 |
| Dashboard UI (critical paths) | 0 | P1 |
| Init script | 0 | P1 |
| Planning engine | 1 | P0 |
| Approval workflow | 1 | P0 |
| Security controls | 0–1 | P0 |

### Out of scope (MVP)

- Agent internal behavior (Cursor, Claude, etc.)
- Load testing beyond 1000 tasks
- Playwright UI capture (Phase 5)
- Multi-tenant isolation testing

---

## 3. Test levels

```
┌─────────────────────────────────────────┐
│  E2E (manual + scripted)                 │  Critical user journeys
├─────────────────────────────────────────┤
│  Integration (API + DB)                  │  Route handlers + Prisma
├─────────────────────────────────────────┤
│  Unit (lib modules)                      │  audit-parser, memory-engine
├─────────────────────────────────────────┤
│  Static (lint, typecheck)                │  tsc, next lint
└─────────────────────────────────────────┘
```

---

## 4. Test environments

| Environment | Database | Purpose |
|---|---|---|
| Local dev | SQLite (`dev.db`) | Developer testing |
| CI | SQLite in-memory or temp file | Automated tests |
| Staging | Postgres (Neon) | Pre-production |
| Production | Postgres | Smoke tests only |

---

## 5. Entry & exit criteria

### Entry (start testing phase)

- [ ] Feature code complete for target phase
- [ ] `npm run typecheck` passes
- [ ] Database schema migrated

### Exit (release gate)

- [ ] All P0 test cases pass (see [TEST-CASES.md](./TEST-CASES.md))
- [ ] No open P0 bugs
- [ ] Security checklist reviewed ([SECURITY.md](./SECURITY.md))
- [ ] Acceptance criteria met ([ACCEPTANCE-CRITERIA.md](./ACCEPTANCE-CRITERIA.md))

---

## 6. Test types by module

### 6.1 audit-parser.ts

| Test type | Focus |
|---|---|
| Unit | Mismatch detection for each type |
| Unit | Focused rerun prompt format |
| Unit | Task type extraction |
| Unit | Edge cases: empty arrays, missing fields |

### 6.2 memory-engine.ts

| Test type | Focus |
|---|---|
| Unit | buildMemoryEntry from sample reports |
| Unit | matchMemoryPattern ranking |
| Unit | Improvement suggestion rules |

### 6.3 API routes

| Test type | Focus |
|---|---|
| Integration | CRUD tasks |
| Integration | upload_audit happy path |
| Integration | Invalid JSON → 400 |
| Integration | Missing task → 404 |
| Integration | Outcome recording |

### 6.4 CLI (opstwin-cli.js)

| Test type | Focus |
|---|---|
| Smoke | `test-opstwin.js` existing script |
| Manual | watch detects new file |
| Manual | upload, status, rerun, memory commands |

### 6.5 UI (OpsTwin.tsx)

| Test type | Focus |
|---|---|
| Manual E2E | Create task → view run → copy rerun |
| Manual E2E | Accept/reject outcome |
| Manual | Live poll while running |

### 6.6 opstwin-init.js

| Test type | Focus |
|---|---|
| Smoke | Copies all expected files |
| Smoke | Refuses OpsTwin self-target |

### 6.7 Phase 1 modules (planned)

| Test type | Focus |
|---|---|
| Unit | Plan step decomposition output structure |
| Integration | Plan approve workflow |
| Integration | Prompt propose + approve |
| Security | Prompt injection sanitization |

---

## 7. Test data

| Asset | Location |
|---|---|
| Example audit JSON | `.ops/runs/example/last_run.json` |
| Initial build audit | `.ops/runs/initial-build/last_run.json` |
| Seed data | `prisma/seed.ts` |

---

## 8. Tools

| Tool | Usage |
|---|---|
| `test-opstwin.js` | CLI + API smoke tests |
| `tsc --noEmit` | Type checking |
| `next lint` | Linting |
| Manual curl / Postman | API verification |
| Prisma seed | Test database population |

**Future:** Jest or Vitest for unit tests; Playwright for E2E.

---

## 9. Regression strategy

| Trigger | Action |
|---|---|
| PR merge | Run typecheck + test-opstwin.js |
| Schema change | Re-run all API integration tests |
| Audit schema change | Re-run parser unit tests + example JSON |

---

## 10. Roles

| Role | Responsibility |
|---|---|
| Developer | Unit + integration tests for changed code |
| Reviewer | Verify test cases updated in PR |
| QA (manual) | E2E checklist before release |

---

## 11. References

- [TEST-CASES.md](./TEST-CASES.md)
- [ACCEPTANCE-CRITERIA.md](./ACCEPTANCE-CRITERIA.md)
- `test-opstwin.js`
