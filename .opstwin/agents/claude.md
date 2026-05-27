# Claude Code

| File | Purpose |
|---|---|
| `CLAUDE.md` | Project instructions Claude Code reads automatically |
| `.opstwin/rules.md` | Full audit schema |
| `.opstwin/task-template.md` | Per-task prompt |

## Usage

1. Run `node opstwin-init.js` in your repo (copies all files)
2. Fill in `.opstwin/task-template.md`
3. Start Claude Code — it reads `CLAUDE.md` and `.opstwin/`
4. Set `"agent": "claude"` in the audit JSON
