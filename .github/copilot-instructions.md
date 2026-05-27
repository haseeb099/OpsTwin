# OpsTwin — GitHub Copilot / Codex

Follow the universal OpsTwin rules in `.opstwin/rules.md` and skills in `.opstwin/skills.md`.

After every task, write `.ops/runs/<run_id>/last_run.json` with `"agent": "copilot"` or `"agent": "codex"`.

Before each session, fill in `.opstwin/task-template.md` and use it as your task prompt.
Copilot reads this file automatically in repos with custom instructions enabled.
