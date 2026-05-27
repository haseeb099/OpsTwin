# Cursor

OpsTwin ships Cursor-native config that mirrors `.opstwin/`:

| File | Purpose |
|---|---|
| `.cursor/rules.mdc` | Auto-loaded rules — mandatory audit JSON |
| `.cursor/skills.md` | Named skills |
| `.cursor/task-template.md` | Per-task prompt template |

## Usage

1. Fill in `.opstwin/task-template.md` (or `.cursor/task-template.md`)
2. Paste as your first Cursor message
3. Cursor writes `.ops/runs/<run_id>/last_run.json` when done
4. `node opstwin-cli.js watch` uploads it to OpsTwin

Set `"agent": "cursor"` in the audit JSON.
