#!/usr/bin/env node
/**
 * opstwin-cli.js — Zero-dependency CLI for OpsTwin
 *
 * Commands:
 *   node opstwin-cli.js watch                  # Watch .ops/runs/**\/*.json and auto-upload new files
 *   node opstwin-cli.js upload <file> <taskId> # One-shot upload of a specific JSON run file
 *   node opstwin-cli.js status [taskId]        # Show last run status for a task
 *   node opstwin-cli.js rerun [taskId]         # Print focusedRerunPrompt for the last run
 *   node opstwin-cli.js memory                 # Show top 5 memory entries
 *   node opstwin-cli.js connect <taskId>        Save task ID to .ops/opstwin.config.json
 *   node opstwin-cli.js proposals [taskId]      List proposals for a task
 *   node opstwin-cli.js dispatch [id]           Write prompt to .ops/dispatch/ (proposal or task ID)
 *
 * Environment variables:
 *   OPSTWIN_URL      Base URL of OpsTwin server  (default: http://localhost:3000)
 *   OPSTWIN_TASK_ID  Default task ID when not passed as CLI arg
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const http  = require('http');
const https = require('https');

// ── Config ──────────────────────────────────────────────────────────────────

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

function loadLocalConfig() {
  const configPath = path.join(process.cwd(), '.ops', 'opstwin.config.json');
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
}

function saveLocalConfig(partial) {
  const opsDir = path.join(process.cwd(), '.ops');
  fs.mkdirSync(opsDir, { recursive: true });
  const configPath = path.join(opsDir, 'opstwin.config.json');
  const existing = loadLocalConfig();
  const next = { ...existing, ...partial };
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

const LOCAL_CONFIG = loadLocalConfig();
const BASE_URL = (process.env.OPSTWIN_URL || LOCAL_CONFIG.url || 'http://localhost:3000').replace(/\/$/, '');
const DEFAULT_TASK_ID = process.env.OPSTWIN_TASK_ID || LOCAL_CONFIG.taskId || '';
const API_KEY = process.env.OPSTWIN_API_KEY || LOCAL_CONFIG.apiKey || '';

function printHeader(title) {
  console.log(`\n${CYAN}${BOLD}━━ ${title} ━━${RESET}\n`);
}

function printOk(msg) {
  console.log(`${GREEN}✓${RESET} ${msg}`);
}

function printWarn(msg) {
  console.log(`${YELLOW}!${RESET} ${msg}`);
}

function printErr(msg) {
  console.log(`${RED}✗${RESET} ${msg}`);
}

function printHint(msg) {
  console.log(`${DIM}  ${msg}${RESET}`);
}

function printCmdBlock(label, lines) {
  console.log(`\n${YELLOW}${BOLD}${label}${RESET}`);
  for (const line of lines) console.log(`${CYAN}${line}${RESET}`);
  console.log('');
}

// ── HTTP helper ──────────────────────────────────────────────────────────────

/**
 * Minimal Promise-based HTTP/HTTPS request helper (retries transient network errors).
 * @param {string} url    Full URL
 * @param {string} method HTTP method (GET, POST, …)
 * @param {object|null} body  JSON-serialisable body, or null
 * @returns {Promise<{status: number, body: any}>}
 */
function requestOnce(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    const payload = body != null ? JSON.stringify(body) : null;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(API_KEY ? { 'X-OpsTwin-Key': API_KEY } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = transport.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let parsedBody;
        try { parsedBody = JSON.parse(raw); } catch { parsedBody = raw; }
        resolve({ status: res.statusCode, body: parsedBody });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const RETRYABLE_NET = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ECONNABORTED']);

async function request(url, method = 'GET', body = null, retries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await requestOnce(url, method, body);
    } catch (err) {
      lastErr = err;
      const code = err && err.code;
      if (!RETRYABLE_NET.has(code) || attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr;
}

function installLoopSafetyHandlers() {
  process.on('unhandledRejection', (err) => {
    const msg = err && err.message ? err.message : String(err);
    printWarn(`Background error (loop continues): ${msg}`);
  });
  process.on('uncaughtException', (err) => {
    const msg = err && err.message ? err.message : String(err);
    if (RETRYABLE_NET.has(err && err.code)) {
      printWarn(`Transient network error (loop continues): ${msg}`);
      return;
    }
    printErr(`Fatal error: ${msg}`);
    process.exit(1);
  });
}

function safeInterval(fn, ms, label) {
  setInterval(() => {
    Promise.resolve()
      .then(fn)
      .catch((err) => {
        printWarn(`${label}: ${err && err.message ? err.message : err}`);
      });
  }, ms);
}

// ── Stack context collector ───────────────────────────────────────────────────

function walkDir(dir, cb) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, cb);
    else cb(full);
  }
}

/**
 * Scan project cwd and build stack context from repo + audit JSON.
 * Writes .ops/context/manifest.json and returns the context object.
 */
function collectStackContext(cwd, auditJson) {
  const ctx = {
    frontend: { changedFiles: [] },
    backend: { changedFiles: [], apiRoutes: [] },
    database: {},
    tests: { failed: [], passed: 0, failedCount: 0 },
    git: {},
  };

  const pkgPath = path.join(cwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.dependencies?.next || pkg.devDependencies?.next) ctx.frontend.framework = 'next';
      else if (pkg.dependencies?.react || pkg.devDependencies?.react) ctx.frontend.framework = 'react';
      else if (pkg.dependencies?.vue) ctx.frontend.framework = 'vue';
    } catch { /* ignore */ }
  }

  const appDir = path.join(cwd, 'src', 'app');
  if (fs.existsSync(appDir)) {
    walkDir(appDir, (filePath) => {
      const rel = path.relative(cwd, filePath).replace(/\\/g, '/');
      if (rel.includes('/api/') && (rel.endsWith('route.ts') || rel.endsWith('route.js'))) {
        ctx.backend.apiRoutes.push(rel);
      } else if (rel.endsWith('page.tsx') || rel.endsWith('page.jsx')) {
        ctx.frontend.routes = ctx.frontend.routes || [];
        ctx.frontend.routes.push(rel);
      }
    });
  }

  const schemaPath = path.join(cwd, 'prisma', 'schema.prisma');
  if (fs.existsSync(schemaPath)) {
    ctx.database.orm = 'prisma';
    const schema = fs.readFileSync(schemaPath, 'utf8');
    ctx.database.models = [...schema.matchAll(/^model\s+(\w+)/gm)].map((m) => m[1]);
    const migDir = path.join(cwd, 'prisma', 'migrations');
    ctx.database.migrationsPending =
      !fs.existsSync(migDir) || fs.readdirSync(migDir).filter((f) => !f.startsWith('.')).length === 0;
  }

  const changed = (auditJson.files_changed || []).map((f) => f.path || f);
  for (const p of changed) {
    if (/\.(tsx|jsx|vue|css|scss)$/.test(p) || (p.includes('src/app/') && !p.includes('/api/'))) {
      ctx.frontend.changedFiles.push(p);
    }
    if (p.includes('/api/') || p.endsWith('.py') || p.includes('routes/')) {
      ctx.backend.changedFiles.push(p);
    }
  }

  const tests = auditJson.tests_run || [];
  for (const t of tests) {
    if (t.status === 'pass') ctx.tests.passed += 1;
    if (t.status === 'fail') {
      ctx.tests.failedCount += 1;
      ctx.tests.failed.push(t.name);
    }
  }

  if (auditJson.branch) ctx.git.branch = auditJson.branch;

  const ctxDir = path.join(cwd, '.ops', 'context');
  fs.mkdirSync(ctxDir, { recursive: true });
  fs.writeFileSync(path.join(ctxDir, 'manifest.json'), JSON.stringify(ctx, null, 2));

  return ctx;
}

function findLatestAuditFile() {
  const runsDir = path.join(process.cwd(), '.ops', 'runs');
  if (!fs.existsSync(runsDir)) return null;
  let latest = null;
  let latestMtime = 0;
  walkDir(runsDir, (filePath) => {
    if (!filePath.endsWith('.json')) return;
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs > latestMtime) {
      latestMtime = stat.mtimeMs;
      latest = filePath;
    }
  });
  return latest;
}

function parseCliFlags(argv) {
  const flags = {
    yes: false,
    noDispatch: false,
    proposal: null,
    autoPropose: true,
    autoRun: false,
    noAutoRun: false,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--yes' || a === '-y') flags.yes = true;
    else if (a === '--no-dispatch') flags.noDispatch = true;
    else if (a === '--auto-run') flags.autoRun = true;
    else if (a === '--no-auto-run') flags.noAutoRun = true;
    else if (a === '--proposal' && argv[i + 1]) {
      flags.proposal = argv[++i];
    } else if (a === '--no-auto-propose') flags.autoPropose = false;
    else positional.push(a);
  }
  return { flags, positional };
}

function resolveOpstwinRoot() {
  if (LOCAL_CONFIG.opstwinRoot && fs.existsSync(LOCAL_CONFIG.opstwinRoot)) {
    return LOCAL_CONFIG.opstwinRoot;
  }
  const sibling = path.join(__dirname, '..');
  if (fs.existsSync(path.join(sibling, 'scripts', 'cursor-agent-run.mjs'))) {
    return path.resolve(sibling);
  }
  if (fs.existsSync(path.join(__dirname, 'scripts', 'cursor-agent-run.mjs'))) {
    return path.resolve(__dirname);
  }
  return null;
}

function isAutoRunEnabled(flags) {
  if (flags?.noAutoRun) return false;
  if (flags?.autoRun) return true;
  if (LOCAL_CONFIG.autoRunCursor === true) return true;
  if (process.env.OPSTWIN_AUTO_RUN === 'true') return true;
  return false;
}

function hasCursorApiKey() {
  return !!(process.env.CURSOR_API_KEY || LOCAL_CONFIG.cursorApiKey);
}

async function runCursorAgent(promptFile, taskId) {
  if (!hasCursorApiKey()) {
    printErr('CURSOR_API_KEY not set — get one at https://cursor.com/settings');
    printHint('PowerShell: $env:CURSOR_API_KEY="your-key"');
    return false;
  }

  const root = resolveOpstwinRoot();
  const runner = root
    ? path.join(root, 'scripts', 'cursor-agent-run.mjs')
    : null;
  if (!runner || !fs.existsSync(runner)) {
    printErr('cursor-agent-run.mjs not found. Run opstwin-init from the OpsTwin repo.');
    printHint('Or set opstwinRoot in .ops/opstwin.config.json');
    return false;
  }

  const absPrompt = path.resolve(promptFile || path.join(process.cwd(), '.ops', 'dispatch', 'pending-prompt.md'));
  if (!fs.existsSync(absPrompt)) {
    printErr(`Prompt file missing: ${absPrompt}`);
    return false;
  }

  printHeader('Running Cursor agent');
  printHint('This may take several minutes…');

  const { spawnSync } = require('child_process');
  const nodePath = root ? path.join(root, 'node_modules') : '';
  const result = spawnSync(process.execPath, [runner, absPrompt], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      CURSOR_API_KEY: process.env.CURSOR_API_KEY || LOCAL_CONFIG.cursorApiKey,
      ...(nodePath ? { NODE_PATH: nodePath } : {}),
    },
    encoding: 'utf8',
  });

  if (result.stderr) process.stderr.write(result.stderr);
  if (result.stdout) process.stdout.write(result.stdout);

  if (result.status !== 0) {
    printErr('Cursor agent run failed');
    return false;
  }

  let parsed;
  try {
    const lines = (result.stdout || '').trim().split('\n').filter(Boolean);
    parsed = JSON.parse(lines[lines.length - 1]);
  } catch {
    parsed = null;
  }

  const auditPath = parsed?.auditPath || findLatestAuditFile();
  if (auditPath && taskId) {
    printOk('Uploading audit to OpsTwin…');
    const uploadResult = await uploadFile(auditPath, taskId, false, { autoPropose: true });
    if (uploadResult?.proposal?.id) {
      printOk(`Draft proposal ready: ${uploadResult.proposal.id}`);
    }
  }

  printOk('Cursor agent run complete');
  return true;
}

let agentRunning = false;

async function pollRunRequests(taskId) {
  if (agentRunning) return;
  let res;
  try {
    res = await request(`${BASE_URL}/api/cli/run-request?taskId=${encodeURIComponent(taskId)}`);
  } catch (err) {
    printWarn(`Run-request poll failed: ${err.message}`);
    return;
  }
  if (res.status !== 200 || !res.body?.pending) return;

  const { id, prompt } = res.body.pending;
  agentRunning = true;
  try {
    try {
      await request(`${BASE_URL}/api/cli/run-request/${encodeURIComponent(id)}`, 'PATCH', {
        status: 'running',
      });
    } catch (err) {
      printWarn(`Could not mark run ${id.slice(0, 8)}… as running: ${err.message}`);
      return;
    }

    const dispatchDir = path.join(process.cwd(), '.ops', 'dispatch');
    fs.mkdirSync(dispatchDir, { recursive: true });
    const promptFile = path.join(dispatchDir, 'pending-prompt.md');
    fs.writeFileSync(promptFile, prompt, 'utf8');

    printHeader('Dashboard queued Cursor run');
    const ok = await runCursorAgent(promptFile, taskId);
    try {
      await request(`${BASE_URL}/api/cli/run-request/${encodeURIComponent(id)}`, 'PATCH', {
        status: ok ? 'completed' : 'failed',
        error: ok ? undefined : 'Cursor agent failed',
      });
    } catch (err) {
      printWarn(`Could not update run status: ${err.message}`);
    }
  } finally {
    agentRunning = false;
  }
}

async function cmdDisconnectCli(taskIdArg) {
  const taskId = (taskIdArg || DEFAULT_TASK_ID || '').trim();
  if (!taskId) {
    printErr('Usage: node opstwin-cli.js disconnect [taskId]');
    process.exit(1);
  }
  try {
    const res = await request(`${BASE_URL}/api/cli/disconnect`, 'POST', { taskId });
    if (res.status === 200) {
      printOk(`Disconnected CLI for task ${taskId}`);
    } else {
      printWarn(`Server: HTTP ${res.status}`);
    }
  } catch (err) {
    printWarn(`Server unreachable: ${err.message}`);
  }
  printOk('Stopped sending heartbeats from this terminal (Ctrl+C if daemon is still running)');
}

async function cmdRunAgent(promptFileArg) {
  const taskId = DEFAULT_TASK_ID;
  if (!taskId) {
    printErr('Set task: node opstwin-cli.js connect <taskId>');
    process.exit(1);
  }
  const ok = await runCursorAgent(promptFileArg, taskId);
  process.exit(ok ? 0 : 1);
}

// ── Commands ─────────────────────────────────────────────────────────────────

/**
 * watch — Recursively watch .ops/runs for new *.json files and upload each once.
 */
function startAuditWatcher(taskId, onUploaded) {
  const watchDir = path.join(process.cwd(), '.ops', 'runs');

  if (!fs.existsSync(watchDir)) {
    fs.mkdirSync(watchDir, { recursive: true });
  }

  const uploaded = new Set();
  const debounce = {};

  function handleFile(filePath) {
    if (!filePath.endsWith('.json')) return;
    if (uploaded.has(filePath)) return;

    clearTimeout(debounce[filePath]);
    debounce[filePath] = setTimeout(async () => {
      if (uploaded.has(filePath)) return;
      uploaded.add(filePath);
      delete debounce[filePath];
      try {
        const result = await uploadFile(filePath, taskId, false, { autoPropose: true });
        if (result && typeof onUploaded === 'function') onUploaded(result);
      } catch (err) {
        printWarn(`Audit upload failed: ${err.message}`);
      }
    }, 300);
  }

  fs.watch(watchDir, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const full = path.join(watchDir, filename);
    if (fs.existsSync(full)) handleFile(full);
  });

  return watchDir;
}

async function cmdWatch() {
  const taskId = DEFAULT_TASK_ID;
  if (!taskId) {
    printWarn('OPSTWIN_TASK_ID not set — run: node opstwin-cli.js connect <taskId>');
    printHint('Or use autopilot: node opstwin-cli.js daemon <taskId>');
  }

  printHeader('OpsTwin Watch');
  const watchDir = startAuditWatcher(taskId, (result) => {
    if (result?.proposal?.id) {
      printOk(`Draft proposal created: ${result.proposal.id} — review in dashboard`);
    }
  });
  printOk(`Watching ${watchDir}`);
  printHint(`Server: ${BASE_URL}  Task: ${taskId || '(not set)'}`);
  printHint('Tip: use "node opstwin-cli.js daemon" for watch + auto-delivery');
  process.stdin.resume();
}

/**
 * upload — Read a JSON file and POST it to OpsTwin.
 * @param {string} filePath   Absolute or relative path to the run JSON file
 * @param {string} taskId     OpsTwin task ID
 * @param {boolean} quiet     Suppress verbose output when called from watch
 */
async function uploadFile(filePath, taskId, quiet = false, options = {}) {
  const abs = path.resolve(filePath);
  const autoPropose = options.autoPropose !== false;

  if (!fs.existsSync(abs)) {
    console.error(`[opstwin] File not found: ${abs}`);
    return null;
  }

  let auditJson;
  try {
    auditJson = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    console.error(`[opstwin] Failed to parse JSON from ${abs}: ${err.message}`);
    return null;
  }

  const stackContext = collectStackContext(process.cwd(), auditJson);

  // Merge terminal capture if present
  const terminalFile = path.join(process.cwd(), '.ops', 'terminal', 'latest.json');
  if (fs.existsSync(terminalFile)) {
    try {
      const term = JSON.parse(fs.readFileSync(terminalFile, 'utf8'));
      auditJson.terminal_output = auditJson.terminal_output || [];
      auditJson.terminal_output.push({
        command: term.command,
        exit_code: term.exit_code ?? term.exitCode ?? 1,
        stdout: (term.stdout || '').slice(0, 10000),
        stderr: (term.stderr || '').slice(0, 10000),
      });
    } catch { /* ignore */ }
  }

  const effectiveTaskId = taskId || DEFAULT_TASK_ID || auditJson.taskId;
  if (!effectiveTaskId) {
    console.error(`[opstwin] No taskId provided and OPSTWIN_TASK_ID is not set.`);
    return null;
  }

  if (!quiet) {
    console.log(`[opstwin] Uploading ${path.basename(abs)} → task ${effectiveTaskId} …`);
  }

  let res;
  try {
    res = await request(`${BASE_URL}/api/runs`, 'POST', {
      action: 'upload_audit',
      taskId: effectiveTaskId,
      auditJson,
      stackContext,
      autoPropose,
    });
  } catch (err) {
    console.error(`[opstwin] Network error: ${err.message}`);
    return null;
  }

  if (res.status >= 200 && res.status < 300) {
    const run = res.body?.run || res.body;
    const blockers  = run?.blockers?.length ?? res.body?.report?.blockers?.length ?? '?';
    const mismatches = run?.mismatches?.length ?? res.body?.report?.mismatches?.length ?? '?';
    const prompt = res.body?.focusedRerunPrompt
      ? res.body.focusedRerunPrompt.slice(0, 200)
      : '(none)';
    console.log(`[opstwin] ✓ Uploaded  blockers=${blockers}  mismatches=${mismatches}`);
    if (res.body?.proposal?.id) {
      console.log(`[opstwin] Draft proposal: ${res.body.proposal.id}`);
      console.log(`[opstwin] Next: node opstwin-cli.js next --proposal ${res.body.proposal.id} --yes`);
    }
    if (!quiet) {
      console.log(`[opstwin] focusedRerunPrompt (first 200 chars):\n  ${prompt}`);
    }
    return res.body;
  } else {
    console.error(`[opstwin] ✗ Upload failed  HTTP ${res.status}:`, JSON.stringify(res.body));
    return null;
  }
}

/**
 * status — GET last run for a task and print a summary.
 */
async function cmdStatus(taskId) {
  const id = taskId || DEFAULT_TASK_ID;
  if (!id) {
    console.error('[opstwin] Provide a taskId as an argument or set OPSTWIN_TASK_ID.');
    process.exit(1);
  }

  let res;
  try {
    res = await request(`${BASE_URL}/api/runs?taskId=${encodeURIComponent(id)}`);
  } catch (err) {
    console.error(`[opstwin] Network error: ${err.message}`);
    process.exit(1);
  }

  if (res.status !== 200) {
    console.error(`[opstwin] HTTP ${res.status}:`, JSON.stringify(res.body));
    process.exit(1);
  }

  const runs = Array.isArray(res.body) ? res.body
             : Array.isArray(res.body?.runs) ? res.body.runs
             : [];

  if (runs.length === 0) {
    console.log(`[opstwin] No runs found for task ${id}`);
    return;
  }

  const last = runs[0]; // most recent first
  console.log(`Task:        ${id}`);
  console.log(`Run ID:      ${last.id || '—'}`);
  console.log(`Status:      ${last.status || '—'}`);
  console.log(`Confidence:  ${last.confidence != null ? last.confidence + '%' : '—'}`);
  console.log(`Branch:      ${last.branch || '—'}`);
  console.log(`Finished at: ${last.finishedAt || last.createdAt || '—'}`);
}

/**
 * rerun — Print the focusedRerunPrompt for a run so Cursor can paste it.
 */
async function cmdRerun(taskId) {
  // First fetch the task to find the latest run ID
  const id = taskId || DEFAULT_TASK_ID;
  if (!id) {
    console.error('[opstwin] Provide a taskId as an argument or set OPSTWIN_TASK_ID.');
    process.exit(1);
  }

  let listRes;
  try {
    listRes = await request(`${BASE_URL}/api/runs?taskId=${encodeURIComponent(id)}`);
  } catch (err) {
    console.error(`[opstwin] Network error: ${err.message}`);
    process.exit(1);
  }

  const runs = Array.isArray(listRes.body) ? listRes.body
             : Array.isArray(listRes.body?.runs) ? listRes.body.runs
             : [];

  if (runs.length === 0) {
    console.log(`[opstwin] No runs found for task ${id}`);
    return;
  }

  const runId = runs[0].id;

  let runRes;
  try {
    runRes = await request(`${BASE_URL}/api/runs/${encodeURIComponent(runId)}`);
  } catch (err) {
    console.error(`[opstwin] Network error: ${err.message}`);
    process.exit(1);
  }

  if (runRes.status !== 200) {
    console.error(`[opstwin] HTTP ${runRes.status}:`, JSON.stringify(runRes.body));
    process.exit(1);
  }

  const run = runRes.body?.run || runRes.body;
  const prompt = run?.focusedRerunPrompt;

  if (!prompt) {
    console.log('[opstwin] No focusedRerunPrompt available for this run.');
    return;
  }

  // Print directly to stdout so it can be piped / copied
  process.stdout.write(prompt + '\n');
}

/**
 * memory — Show top 5 memory entries.
 */
async function cmdMemory() {
  let res;
  try {
    res = await request(`${BASE_URL}/api/memory`);
  } catch (err) {
    console.error(`[opstwin] Network error: ${err.message}`);
    process.exit(1);
  }

  if (res.status !== 200) {
    console.error(`[opstwin] HTTP ${res.status}:`, JSON.stringify(res.body));
    process.exit(1);
  }

  const entries = Array.isArray(res.body) ? res.body
                : Array.isArray(res.body?.entries) ? res.body.entries
                : [];

  if (entries.length === 0) {
    console.log('[opstwin] No memory entries found.');
    return;
  }

  const top5 = entries.slice(0, 5);
  console.log(`Top ${top5.length} memory entries:\n`);
  top5.forEach((e, i) => {
    console.log(`${i + 1}. taskType:             ${e.taskType || '—'}`);
    console.log(`   successRate:          ${e.successRate != null ? (e.successRate * 100).toFixed(1) + '%' : '—'}`);
    console.log(`   improvementSuggestion: ${e.improvementSuggestion || '—'}`);
    console.log('');
  });
}

/**
 * run — Execute a shell command and save output to .ops/terminal/latest.json
 */
function cmdRun(args) {
  if (!args.length) {
    console.error('[opstwin] Usage: node opstwin-cli.js run <command...>');
    process.exit(1);
  }
  const { execSync } = require('child_process');
  const command = args.join(' ');
  let stdout = '';
  let stderr = '';
  let exitCode = 0;
  try {
    stdout = execSync(command, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], shell: true });
  } catch (err) {
    exitCode = err.status ?? 1;
    stdout = err.stdout || '';
    stderr = err.stderr || err.message || '';
  }
  const terminalDir = path.join(process.cwd(), '.ops', 'terminal');
  fs.mkdirSync(terminalDir, { recursive: true });
  const payload = {
    command,
    exit_code: exitCode,
    stdout: stdout.slice(0, 50000),
    stderr: stderr.slice(0, 50000),
    capturedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(terminalDir, 'latest.json'), JSON.stringify(payload, null, 2));
  console.log(`[opstwin] exit=${exitCode}  saved → .ops/terminal/latest.json`);
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  process.exit(exitCode);
}

async function fetchProposalsForTask(taskId) {
  const res = await request(`${BASE_URL}/api/prompts?taskId=${encodeURIComponent(taskId)}`);
  if (res.status !== 200) {
    return { proposals: [], error: res.body?.error ?? `HTTP ${res.status}` };
  }
  return { proposals: res.body?.proposals ?? [] };
}

function pickDispatchableProposal(proposals) {
  const byDate = [...proposals].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  return (
    byDate.find((p) => p.status === 'approved' || p.status === 'draft')
    ?? byDate.find((p) => p.status === 'dispatched')
    ?? byDate[0]
    ?? null
  );
}

async function resolveProposalId(inputId) {
  const id = (inputId || DEFAULT_TASK_ID || '').trim();
  if (!id) {
    return { error: 'no_id' };
  }

  const probe = await request(`${BASE_URL}/api/prompts/${encodeURIComponent(id)}`);
  if (probe.status === 200 && probe.body?.proposal?.id) {
    return {
      proposalId: probe.body.proposal.id,
      taskId: probe.body.proposal.taskId,
      resolvedAs: 'proposal',
      proposal: probe.body.proposal,
    };
  }

  const { proposals, error } = await fetchProposalsForTask(id);
  if (proposals.length === 0) {
    return { error: 'no_proposals', taskId: id, listError: error };
  }

  const picked = pickDispatchableProposal(proposals);
  if (!picked) {
    return { error: 'no_proposals', taskId: id };
  }

  return {
    proposalId: picked.id,
    taskId: id,
    resolvedAs: 'task',
    proposal: picked,
  };
}

function writeDispatchFiles(prompt) {
  const dispatchDir = path.join(process.cwd(), '.ops', 'dispatch');
  fs.mkdirSync(dispatchDir, { recursive: true });
  const primary = path.join(dispatchDir, 'pending-prompt.md');
  fs.writeFileSync(primary, prompt, 'utf8');
  printOk(`Dispatched → ${primary}`);
  const cursorDir = path.join(process.cwd(), '.cursor');
  if (fs.existsSync(cursorDir)) {
    fs.writeFileSync(path.join(cursorDir, 'pending-task.md'), prompt, 'utf8');
    printOk('Also written → .cursor/pending-task.md');
  }
  printHint('Open Cursor in this folder — agent reads pending-prompt.md per .opstwin/rules.md');
}

/**
 * connect — Save task ID (+ URL) to .ops/opstwin.config.json
 */
async function cmdConnect(taskId) {
  if (!taskId) {
    printErr('Usage: node opstwin-cli.js connect <taskId>');
    process.exit(1);
  }

  printHeader('OpsTwin Connect');

  let tasksRes;
  try {
    tasksRes = await request(`${BASE_URL}/api/tasks`);
  } catch (err) {
    printErr(`Network error: ${err.message}`);
    printHint(`Is OpsTwin running at ${BASE_URL}? Run: npm run dev`);
    process.exit(1);
  }

  if (tasksRes.status !== 200) {
    printErr(`Cannot reach OpsTwin (HTTP ${tasksRes.status})`);
    process.exit(1);
  }

  const tasks = tasksRes.body?.tasks ?? [];
  const found = tasks.find((t) => t.id === taskId);
  if (!found) {
    printWarn(`Task ${taskId} not found in dashboard — saving anyway.`);
  } else {
    printOk(`Linked to task: ${found.title}`);
  }

  const opstwinRoot = resolveOpstwinRoot();
  saveLocalConfig({
    url: BASE_URL,
    taskId,
    ...(opstwinRoot ? { opstwinRoot } : {}),
  });
  printOk(`Saved → .ops/opstwin.config.json`);
  printCmdBlock('Watch + deliver (PowerShell):', [
    `node opstwin-cli.js daemon ${taskId}`,
  ]);
  printCmdBlock('Full loop — Cursor runs automatically (PowerShell):', [
    '$env:CURSOR_API_KEY="your-key"',
    `node opstwin-cli.js loop ${taskId}`,
  ]);
}

/**
 * proposals — List proposals for a task
 */
async function cmdProposals(taskId) {
  const id = (taskId || DEFAULT_TASK_ID || '').trim();
  if (!id) {
    printErr('Provide taskId or run: node opstwin-cli.js connect <taskId>');
    process.exit(1);
  }

  printHeader('OpsTwin Proposals');
  printHint(`Task: ${id}`);
  printHint(`Server: ${BASE_URL}\n`);

  const { proposals, error } = await fetchProposalsForTask(id);
  if (error) {
    printErr(`Failed to list proposals: ${error}`);
    process.exit(1);
  }

  if (proposals.length === 0) {
    printWarn('No proposals yet.');
    printHint('In OpsTwin UI: MVP Plan → Propose Next Prompt');
    printCmdBlock('Or create one from CLI (PowerShell):', [
      'node opstwin-cli.js next --yes',
    ]);
    return;
  }

  for (const p of proposals) {
    const mark = p.status === 'approved' ? `${GREEN}●${RESET}` : `${DIM}○${RESET}`;
    console.log(`  ${mark} ${p.id}  [${p.status}]  ${new Date(p.createdAt).toLocaleString()}`);
  }

  const picked = pickDispatchableProposal(proposals);
  if (picked) {
    printCmdBlock('Dispatch latest (PowerShell):', [
      `node opstwin-cli.js dispatch ${picked.id}`,
      'node opstwin-cli.js dispatch',
    ]);
  }
}

/**
 * dispatch — Fetch approved prompt and write to .ops/dispatch/pending-prompt.md
 */
async function cmdDispatch(idOrTaskId) {
  printHeader('OpsTwin Dispatch');

  let resolved;
  try {
    resolved = await resolveProposalId(idOrTaskId);
  } catch (err) {
    printErr(`Network error: ${err.message}`);
    printHint(`Is OpsTwin running at ${BASE_URL}?`);
    process.exit(1);
  }

  if (resolved.error === 'no_id') {
    printErr('No proposal or task ID provided.');
    printHint('Copy your task ID from OpsTwin (?task=...) then run:');
    printCmdBlock('Step 1 — connect this repo (PowerShell):', [
      'node opstwin-cli.js connect YOUR_TASK_ID',
    ]);
    printCmdBlock('Step 2 — dispatch (PowerShell):', [
      'node opstwin-cli.js dispatch',
    ]);
    process.exit(1);
  }

  if (resolved.error === 'no_proposals') {
    printErr(`No proposals found for task ${resolved.taskId}.`);
    if (resolved.taskId !== idOrTaskId && idOrTaskId) {
      printHint(`"${idOrTaskId}" is not a proposal ID — it may be your task ID.`);
      printHint('Use "node opstwin-cli.js dispatch" (no args) after connect, or run next --yes.');
    }
    printHint('In OpsTwin UI: MVP Plan → Propose Next Prompt → Approve');
    printCmdBlock('Or all-in-one (PowerShell):', [
      `node opstwin-cli.js connect ${resolved.taskId}`,
      'node opstwin-cli.js next --yes',
    ]);
    process.exit(1);
  }

  if (resolved.resolvedAs === 'task') {
    printWarn(`"${resolved.taskId}" is a task ID, not a proposal ID.`);
    printOk(`Using latest proposal: ${resolved.proposalId} (${resolved.proposal.status})`);
  } else {
    printOk(`Proposal: ${resolved.proposalId} (${resolved.proposal.status})`);
  }

  let res;
  try {
    res = await request(
      `${BASE_URL}/api/prompts/${encodeURIComponent(resolved.proposalId)}/dispatch`,
      'POST',
    );
  } catch (err) {
    printErr(`Network error: ${err.message}`);
    process.exit(1);
  }

  if (res.status !== 200) {
    printErr(`HTTP ${res.status}: ${JSON.stringify(res.body)}`);
    if (res.status === 404) {
      printHint('Proposal missing on server — create a new one: node opstwin-cli.js next --yes');
    }
    process.exit(1);
  }

  const prompt = res.body?.prompt;
  if (!prompt) {
    printErr('No prompt in response');
    process.exit(1);
  }

  writeDispatchFiles(prompt);
}

async function sendHeartbeat(taskId, autoRun = false) {
  try {
    const res = await request(`${BASE_URL}/api/cli/heartbeat`, 'POST', {
      taskId,
      repoPath: process.cwd(),
      mode: 'daemon',
      pid: process.pid,
      autoRun: autoRun || isAutoRunEnabled({}),
    });
    if (res.status === 200) {
      printOk('Dashboard link active (CLI connected)');
      return true;
    }
    printWarn(`Heartbeat HTTP ${res.status}: ${JSON.stringify(res.body)}`);
    if (res.status === 401) {
      printHint('Set OPSTWIN_API_KEY if server auth is enabled');
    }
    return false;
  } catch (err) {
    printErr(`Cannot reach OpsTwin at ${BASE_URL}: ${err.message}`);
    printHint('Start the server: cd opstwin && npm run dev');
    return false;
  }
}

async function pollPendingDeliveries(taskId, flags = {}) {
  let res;
  try {
    res = await request(`${BASE_URL}/api/prompts/pending?taskId=${encodeURIComponent(taskId)}`);
  } catch (err) {
    printWarn(`Delivery poll failed: ${err.message}`);
    return 0;
  }
  if (res.status !== 200) {
    printWarn(`Delivery poll HTTP ${res.status}`);
    return 0;
  }

  const pending = res.body?.pending ?? [];
  const promptFile = path.join(process.cwd(), '.ops', 'dispatch', 'pending-prompt.md');
  const autoRun = isAutoRunEnabled(flags);

  for (const item of pending) {
    const id = item.proposal?.id;
    const prompt = item.prompt;
    if (!id || !prompt) continue;
    writeDispatchFiles(prompt);
    let delivered;
    try {
      delivered = await request(`${BASE_URL}/api/prompts/${encodeURIComponent(id)}/delivered`, 'POST');
    } catch (err) {
      printWarn(`Could not mark delivered ${id.slice(0, 12)}…: ${err.message}`);
      continue;
    }
    if (delivered.status !== 200) {
      printWarn(`Could not mark delivered ${id.slice(0, 12)}… HTTP ${delivered.status}`);
      continue;
    }
    printOk(`Auto-delivered proposal ${id.slice(0, 12)}… → .ops/dispatch/pending-prompt.md`);

    if (autoRun && hasCursorApiKey()) {
      printOk('Auto-run: starting Cursor agent…');
      await runCursorAgent(promptFile, taskId);
    } else if (autoRun) {
      printWarn('Auto-run skipped — set CURSOR_API_KEY');
    } else {
      console.log('');
      printHint('Run in Cursor: node opstwin-cli.js run-agent');
      printHint('Or start daemon with: node opstwin-cli.js loop <taskId>');
      console.log('');
    }
  }
  return pending.length;
}

/**
 * daemon — Autopilot: watch audits + heartbeat + auto-deliver dispatched prompts
 */
async function cmdDaemon(taskIdArg, flags = {}) {
  installLoopSafetyHandlers();

  const taskId = (taskIdArg || DEFAULT_TASK_ID || '').trim();
  if (!taskId) {
    printHeader('OpsTwin Autopilot');
    printErr('Task ID required.');
    printCmdBlock('Full automation (PowerShell):', [
      '$env:CURSOR_API_KEY="your-key-from-cursor.com/settings"',
      'node opstwin-cli.js loop YOUR_TASK_ID',
    ]);
    process.exit(1);
  }

  const autoRun = isAutoRunEnabled(flags);
  const opstwinRoot = resolveOpstwinRoot();
  saveLocalConfig({
    url: BASE_URL,
    taskId,
    autoRunCursor: autoRun,
    ...(opstwinRoot ? { opstwinRoot } : {}),
  });

  printHeader(autoRun ? 'OpsTwin Full Loop — RUNNING' : 'OpsTwin Autopilot — RUNNING');
  printOk(`Task:   ${taskId}`);
  printOk(`Server: ${BASE_URL}`);
  printOk(`Repo:   ${process.cwd()}`);
  const isOpstwinServerRepo =
    fs.existsSync(path.join(process.cwd(), 'opstwin-cli.js')) &&
    fs.existsSync(path.join(process.cwd(), 'src', 'app', 'api'));
  if (isOpstwinServerRepo) {
    printWarn('You are in the OpsTwin server repo — run loop from YOUR project folder instead');
    printHint('Example: cd D:\\navgo\\erpnext && node path\\to\\opstwin-cli.js loop ' + taskId);
  }
  if (process.env.TERM_PROGRAM === 'vscode' || process.env.CURSOR_TRACE_ID) {
    printHint('Tip: run loop in an external PowerShell window (not Cursor terminal) for SDK local agents');
  }
  if (autoRun) {
    printOk(`Mode:   deliver + run Cursor + upload audit + propose next`);
    if (!hasCursorApiKey()) {
      printWarn('CURSOR_API_KEY missing — auto-run will not start agents');
    }
  } else {
    printHint('Add --auto-run or use: node opstwin-cli.js loop <taskId>');
  }
  console.log('');
  printHint('Dashboard: approve → CLI delivers → (optional) Cursor runs automatically');
  printHint('Press Ctrl+C to stop\n');

  await sendHeartbeat(taskId, autoRun);

  try {
    startAuditWatcher(taskId, (result) => {
      printOk('Audit uploaded to OpsTwin');
      if (result?.proposal?.id) {
        printOk(`Draft proposal ready in dashboard (${result.proposal.id.slice(0, 12)}…)`);
      }
    });
    printOk('Watching .ops/runs/ for agent audits');
  } catch (err) {
    printErr(`Watch failed: ${err.message}`);
    process.exit(1);
  }

  const delivered = await pollPendingDeliveries(taskId, flags);
  if (delivered > 0) {
    printOk(`Processed ${delivered} pending prompt(s) on startup`);
  }

  safeInterval(() => sendHeartbeat(taskId, autoRun), 15000, 'Heartbeat');
  safeInterval(() => pollPendingDeliveries(taskId, flags), 3000, 'Delivery poll');
  safeInterval(() => pollRunRequests(taskId), 4000, 'Run-request poll');

  process.stdin.resume();
}

/** loop — daemon with auto-run (full OpsTwin ↔ Cursor automation) */
async function cmdLoop(taskIdArg) {
  await cmdDaemon(taskIdArg, { autoRun: true });
}

/**
 * terminal — Upload .ops/terminal/latest.json to a run
 */
async function cmdTerminalUpload(runId) {
  if (!runId) {
    console.error('[opstwin] Usage: node opstwin-cli.js terminal <runId>');
    process.exit(1);
  }
  const terminalFile = path.join(process.cwd(), '.ops', 'terminal', 'latest.json');
  if (!fs.existsSync(terminalFile)) {
    console.error('[opstwin] No .ops/terminal/latest.json — run: node opstwin-cli.js run npm test');
    process.exit(1);
  }
  const term = JSON.parse(fs.readFileSync(terminalFile, 'utf8'));
  const res = await request(`${BASE_URL}/api/runs/${encodeURIComponent(runId)}/terminal`, 'POST', {
    command: term.command,
    exitCode: term.exit_code ?? term.exitCode ?? 0,
    stdout: term.stdout || '',
    stderr: term.stderr || '',
  });
  if (res.status >= 200 && res.status < 300) {
    console.log('[opstwin] ✓ Terminal log uploaded');
  } else {
    console.error(`[opstwin] ✗ HTTP ${res.status}:`, JSON.stringify(res.body));
  }
}

/**
 * screenshot — Upload a PNG/JPG to a run
 */
async function cmdScreenshot(runId, filePath, label) {
  if (!runId || !filePath) {
    console.error('[opstwin] Usage: node opstwin-cli.js screenshot <runId> <image-file> [label]');
    process.exit(1);
  }
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    console.error(`[opstwin] File not found: ${abs}`);
    process.exit(1);
  }
  const ext = path.extname(abs).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  const b64 = fs.readFileSync(abs).toString('base64');
  const dataUrl = `data:${mime};base64,${b64}`;
  const res = await request(`${BASE_URL}/api/runs/${encodeURIComponent(runId)}/screenshots`, 'POST', {
    label: label || path.basename(abs),
    dataUrl,
  });
  if (res.status >= 200 && res.status < 300) {
    console.log('[opstwin] ✓ Screenshot uploaded');
  } else {
    console.error(`[opstwin] ✗ HTTP ${res.status}:`, JSON.stringify(res.body));
  }
}

/**
 * next — Propose → approve → dispatch → write pending-prompt.md
 */
async function cmdNext(argv) {
  const { flags, positional } = parseCliFlags(argv);
  const taskId = positional[0] || DEFAULT_TASK_ID;

  if (flags.proposal) {
    if (!flags.yes) {
      console.log(`[opstwin] Dispatch proposal ${flags.proposal}? Run with --yes to confirm.`);
      return;
    }
    await cmdDispatch(flags.proposal);
    return;
  }

  if (!taskId) {
    console.error('[opstwin] Provide taskId or set OPSTWIN_TASK_ID.');
    process.exit(1);
  }

  if (!flags.yes) {
    console.log('[opstwin] Will propose, approve, and dispatch. Re-run with --yes to confirm.');
    console.log('[opstwin] Or use --no-dispatch to propose only.');
    return;
  }

  let proposeRes;
  try {
    proposeRes = await request(`${BASE_URL}/api/prompts/propose`, 'POST', { taskId });
  } catch (err) {
    console.error(`[opstwin] Network error: ${err.message}`);
    process.exit(1);
  }

  if (proposeRes.status !== 201) {
    console.error(`[opstwin] Propose failed HTTP ${proposeRes.status}:`, JSON.stringify(proposeRes.body));
    process.exit(1);
  }

  const proposalId = proposeRes.body?.proposal?.id;
  if (!proposalId) {
    console.error('[opstwin] No proposal id in response');
    process.exit(1);
  }

  console.log(`[opstwin] ✓ Proposed ${proposalId} (${proposeRes.body?.source ?? 'rules'})`);

  if (flags.noDispatch) {
    console.log('[opstwin] --no-dispatch set; stopping after propose.');
    return;
  }

  const approveRes = await request(`${BASE_URL}/api/prompts/${encodeURIComponent(proposalId)}`, 'PATCH', {
    action: 'approve',
  });
  if (approveRes.status !== 200) {
    console.error(`[opstwin] Approve failed HTTP ${approveRes.status}`);
    process.exit(1);
  }

  await cmdDispatch(proposalId);
}

/**
 * sync — Upload latest audit + prompt file + terminal in one shot
 */
async function cmdSync(argv) {
  const { positional } = parseCliFlags(argv);
  const taskId = positional[0] || DEFAULT_TASK_ID;
  if (!taskId) {
    console.error('[opstwin] Provide taskId or set OPSTWIN_TASK_ID.');
    process.exit(1);
  }

  const auditFile = findLatestAuditFile();
  if (!auditFile) {
    console.error('[opstwin] No audit JSON found under .ops/runs/');
    process.exit(1);
  }

  const uploadResult = await uploadFile(auditFile, taskId, false, { autoPropose: true });
  if (!uploadResult) process.exit(1);

  const inboundFile = path.join(process.cwd(), '.ops', 'prompts', 'inbound.md');
  if (fs.existsSync(inboundFile)) {
    const content = fs.readFileSync(inboundFile, 'utf8').trim();
    if (content.length > 0) {
      const capRes = await request(`${BASE_URL}/api/prompts/capture`, 'POST', {
        taskId,
        content,
        source: 'inbound_file',
      });
      if (capRes.status === 201) {
        console.log('[opstwin] ✓ Captured prompt from inbound.md');
      }
    }
  }

  const runId = uploadResult.run?.id;
  const terminalFile = path.join(process.cwd(), '.ops', 'terminal', 'latest.json');
  if (runId && fs.existsSync(terminalFile)) {
    const term = JSON.parse(fs.readFileSync(terminalFile, 'utf8'));
    await request(`${BASE_URL}/api/runs/${encodeURIComponent(runId)}/terminal`, 'POST', {
      command: term.command,
      exitCode: term.exit_code ?? term.exitCode ?? 0,
      stdout: term.stdout || '',
      stderr: term.stderr || '',
    });
    console.log('[opstwin] ✓ Terminal log synced');
  }

  console.log('[opstwin] ✓ Sync complete');
}

/**
 * prompt-watch — Watch .ops/prompts/inbound.md and POST capture API
 */
async function cmdPromptWatch() {
  const promptFile = path.join(process.cwd(), '.ops', 'prompts', 'inbound.md');
  const promptDir = path.dirname(promptFile);
  fs.mkdirSync(promptDir, { recursive: true });
  if (!fs.existsSync(promptFile)) {
    fs.writeFileSync(promptFile, '# Append agent prompts here (timestamped entries)\n', 'utf8');
  }

  const taskId = DEFAULT_TASK_ID;
  if (!taskId) {
    console.warn('[opstwin] Warning: OPSTWIN_TASK_ID not set. Capture will fail.');
  }

  let lastHash = '';
  const debounce = {};

  console.log(`[opstwin] Watching ${promptFile} …`);

  async function captureIfChanged() {
    if (!fs.existsSync(promptFile)) return;
    const content = fs.readFileSync(promptFile, 'utf8').trim();
    if (!content || content.startsWith('#') && content.split('\n').filter((l) => !l.startsWith('#')).join('').length === 0) return;
    const hash = String(content.length) + content.slice(-80);
    if (hash === lastHash) return;
    lastHash = hash;

    const effectiveTaskId = taskId || DEFAULT_TASK_ID;
    if (!effectiveTaskId) return;

    try {
      const res = await request(`${BASE_URL}/api/prompts/capture`, 'POST', {
        taskId: effectiveTaskId,
        content,
        source: 'inbound_file',
      });
      if (res.status === 201) {
        console.log('[opstwin] ✓ Prompt captured');
      } else {
        console.error(`[opstwin] Capture failed HTTP ${res.status}`);
      }
    } catch (err) {
      console.error(`[opstwin] Capture error: ${err.message}`);
    }
  }

  fs.watch(promptDir, (_event, filename) => {
    if (filename && filename !== 'inbound.md') return;
    clearTimeout(debounce.prompt);
    debounce.prompt = setTimeout(captureIfChanged, 400);
  });

  process.stdin.resume();
}

// ── Help ──────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
opstwin-cli — CLI for the OpsTwin audit dashboard

Usage:
  node opstwin-cli.js watch                   Watch .ops/runs/**/*.json and auto-upload new files
  node opstwin-cli.js upload <file> <taskId>  One-shot upload of a run JSON file
  node opstwin-cli.js status [taskId]         Show last run status for a task
  node opstwin-cli.js rerun  [taskId]         Print focusedRerunPrompt for the last run
  node opstwin-cli.js memory                  Show top 5 memory entries
  node opstwin-cli.js loop [taskId]             Full automation: watch + deliver + run Cursor + audit
  node opstwin-cli.js daemon [taskId] [--auto-run]  Watch + deliver (+ optional Cursor run)
  node opstwin-cli.js run-agent [promptFile]  Run pending-prompt.md in Cursor via SDK
  node opstwin-cli.js disconnect [taskId]     Disconnect CLI session in dashboard
  node opstwin-cli.js connect <taskId>        Save task ID to .ops/opstwin.config.json
  node opstwin-cli.js proposals [taskId]      List proposals for a task
  node opstwin-cli.js dispatch [id]           Write prompt to .ops/dispatch/ (proposal or task ID)
  node opstwin-cli.js run <command...>        Run command, save to .ops/terminal/
  node opstwin-cli.js terminal <runId>        Upload terminal log to a run
  node opstwin-cli.js screenshot <runId> <file> [label]  Upload UI screenshot
  node opstwin-cli.js next [taskId] [--yes] [--no-dispatch] [--proposal <id>]
  node opstwin-cli.js sync [taskId]           Upload audit + prompt + terminal
  node opstwin-cli.js prompt-watch            Watch .ops/prompts/inbound.md
  node opstwin-cli.js help                    Show this help

Environment variables:
  OPSTWIN_URL      Base URL  (default: http://localhost:3000, or .ops/opstwin.config.json)
  OPSTWIN_TASK_ID  Default task ID (or .ops/opstwin.config.json)
  OPSTWIN_API_KEY  API key if server auth is enabled

Local config (recommended):
  node opstwin-cli.js daemon <taskId>   →  watch + auto-deliver (leave running)
  node opstwin-cli.js connect <taskId>  →  writes .ops/opstwin.config.json
`.trim());
}

// ── Entry point ───────────────────────────────────────────────────────────────

const [,, cmd, arg1, arg2, ...rest] = process.argv;

(async () => {
  switch (cmd) {
    case 'watch':
      await cmdWatch();
      break;

    case 'upload':
      if (!arg1) {
        console.error('[opstwin] Usage: node opstwin-cli.js upload <file> [taskId]');
        process.exit(1);
      }
      await uploadFile(arg1, arg2 || '');
      break;

    case 'status':
      await cmdStatus(arg1);
      break;

    case 'rerun':
      await cmdRerun(arg1);
      break;

    case 'memory':
      await cmdMemory();
      break;

    case 'connect':
      await cmdConnect(arg1);
      break;

    case 'daemon':
    case 'autopilot':
      await cmdDaemon(arg1, parseCliFlags([arg2, ...rest]).flags);
      break;

    case 'loop':
      await cmdLoop(arg1);
      break;

    case 'disconnect':
      await cmdDisconnectCli(arg1);
      break;

    case 'run-agent':
      await cmdRunAgent(arg1 && !arg1.startsWith('--') ? arg1 : undefined);
      break;

    case 'proposals':
      await cmdProposals(arg1);
      break;

    case 'dispatch':
      await cmdDispatch(arg1);
      break;

    case 'next':
      await cmdNext([arg1, arg2, ...rest].filter((a) => a !== undefined));
      break;

    case 'sync':
      await cmdSync([arg1, arg2, ...rest].filter((a) => a !== undefined));
      break;

    case 'prompt-watch':
      await cmdPromptWatch();
      break;

    case 'run':
      cmdRun([arg1, arg2, ...rest].filter(Boolean));
      break;

    case 'terminal':
      await cmdTerminalUpload(arg1);
      break;

    case 'screenshot':
      await cmdScreenshot(arg1, arg2, rest.join(' ') || undefined);
      break;

    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;

    default:
      if (cmd) console.error(`[opstwin] Unknown command: ${cmd}\n`);
      printHelp();
      if (cmd) process.exit(1);
      break;
  }
})();
