# OpsTwin — Gemini

Follow the universal OpsTwin rules in `.opstwin/rules.md` and skills in `.opstwin/skills.md`.

After every task, write `.ops/runs/<run_id>/last_run.json` with `"agent": "gemini"`.

Before each session, fill in `.opstwin/task-template.md` and paste it as your first message.
Add `.opstwin/` to your context or system instructions if your Gemini workflow supports project files.
