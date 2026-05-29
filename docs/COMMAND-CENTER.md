# OpsTwin Command Center

Interactive MVP pipeline: timestamps, step control, activity feed, bounded Cursor runs.

## Dashboard sections

| Section | Purpose |
|---------|---------|
| **Automation loop** | CLI status, Run in Cursor, last run + heartbeat timestamps |
| **Pipeline** | 5–8 steps with started/done times, Propose / Done / Skip / Retry |
| **Activity timeline** | Chronological events (plan, steps, proposals, runs) |
| **Documents** | PRD, TRD, Use Cases, Architecture, **ERD**, Test Plan — version + step link |

## Step lifecycle

```
pending → in_progress → complete | failed
                ↑ manual Start / Retry
                ↑ auto-advance on successful audit upload
```

Manual actions (dashboard): **Start**, **Done**, **Skip**, **Retry**, **Reset**, **Propose** (step-scoped).

Auto-advance: when `POST /api/runs` uploads an audit with no blockers, `syncPlanStepsAfterAuditUpload` marks the active step complete and opens the next step.

## APIs

- `GET /api/plans/[id]/timeline` — activity feed
- `PATCH /api/plans/[id]` — `{ action: "step_action", stepOrder, stepAction }`

## Workflow (supervised autopilot)

1. Generate plan → **Approve plan** (step 1 starts, timestamp recorded)
2. On active step: **Propose** → review draft → **Send to Agent**
3. Run loop in project repo: `node opstwin-cli.js loop <taskId>`
4. Audit uploads → step advances → timeline updates
5. Repeat until pipeline shows all steps **complete**

## Cursor control

- **Run in Cursor now** — queues run via CLI (needs loop + `CURSOR_API_KEY`)
- Run from **external PowerShell** in your project folder, not the OpsTwin server repo

## Next improvements

- Pause automation toggle (persisted)
- Per-step document refresh from LLM
- Cloud Cursor fallback when local SDK fails
- Task list progress % + last activity
