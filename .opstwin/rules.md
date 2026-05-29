# OpsTwin Agent Rules
# Applies to ALL coding agents: Cursor, Claude Code, Gemini, GitHub Copilot, Codex, Windsurf, Cline, Gravity, etc.
# Every run MUST produce a structured audit log at .ops/runs/<run_id>/last_run.json

## MANDATORY AUDIT OUTPUT
After EVERY task, write `.ops/runs/<run_id>/last_run.json` with this exact schema:
```json
{
  "run_id": "<uuid>",
  "timestamp": "<ISO8601>",
  "original_prompt": "<exact prompt given>",
  "branch": "ops/<task-slug>-<timestamp>",
  "agent": "<agent name: cursor|claude|gemini|copilot|codex|windsurf|cline|gravity|other>",
  "confidence": "high|medium|low",
  "files_changed": [
    { "path": "...", "lines_added": 0, "lines_removed": 0, "diff": "..." }
  ],
  "files_inspected": [
    { "path": "...", "touched": false, "reason": "no matching pattern" }
  ],
  "files_skipped": [
    { "path": "...", "reason": "do-not-touch rule / out of scope / no pattern" }
  ],
  "todos_left": [
    { "file": "...", "line": 0, "reason": "..." }
  ],
  "expected_changes": "...",
  "tests_run": [
    { "name": "...", "status": "pass|fail|skipped", "output": "..." }
  ],
  "decision_trace": [
    { "file": "...", "decision": "why this edit was made" }
  ],
  "next_steps": ["step 1", "step 2"],
  "blockers": [],
  "terminal_output": [
    { "command": "npm test", "exit_code": 0, "stdout": "...", "stderr": "" }
  ],
  "rules_read": ["<list of agent config files that applied>"],
  "skills_used": ["<skill names from skills.md used>"]
}
```

## AUTO-DISPATCH (when OpsTwin approves a prompt)
If `.ops/dispatch/pending-prompt.md` exists, read it FIRST and execute that task.
After completing it, delete or rename the file to `.ops/dispatch/completed-<timestamp>.md`.

## TERMINAL OUTPUT
Include `terminal_output` in audit JSON for every command you run (build, test, lint).
Or use: `node opstwin-cli.js run npm test` to capture automatically.

## BRANCH RULES
- Always create branch: `ops/<kebab-task-title>-<YYYYMMDD-HHMM>`
- NEVER push to main automatically
- Commit `.ops/runs/<run_id>/` along with code changes

## SCOPE RULES
- Do not change backend contracts unless explicitly asked
- Add minimal unit tests for every changed function
- Stop after first working version — don't over-engineer
- Leave TODO comments with one-line reason for anything unfinished

## SAFETY
- Run lint + typecheck before marking task complete
- If confidence is "low", add a blocker to next_steps
- Do not delete files without explicit instruction

## PROMPT TEMPLATE
When given a task, structure your approach:
1. State what you WILL change (scope declaration)
2. State what you will NOT change (boundaries)
3. Execute changes
4. Run verifications
5. Write audit JSON
6. Print next steps with confidence level

## PROMPT CAPTURE (file-based)
When the user gives you a task prompt, append a timestamped entry to `.ops/prompts/inbound.md`:
```
## 2026-05-27T12:00:00Z
<exact user prompt>
```
Run `node opstwin-cli.js prompt-watch` in the project to auto-upload captures.

## ONE-CLICK DISPATCH
After OpsTwin proposes an improved prompt, the user can run:
```
node opstwin-cli.js next --yes
```
This approves and writes `.ops/dispatch/pending-prompt.md` for the agent to read.
Reference `opstwin next` in next_steps when a focused rerun is recommended.
