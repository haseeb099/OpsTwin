# GitHub Copilot & OpenAI Codex

| File | Purpose |
|---|---|
| `.github/copilot-instructions.md` | Copilot custom instructions (repo-wide) |
| `.opstwin/rules.md` | Full audit schema |
| `.opstwin/task-template.md` | Per-task prompt |

## Usage

1. Enable custom instructions for Copilot in your org/repo settings
2. Fill in `.opstwin/task-template.md`
3. Run your task in Copilot Chat, Copilot Workspace, or Codex
4. Set `"agent": "copilot"` or `"agent": "codex"` in the audit JSON

Works the same whether you use VS Code Copilot, GitHub.com, or Codex in the OpenAI ecosystem — the audit contract is identical.
