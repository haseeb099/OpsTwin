#!/usr/bin/env node
/**
 * opstwin-init.js — One-command setup for a new repo using OpsTwin
 *
 * Usage:
 *   node opstwin-init.js [target-directory]
 *
 * If no target directory is given, defaults to the current working directory.
 *
 * What it does:
 *   1. Copies .opstwin/ (universal rules for all coding agents)
 *   2. Copies agent-specific config (Cursor, Claude, Gemini, Copilot/Codex, etc.)
 *   3. Creates <target>/.ops/runs/
 *   4. Copies opstwin-cli.js into the target repo
 *   5. Prints a success summary with next steps
 *
 * No npm dependencies — uses only Node built-ins: fs, path.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Helpers ───────────────────────────────────────────────────────────────────

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dst) {
  if (!fs.existsSync(src)) {
    console.warn(`  [skip]  ${path.basename(src)}  — source not found: ${src}`);
    return;
  }
  mkdirp(path.dirname(dst));
  fs.copyFileSync(src, dst);
  console.log(`  [ok]    ${dst}`);
}

function copyDir(srcDir, dstDir) {
  if (!fs.existsSync(srcDir)) {
    console.warn(`  [skip]  ${srcDir}  — source not found`);
    return;
  }
  mkdirp(dstDir);
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dst = path.join(dstDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(src, dst);
    } else {
      copyFile(src, dst);
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const opstwinDir = __dirname;
  const targetArg  = process.argv[2];
  const targetDir  = targetArg ? path.resolve(targetArg) : process.cwd();

  if (path.resolve(targetDir) === path.resolve(opstwinDir)) {
    console.error('[opstwin-init] Target directory is the OpsTwin project itself.');
    console.error('[opstwin-init] Pass a different directory, e.g.:');
    console.error('[opstwin-init]   node opstwin-init.js ~/my-project');
    process.exit(1);
  }

  console.log(`\nOpsTwin init → ${targetDir}\n`);

  // 1. Universal .opstwin/ rules (all agents)
  console.log('Copying .opstwin/ (universal agent rules):');
  copyDir(
    path.join(opstwinDir, '.opstwin'),
    path.join(targetDir, '.opstwin'),
  );

  // 2. Agent-specific config files
  console.log('\nCopying agent-specific config:');

  console.log('  Cursor:');
  for (const file of ['rules.mdc', 'skills.md', 'task-template.md']) {
    copyFile(
      path.join(opstwinDir, '.cursor', file),
      path.join(targetDir, '.cursor', file),
    );
  }

  const agentFiles = [
    ['AGENTS.md', 'AGENTS.md'],
    ['CLAUDE.md', 'CLAUDE.md'],
    ['GEMINI.md', 'GEMINI.md'],
    ['GRAVITY.md', 'GRAVITY.md'],
    ['.windsurfrules', '.windsurfrules'],
    ['.clinerules', '.clinerules'],
    ['.github/copilot-instructions.md', '.github/copilot-instructions.md'],
  ];

  for (const [srcRel, dstRel] of agentFiles) {
    copyFile(
      path.join(opstwinDir, srcRel),
      path.join(targetDir, dstRel),
    );
  }

  // 3. Create .ops/runs/, .ops/dispatch/, .ops/terminal/, .ops/prompts/
  for (const sub of ['runs', 'dispatch', 'terminal', 'prompts', 'context']) {
    const dir = path.join(targetDir, '.ops', sub);
    mkdirp(dir);
    console.log(`  [ok]    ${dir}`);
  }
  const inboundTemplate = path.join(targetDir, '.ops', 'prompts', 'inbound.md');
  if (!fs.existsSync(inboundTemplate)) {
    fs.writeFileSync(
      inboundTemplate,
      '# Append agent prompts here (timestamped entries)\n\n',
      'utf8',
    );
    console.log(`  [ok]    ${inboundTemplate}`);
  }
  console.log(`\nCreated directories:`);

  // 4. Copy opstwin-cli.js + scripts/
  console.log(`\nCopying CLI tool:`);
  copyFile(
    path.join(opstwinDir, 'opstwin-cli.js'),
    path.join(targetDir, 'opstwin-cli.js'),
  );
  const scriptsSrc = path.join(opstwinDir, 'scripts');
  if (fs.existsSync(scriptsSrc)) {
    copyDir(scriptsSrc, path.join(targetDir, 'scripts'));
  }

  const configPath = path.join(targetDir, '.ops', 'opstwin.config.json');
  const existingCfg = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : {};
  fs.writeFileSync(
    configPath,
    JSON.stringify(
      {
        url: 'http://localhost:3000',
        taskId: '',
        opstwinRoot: opstwinDir.replace(/\\/g, '/'),
        autoRunCursor: false,
        _note: 'Full loop: $env:CURSOR_API_KEY=...; node opstwin-cli.js loop <taskId>',
        ...existingCfg,
        opstwinRoot: opstwinDir.replace(/\\/g, '/'),
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  console.log(`  [ok]    ${configPath}`);

  const opstwinDisplay = opstwinDir;

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  OpsTwin initialized in ${targetDir}

  Works with any coding agent:
    Cursor · Claude Code · Gemini · GitHub Copilot · Codex
    Windsurf · Cline · Gravity · Continue · and others

  Next steps:

  1. Start OpsTwin:
       cd ${opstwinDisplay}
       npm run dev

  2. Create a task:
       Open http://localhost:3000 and click  +  (New Task)
       Copy the task ID shown in the URL or task card.

  3. Connect this repo to your OpsTwin task (copy task ID from dashboard URL):
       cd ${targetDir}
       node opstwin-cli.js connect <task-id-from-dashboard>

     On Windows (PowerShell) — same command:
       node opstwin-cli.js connect <task-id-from-dashboard>

  4. Full automation (Cursor runs via API — leave running):
       $env:CURSOR_API_KEY="your-key-from-cursor.com/settings"
       node opstwin-cli.js loop <task-id-from-dashboard>

  5. In the dashboard:
       Review draft proposals → Send to Agent when ready
       CLI writes .ops/dispatch/pending-prompt.md automatically

  6. Run your coding agent:
       Fill in .opstwin/task-template.md and paste as your first prompt.
       Your agent reads its config automatically:
         Cursor  → .cursor/rules.mdc
         Claude  → CLAUDE.md
         Gemini  → GEMINI.md
         Copilot/Codex → .github/copilot-instructions.md
         Others  → AGENTS.md + .opstwin/rules.md

       After each run the agent writes .ops/runs/.../last_run.json
       — the watcher uploads it to OpsTwin automatically.

  See .opstwin/agents/ for per-agent setup notes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main();
