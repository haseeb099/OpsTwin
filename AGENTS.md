# OpsTwin — Agent Instructions

This repository uses **OpsTwin** for structured audit logging of every AI coding session.

**Applies to all coding agents:** Cursor, Claude Code, Gemini, GitHub Copilot, Codex, Windsurf, Cline, Gravity, Continue, and any other tool that can edit files and follow project instructions.

## Required reading

1. `.opstwin/rules.md` — mandatory audit JSON schema and safety rules
2. `.opstwin/skills.md` — named skills (audit-log, branch-safety, bounded-task, etc.)
3. `.opstwin/task-template.md` — fill this out before each task

## After every task

Write `.ops/runs/<run_id>/last_run.json` using the schema in `.opstwin/rules.md`. Set the `agent` field to your tool name. The OpsTwin CLI watcher uploads this file automatically.

## Agent-specific config (optional)

| Agent | Config file(s) loaded automatically |
|---|---|
| **Cursor** | `.cursor/rules.mdc`, `.cursor/skills.md` |
| **Claude Code** | `CLAUDE.md`, `.opstwin/` |
| **Gemini** | `GEMINI.md`, `.opstwin/` |
| **GitHub Copilot / Codex** | `.github/copilot-instructions.md`, `.opstwin/` |
| **Windsurf** | `.windsurfrules`, `.opstwin/` |
| **Cline** | `.clinerules`, `.opstwin/` |
| **Gravity** | `GRAVITY.md`, `.opstwin/` |
| **Any other agent** | Paste `.opstwin/task-template.md` + reference `.opstwin/rules.md` |

See `.opstwin/agents/` for per-agent setup notes.
