# OpsTwin Skills — Cursor Agent Reference

## skill: audit-log
Whenever you complete a task in this repo, you MUST write a structured JSON audit log.
- Location: `.ops/runs/<run_id>/last_run.json`
- Fields: run_id, timestamp, original_prompt, branch, confidence, files_changed, files_inspected, files_skipped, todos_left, expected_changes, tests_run, decision_trace, next_steps, blockers
- This is non-negotiable. If you cannot write the file, add it to blockers.

## skill: branch-safety
- Always work on a feature branch: `ops/<task>-<timestamp>`
- Never auto-merge to main
- Commit audit log alongside code changes

## skill: bounded-task
- Before starting, declare: SCOPE (what changes), BOUNDARY (what won't change), VERIFICATION (how you'll confirm it works)
- Keep tasks under 200 lines of net-new code per run
- If a task exceeds scope, split it and document the split in next_steps

## skill: test-first-check
- Before editing a file, check if a test file exists for it
- After editing, run the test; record pass/fail in tests_run
- If no test exists and it's a core function, add a minimal test

## skill: explainability
- For every non-trivial edit, write a one-sentence "why" in decision_trace
- For skipped files, always give a reason (do-not-touch, out-of-scope, no-pattern)
- For TODOs left in code, use format: `// TODO(opstwin): <reason> — <suggested fix>`

## skill: confidence-scoring
- high: all tests pass, lint clean, changes are minimal and targeted
- medium: tests pass but coverage incomplete, or lint warnings exist
- low: tests not run, large refactor, breaking change risk

## skill: next-steps-format
Always end with:
```
NEXT STEPS (confidence: <level>):
1. <action> — <who> — <estimated time>
2. ...
MANUAL REQUIRED: <anything that cannot be automated>
```

## skill: memory-pattern
When a task fails or is partially complete, add to `.ops/memory_summary.json`:
```json
{
  "pattern": "<task type>",
  "failure_type": "<what went wrong>",
  "fix_applied": "<what fixed it>",
  "reuse": true
}
```
