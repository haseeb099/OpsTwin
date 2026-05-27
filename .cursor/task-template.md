# OpsTwin Task Template
# Copy this and fill in the blanks when starting a task (any coding agent)
# Canonical copy: .opstwin/task-template.md

---
TASK: [Short title — becomes branch name]
GOAL: [One paragraph — what success looks like exactly]
CONSTRAINTS:
  - Do not change: [list files/contracts that are off-limits]
  - Must create branch: ops/[task-slug]-[timestamp]
  - Must add unit tests for: [specific functions/modules]
  - Stop condition: [first working version / all tests green / etc]

CONTEXT:
  - Repo: [repo name / path]
  - Branch base: [main / develop]
  - Agent: [cursor / claude / gemini / copilot / codex / windsurf / cline / gravity / other]
  - Related files: [list key files the agent should look at]
  - Prior run: [path to last .ops/runs/ JSON if re-running]

AUDIT REQUIREMENT:
  Write .ops/runs/<run_id>/last_run.json with full audit schema (see .opstwin/rules.md).
  For every skipped file, give a reason.
  For every TODO left in code, add to todos_left.
  Print confidence level and exact next steps at the end.

EXPECTED OUTPUTS:
  - Files changed: [list expected files]
  - Tests that should pass: [test names or patterns]
  - Lint/typecheck: must be clean
---

## Example filled task:

TASK: add-stripe-webhook-handler
GOAL: Add a /api/webhooks/stripe endpoint that handles payment_intent.succeeded and customer.subscription.deleted events, updates the DB, and sends a Slack notification. Use existing SlackService and DB client.
CONSTRAINTS:
  - Do not change: src/lib/stripe.ts (existing client), prisma/schema.prisma
  - Must create branch: ops/add-stripe-webhook-20241201-1430
  - Must add unit tests for: handlePaymentSuccess(), handleSubscriptionDeleted()
  - Stop condition: both handlers tested, lint clean

CONTEXT:
  - Agent: cursor
  - Related files: src/lib/stripe.ts, src/lib/slack.ts, src/app/api/
  - Prior run: none

AUDIT REQUIREMENT: [standard — see .opstwin/skills.md]

EXPECTED OUTPUTS:
  - src/app/api/webhooks/stripe/route.ts (new)
  - src/app/api/webhooks/stripe/handlers.ts (new)
  - tests/webhooks/stripe.test.ts (new)
