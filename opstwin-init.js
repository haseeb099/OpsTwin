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
 *   1. Creates <target>/.cursor/  if it does not exist
 *   2. Copies .cursor/rules.mdc, .cursor/skills.md, .cursor/task-template.md
 *      from the OpsTwin installation into <target>/.cursor/
 *   3. Creates <target>/.ops/runs/  if it does not exist
 *   4. Copies opstwin-cli.js from the OpsTwin installation into <target>/
 *   5. Prints a success summary with next steps
 *
 * No npm dependencies — uses only Node built-ins: fs, path.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Ensure a directory (and its parents) exists.
 * @param {string} dir
 */
function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Copy a single file, creating destination directories as needed.
 * Prints a status line for each file.
 * @param {string} src  Absolute source path
 * @param {string} dst  Absolute destination path
 */
function copyFile(src, dst) {
  if (!fs.existsSync(src)) {
    console.warn(`  [skip]  ${path.basename(src)}  — source not found: ${src}`);
    return;
  }
  mkdirp(path.dirname(dst));
  fs.copyFileSync(src, dst);
  console.log(`  [ok]    ${dst}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  // The directory that contains this script (OpsTwin project root)
  const opstwinDir = __dirname;

  // Target directory — from CLI arg or cwd
  const targetArg  = process.argv[2];
  const targetDir  = targetArg ? path.resolve(targetArg) : process.cwd();

  // Refuse to overwrite the OpsTwin project itself
  if (path.resolve(targetDir) === path.resolve(opstwinDir)) {
    console.error('[opstwin-init] Target directory is the OpsTwin project itself.');
    console.error('[opstwin-init] Pass a different directory, e.g.:');
    console.error('[opstwin-init]   node opstwin-init.js ~/my-project');
    process.exit(1);
  }

  console.log(`\nOpsTwin init → ${targetDir}\n`);

  // 1 & 2. Copy .cursor/ files
  const cursorSrc = path.join(opstwinDir, '.cursor');
  const cursorDst = path.join(targetDir,  '.cursor');

  console.log('Copying .cursor/ files:');
  for (const file of ['rules.mdc', 'skills.md', 'task-template.md']) {
    copyFile(path.join(cursorSrc, file), path.join(cursorDst, file));
  }

  // 3. Create .ops/runs/
  const opsDir = path.join(targetDir, '.ops', 'runs');
  mkdirp(opsDir);
  console.log(`\nCreated directory:`);
  console.log(`  [ok]    ${opsDir}`);

  // 4. Copy opstwin-cli.js
  console.log(`\nCopying CLI tool:`);
  copyFile(
    path.join(opstwinDir, 'opstwin-cli.js'),
    path.join(targetDir,  'opstwin-cli.js'),
  );

  // 5. Success summary + next steps
  // Derive a short display path for the OpsTwin dir to keep instructions readable
  const opstwinDisplay = opstwinDir;

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  OpsTwin initialized in ${targetDir}

  Next steps:

  1. Start OpsTwin:
       cd ${opstwinDisplay}
       npm run dev

  2. Create a task:
       Open http://localhost:3000 and click  +  (New Task)
       Copy the task ID shown in the URL or task card.

  3. Start the file watcher in your repo:
       cd ${targetDir}
       OPSTWIN_URL=http://localhost:3000 OPSTWIN_TASK_ID=<id> node opstwin-cli.js watch

     On Windows (PowerShell):
       $env:OPSTWIN_URL="http://localhost:3000"; $env:OPSTWIN_TASK_ID="<id>"; node opstwin-cli.js watch

  4. Use Cursor:
       Paste the contents of .cursor/task-template.md as your first Cursor prompt.
       Cursor will read .cursor/rules.mdc + .cursor/skills.md automatically.
       After each run, Cursor writes .ops/runs/.../last_run.json — the watcher
       picks it up and uploads it to OpsTwin automatically.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main();
