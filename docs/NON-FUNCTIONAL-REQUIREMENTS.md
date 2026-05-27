# Non-Functional Requirements (NFR)
# OpsTwin

| Version | 1.0 · 2026-05-27 |

---

## 1. Performance

| ID | Requirement | Target | Measurement |
|---|---|---|---|
| NFR-P01 | API response time (excl. LLM) | p95 < 500ms | Load test on `/api/tasks`, `/api/runs` |
| NFR-P02 | Audit ingest + parse | < 2s for 1MB JSON | POST `/api/runs` |
| NFR-P03 | CLI file detect + upload | < 2s from file write | `watch` command |
| NFR-P04 | Dashboard initial load | < 3s on broadband | Lighthouse |
| NFR-P05 | Live run poll interval | 5 seconds | UI config |
| NFR-P06 | LLM plan generation (Phase 1) | < 60s for MVP plan | Async with progress UI |

---

## 2. Reliability

| ID | Requirement | Target |
|---|---|---|
| NFR-R01 | CLI upload retry on network failure | 3 retries with backoff |
| NFR-R02 | API availability (production) | 99.5% monthly |
| NFR-R03 | No data loss on successful upload | Audit JSON persisted before 200 response |
| NFR-R04 | Graceful degradation if memory engine fails | Run still saved; hint omitted |

---

## 3. Scalability

| ID | Requirement | Target |
|---|---|---|
| NFR-S01 | Tasks per instance | 1,000+ without UI degradation |
| NFR-S02 | Runs per task | 100+ with pagination |
| NFR-S03 | Audit JSON size | Up to 5 MB per run |
| NFR-S04 | Concurrent CLI watchers | 10+ repos per OpsTwin instance |

---

## 4. Usability

| ID | Requirement |
|---|---|
| NFR-U01 | New user can init repo and see first audit within 15 minutes (with docs) |
| NFR-U02 | Blockers visually distinct from warnings (color + icon) |
| NFR-U03 | One-click copy for rerun prompt |
| NFR-U04 | All agent setup docs in `.opstwin/agents/` |
| NFR-U05 | Error messages actionable (not generic "500 error") |

---

## 5. Maintainability

| ID | Requirement |
|---|---|
| NFR-M01 | TypeScript strict mode for `src/` |
| NFR-M02 | Shared types in `src/types/index.ts` |
| NFR-M03 | Audit schema changes documented in `.opstwin/rules.md` + TRD |
| NFR-M04 | API changes reflected in API-SPECIFICATION.md |
| NFR-M05 | Zero-deps CLI for easy distribution |

---

## 6. Portability

| ID | Requirement |
|---|---|
| NFR-PO01 | Runs on Windows, macOS, Linux (Node 18+) |
| NFR-PO02 | SQLite for local dev; Postgres for production |
| NFR-PO03 | Deployable via Vercel or Docker |
| NFR-PO04 | Agent-agnostic — no single vendor lock-in |

---

## 7. Security (summary)

See [SECURITY.md](./SECURITY.md).

| ID | Requirement |
|---|---|
| NFR-SEC01 | No secrets in repository |
| NFR-SEC02 | Auth required for production |
| NFR-SEC03 | Human approval before automated prompt dispatch |

---

## 8. Compliance & legal

| ID | Requirement |
|---|---|
| NFR-C01 | MIT license for open source distribution |
| NFR-C02 | Attribution required per README credits |
| NFR-C03 | User owns their prompts and audit data |

---

## 9. Observability (planned)

| ID | Requirement | Phase |
|---|---|---|
| NFR-O01 | Structured logging on API errors | 1 |
| NFR-O02 | Request ID on API responses | 1 |
| NFR-O03 | Health check endpoint `/api/health` | 1 |
| NFR-O04 | Metrics: upload count, mismatch rate | 2 |
