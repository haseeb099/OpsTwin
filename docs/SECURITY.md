# Security
# OpsTwin — Security Requirements & Controls

| Version | 1.0 · 2026-05-27 |
| Classification | Internal — MVP planning |

---

## 1. Security objectives

| Objective | Description |
|---|---|
| **Confidentiality** | Protect prompts, code diffs, and credentials |
| **Integrity** | Ensure audit records are tamper-evident |
| **Availability** | Keep API and CLI upload reliable |
| **Accountability** | Trace approvals and outcomes to users |

---

## 2. Threat model

### 2.1 Assets

| Asset | Sensitivity |
|---|---|
| MVP prompts / business ideas | High |
| Code diffs in audit JSON | High |
| Database (tasks, runs, memory) | High |
| `.env` secrets | Critical |
| LLM API keys (Phase 1) | Critical |
| User approval decisions | Medium |

### 2.2 Threat actors

| Actor | Motivation |
|---|---|
| External attacker | Data exfiltration, API abuse |
| Malicious audit JSON | XSS, path traversal, injection |
| Compromised agent | Writes harmful code or false audits |
| Insider / developer | Curiosity, mistake |

### 2.3 STRIDE summary

| Threat | Example | Phase |
|---|---|---|
| **Spoofing** | Unauthenticated API uploads | 0 |
| **Tampering** | Modified audit JSON | 0 |
| **Repudiation** | No approval audit trail | 1 |
| **Information disclosure** | Diffs contain secrets | 0 |
| **Denial of service** | Large audit JSON flood | 0 |
| **Elevation** | Prompt injection via MVP input | 1 |

---

## 3. Security requirements

### 3.1 Authentication & authorization

| ID | Requirement | Phase | Status |
|---|---|---|---|
| SEC-AUTH-01 | Production deployment MUST require authentication | 1 | Planned |
| SEC-AUTH-02 | API keys for CLI upload in production | 1 | Planned |
| SEC-AUTH-03 | Tasks scoped to authenticated user | 1 | Planned |
| SEC-AUTH-04 | Phase 0 local dev MAY run without auth | 0 | Current |

**MVP note:** Phase 0 assumes trusted local network. Before public deployment, add NextAuth or API key auth.

### 3.2 Input validation

| ID | Requirement |
|---|---|
| SEC-INPUT-01 | Validate audit JSON schema on upload; reject unknown required field absence |
| SEC-INPUT-02 | Max audit JSON size: 5 MB (configurable) |
| SEC-INPUT-03 | Sanitize all user-provided strings before HTML render (XSS prevention) |
| SEC-INPUT-04 | Do not execute commands from audit JSON fields |
| SEC-INPUT-05 | Validate file paths in audit are relative; reject `..` traversal patterns |
| SEC-INPUT-06 | Sanitize MVP prompts before LLM calls (Phase 1); strip control characters |

### 3.3 Secrets management

| ID | Requirement |
|---|---|
| SEC-SECRET-01 | Never commit `.env`, credentials, or API keys |
| SEC-SECRET-02 | Use environment variables for `DATABASE_URL`, `NEXTAUTH_SECRET`, LLM keys |
| SEC-SECRET-03 | Audit JSON MUST NOT contain raw secrets; agent rules warn against logging `.env` |
| SEC-SECRET-04 | Future: secret scanner on audit diffs before storage |

### 3.4 Data protection

| ID | Requirement |
|---|---|
| SEC-DATA-01 | Postgres in production with TLS connection |
| SEC-DATA-02 | SQLite local files excluded from public access |
| SEC-DATA-03 | Audit diffs treated as confidential; restrict dashboard access |
| SEC-DATA-04 | Backup encryption for production database |

### 3.5 API security

| ID | Requirement |
|---|---|
| SEC-API-01 | Rate limit POST `/api/runs` in production (e.g. 100/min per key) |
| SEC-API-02 | CORS restricted to known origins in production |
| SEC-API-03 | HTTPS only in production |
| SEC-API-04 | Error responses MUST NOT leak stack traces to client |

### 3.6 Agent & CLI security

| ID | Requirement |
|---|---|
| SEC-CLI-01 | CLI only uploads to configured `OPSTWIN_URL` |
| SEC-CLI-02 | CLI does not execute audit JSON content |
| SEC-AGENT-01 | Agent rules prohibit committing secrets to `.ops/runs/` |
| SEC-AGENT-02 | Human approval required before prompt dispatch (no autonomous loop without gate) |

### 3.7 LLM security (Phase 1)

| ID | Requirement |
|---|---|
| SEC-LLM-01 | Do not send full repo to LLM; send prompt + summarized context only |
| SEC-LLM-02 | Log LLM requests without PII where possible |
| SEC-LLM-03 | Prompt injection defense: system prompt instructs model to ignore embedded instructions in user MVP text that conflict with OpsTwin role |
| SEC-LLM-04 | Output validation on generated plans before showing to user |

---

## 4. Security controls matrix

| Control | Implementation | Priority |
|---|---|---|
| XSS prevention | Escape diff/content in React; no `dangerouslySetInnerHTML` on audit data | P0 |
| JSON size limit | API middleware check Content-Length | P1 |
| Path traversal block | Reject `../` in file paths in parser | P0 |
| Auth | NextAuth + session (production) | P1 |
| API key for CLI | Header `X-OpsTwin-Key` | P1 |
| Rate limiting | Vercel middleware or upstash | P1 |
| Secret scan | Regex scan on diff before DB insert | P2 |
| Approval audit log | Immutable `ApprovalEvent` table | P1 |

---

## 5. Secure development practices

| Practice | Application |
|---|---|
| Dependency audit | `npm audit` in CI |
| Least privilege | DB user with minimal permissions |
| No secrets in PRs | `.gitignore` for `.env`, pre-commit hook recommended |
| PR requirements | Include audit JSON from agent run (see CONTRIBUTING.md) |

---

## 6. Incident response (minimal)

| Step | Action |
|---|---|
| 1 | Revoke exposed API keys / rotate `NEXTAUTH_SECRET` |
| 2 | Identify affected tasks/runs in DB |
| 3 | Notify users if production data exposed |
| 4 | Patch vulnerability; deploy |
| 5 | Post-mortem document |

---

## 7. Security checklist — pre-production

- [ ] Authentication enabled on all `/api/*` routes
- [ ] HTTPS enforced
- [ ] Environment variables set in Vercel (not in repo)
- [ ] Rate limiting configured
- [ ] Audit JSON size limit enforced
- [ ] XSS review on OpsTwin.tsx render paths
- [ ] Postgres TLS connection verified
- [ ] CLI requires API key for remote upload
- [ ] LLM prompts sanitized (Phase 1)
- [ ] Approval audit trail active (Phase 1)

---

## 8. References

- [TRD.md](./TRD.md) — Section 7
- [NON-FUNCTIONAL-REQUIREMENTS.md](./NON-FUNCTIONAL-REQUIREMENTS.md)
- [DEPLOYMENT-OPERATIONS.md](./DEPLOYMENT-OPERATIONS.md)
