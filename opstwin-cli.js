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
 *   node opstwin-cli.js help                   # Show this help
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

const BASE_URL = (process.env.OPSTWIN_URL || 'http://localhost:3000').replace(/\/$/, '');
const DEFAULT_TASK_ID = process.env.OPSTWIN_TASK_ID || '';

// ── HTTP helper ──────────────────────────────────────────────────────────────

/**
 * Minimal Promise-based HTTP/HTTPS request helper.
 * @param {string} url    Full URL
 * @param {string} method HTTP method (GET, POST, …)
 * @param {object|null} body  JSON-serialisable body, or null
 * @returns {Promise<{status: number, body: any}>}
 */
function request(url, method = 'GET', body = null) {
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
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = transport.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── Commands ─────────────────────────────────────────────────────────────────

/**
 * watch — Recursively watch .ops/runs for new *.json files and upload each once.
 */
async function cmdWatch() {
  const watchDir = path.join(process.cwd(), '.ops', 'runs');

  if (!fs.existsSync(watchDir)) {
    console.error(`[opstwin] Watch directory not found: ${watchDir}`);
    console.error('[opstwin] Create it with:  mkdir -p .ops/runs');
    process.exit(1);
  }

  const taskId = DEFAULT_TASK_ID;
  if (!taskId) {
    console.warn('[opstwin] Warning: OPSTWIN_TASK_ID not set. Uploads will fail unless taskId is in the JSON.');
  }

  const uploaded = new Set(); // files already uploaded this session

  console.log(`[opstwin] Watching ${watchDir} …`);
  console.log(`[opstwin] OPSTWIN_URL=${BASE_URL}  OPSTWIN_TASK_ID=${taskId || '(not set)'}`);

  // Debounce timers keyed by absolute file path
  const debounce = {};

  function handleFile(filePath) {
    if (!filePath.endsWith('.json')) return;
    if (uploaded.has(filePath)) return;

    // Debounce rapid fs events for the same file (e.g. write + rename)
    clearTimeout(debounce[filePath]);
    debounce[filePath] = setTimeout(async () => {
      if (uploaded.has(filePath)) return;
      uploaded.add(filePath);
      delete debounce[filePath];
      await uploadFile(filePath, taskId, /* quiet */ false);
    }, 300);
  }

  // Use recursive watch (Node ≥ 19.1 on Linux; all platforms on macOS/Win)
  try {
    fs.watch(watchDir, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      const full = path.join(watchDir, filename);
      // Only react to files that actually exist (ignore delete events)
      if (fs.existsSync(full)) handleFile(full);
    });
  } catch (err) {
    console.error('[opstwin] fs.watch failed:', err.message);
    console.error('[opstwin] Your Node version may not support recursive watch. Try Node ≥ 20.');
    process.exit(1);
  }

  // Keep the process alive
  process.stdin.resume();
}

/**
 * upload — Read a JSON file and POST it to OpsTwin.
 * @param {string} filePath   Absolute or relative path to the run JSON file
 * @param {string} taskId     OpsTwin task ID
 * @param {boolean} quiet     Suppress verbose output when called from watch
 */
async function uploadFile(filePath, taskId, quiet = false) {
  const abs = path.resolve(filePath);

  if (!fs.existsSync(abs)) {
    console.error(`[opstwin] File not found: ${abs}`);
    return;
  }

  let auditJson;
  try {
    auditJson = JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    console.error(`[opstwin] Failed to parse JSON from ${abs}: ${err.message}`);
    return;
  }

  const effectiveTaskId = taskId || DEFAULT_TASK_ID || auditJson.taskId;
  if (!effectiveTaskId) {
    console.error(`[opstwin] No taskId provided and OPSTWIN_TASK_ID is not set.`);
    return;
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
    });
  } catch (err) {
    console.error(`[opstwin] Network error: ${err.message}`);
    return;
  }

  if (res.status >= 200 && res.status < 300) {
    const run = res.body?.run || res.body;
    const blockers  = run?.blockers?.length ?? '?';
    const mismatches = run?.mismatches?.length ?? '?';
    const prompt = run?.focusedRerunPrompt
      ? run.focusedRerunPrompt.slice(0, 200)
      : '(none)';
    console.log(`[opstwin] ✓ Uploaded  blockers=${blockers}  mismatches=${mismatches}`);
    if (!quiet) {
      console.log(`[opstwin] focusedRerunPrompt (first 200 chars):\n  ${prompt}`);
    }
  } else {
    console.error(`[opstwin] ✗ Upload failed  HTTP ${res.status}:`, JSON.stringify(res.body));
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
  node opstwin-cli.js help                    Show this help

Environment variables:
  OPSTWIN_URL      Base URL  (default: http://localhost:3000)
  OPSTWIN_TASK_ID  Default task ID when not passed as a CLI argument
`.trim());
}

// ── Entry point ───────────────────────────────────────────────────────────────

const [,, cmd, arg1, arg2] = process.argv;

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
