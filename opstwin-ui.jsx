import { useState, useEffect } from "react";

// ── Icons ────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 16, stroke = "currentColor", fill = "none", strokeWidth = 2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const Icons = {
  terminal: "M4 17l6-6-6-6M12 19h8",
  check: "M20 6L9 17l-5-5",
  x: "M18 6L6 18M6 6l12 12",
  alert: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  clock: "M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2",
  file: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6",
  git: "M18 3a3 3 0 00-3 3v1H9V6a3 3 0 10-1 0v1H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-4V6a3 3 0 00-3-3z",
  brain: "M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-2.5 2.5h-1A2.5 2.5 0 016 19.5v-1a2.5 2.5 0 012.5-2.5H9v-2H8.5A2.5 2.5 0 016 11.5v-1A2.5 2.5 0 018.5 8H9V6H8.5A2.5 2.5 0 016 3.5v-1A2.5 2.5 0 018.5 0",
  refresh: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z",
  plus: "M12 5v14M5 12h14",
  chevron: "M9 18l6-6-6-6",
  skip: "M5 4l10 8-10 8V4zM19 5v14",
  zap: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  layers: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
};

// ── Mock Data ────────────────────────────────────────────────────────────────
const MOCK_TASKS = [
  { id: "t1", title: "Refactor payment service", repo: "acme/backend", branch: "main", status: "complete", confidence: "medium", lastRun: "2m ago", acceptance: 0.87, filesChanged: 2, skipped: 3, todos: 1, tests: { pass: 3, fail: 1 } },
  { id: "t2", title: "Add Stripe webhook handler", repo: "acme/backend", branch: "main", status: "complete", confidence: "high", lastRun: "1h ago", acceptance: 1.0, filesChanged: 3, skipped: 1, todos: 0, tests: { pass: 5, fail: 0 } },
  { id: "t3", title: "Migrate auth to NextAuth v5", repo: "acme/frontend", branch: "develop", status: "partial", confidence: "low", lastRun: "3h ago", acceptance: 0.4, filesChanged: 7, skipped: 8, todos: 4, tests: { pass: 2, fail: 3 } },
  { id: "t4", title: "Add rate limiting middleware", repo: "acme/api", branch: "main", status: "running", confidence: null, lastRun: "now", acceptance: null, filesChanged: 0, skipped: 0, todos: 0, tests: { pass: 0, fail: 0 } },
];

const MOCK_AUDIT = {
  runId: "run_20241201_143022",
  branch: "ops/refactor-payment-20241201-1430",
  confidence: "medium",
  filesChanged: [
    { path: "src/services/payment.ts", linesAdded: 47, linesRemoved: 23, diff: "+ idempotencyKey: generateIdempotencyKey(orderId)" },
    { path: "src/app/api/webhooks/stripe/route.ts", linesAdded: 89, linesRemoved: 0, diff: "+ export async function POST(req: Request) {" },
  ],
  filesSkipped: [
    { path: "src/lib/stripe.ts", reason: "do-not-touch constraint" },
    { path: "src/services/subscription.ts", reason: "out of scope" },
    { path: "prisma/schema.prisma", reason: "do-not-touch constraint" },
  ],
  todosLeft: [
    { file: "src/services/payment.ts", line: 78, reason: "Refund flow not updated — requires new Stripe refund API signature" },
  ],
  testsRun: [
    { name: "payment.test.ts > createPaymentIntent", status: "pass" },
    { name: "payment.test.ts > handleWebhook", status: "pass" },
    { name: "lint", status: "pass" },
    { name: "typecheck", status: "fail", output: "payment.ts:78 — Type 'RefundParams' missing 'reason' field" },
  ],
  decisionTrace: [
    { file: "src/services/payment.ts", decision: "Added idempotencyKey to all API calls — required by Stripe v3 spec to prevent duplicate charges" },
    { file: "src/app/api/webhooks/stripe/route.ts", decision: "Created new file to avoid breaking legacy v2 webhook path still in production" },
  ],
  nextSteps: ["Fix typecheck error in payment.ts:78", "Run full test suite", "Review webhook route diff", "Create PR"],
  blockers: ["typecheck failure must resolve before merge"],
  mismatches: [
    { type: "test_failure", description: "typecheck failed in payment.ts:78", severity: "blocker" },
    { type: "missing_file", description: "TODO left in payment.ts:78 — refund flow", severity: "warning" },
  ],
};

const MOCK_MEMORY = [
  { taskType: "refactor", pattern: "Large refactor + low confidence", fix: "Split into sub-tasks per file. Use bounded scope prompts.", successRate: 0.62, reuseCount: 4 },
  { taskType: "feature", pattern: "New file creation works well", fix: "No change needed — pattern reliable.", successRate: 0.94, reuseCount: 11 },
  { taskType: "bugfix", pattern: "Test failures after fix", fix: "Run focused test rerun targeting only the failing test file.", successRate: 0.78, reuseCount: 7 },
  { taskType: "migration", pattern: "Many files skipped", fix: "Explicitly list target files in prompt. Add file constraints.", successRate: 0.45, reuseCount: 3 },
];

// ── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#0a0c10", bgCard: "#0f1218", bgHover: "#141820",
  border: "#1e2530", borderBright: "#2a3545",
  text: "#e2e8f0", textMuted: "#64748b", textDim: "#94a3b8",
  green: "#10b981", greenDim: "#064e3b", greenText: "#34d399",
  red: "#ef4444", redDim: "#450a0a", redText: "#f87171",
  yellow: "#f59e0b", yellowDim: "#431407", yellowText: "#fbbf24",
  blue: "#3b82f6", blueDim: "#172554", blueText: "#60a5fa",
  purple: "#8b5cf6", purpleDim: "#2e1065",
  accent: "#00d4ff", accentDim: "#003344",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const confidenceColor = (c) => ({
  high: C.green, medium: C.yellow, low: C.red, null: C.textMuted
}[c] || C.textMuted);

const statusColor = (s) => ({
  complete: C.green, partial: C.yellow, failed: C.red, running: C.blue
}[s] || C.textMuted);

const statusBg = (s) => ({
  complete: C.greenDim, partial: C.yellowDim, failed: C.redDim, running: C.blueDim
}[s] || "#1a1a1a");

const Badge = ({ label, color, bg }) => (
  <span style={{ background: bg || "#1a1a1a", color, border: `1px solid ${color}22`, padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "monospace" }}>
    {label}
  </span>
);

const Dot = ({ color, pulse }) => (
  <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: pulse ? `0 0 6px ${color}` : "none", animation: pulse ? "pulse 1.5s infinite" : "none" }} />
);

// ── Components ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color = C.text }) {
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px 20px", flex: 1 }}>
      <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ color, fontSize: 28, fontWeight: 800, fontFamily: "monospace", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ color: C.textMuted, fontSize: 12, marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function TestPill({ test }) {
  const color = test.status === "pass" ? C.green : test.status === "fail" ? C.red : C.textMuted;
  const bg = test.status === "pass" ? C.greenDim : test.status === "fail" ? C.redDim : "#1a1a1a";
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 12px", background: bg, border: `1px solid ${color}33`, borderRadius: 6, marginBottom: 6 }}>
      <span style={{ color, marginTop: 1, flexShrink: 0 }}>
        {test.status === "pass" ? "✓" : test.status === "fail" ? "✗" : "—"}
      </span>
      <div>
        <div style={{ color: C.text, fontSize: 13, fontFamily: "monospace" }}>{test.name}</div>
        {test.output && <div style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>{test.output}</div>}
      </div>
    </div>
  );
}

function FileDiff({ file }) {
  const added = file.linesAdded > 0;
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: `1px solid ${C.border}`, background: C.bgHover }}>
        <Icon d={Icons.file} size={13} stroke={C.textMuted} />
        <span style={{ color: C.text, fontSize: 12, fontFamily: "monospace", flex: 1 }}>{file.path}</span>
        <span style={{ color: C.greenText, fontSize: 11, fontFamily: "monospace" }}>+{file.linesAdded}</span>
        <span style={{ color: C.redText, fontSize: 11, fontFamily: "monospace" }}>-{file.linesRemoved}</span>
      </div>
      <div style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 12, color: C.greenText, background: "#0a1a12" }}>
        {file.diff}
      </div>
    </div>
  );
}

function SkippedFile({ file }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 6 }}>
      <Icon d={Icons.skip} size={13} stroke={C.textMuted} />
      <span style={{ color: C.textDim, fontSize: 12, fontFamily: "monospace", flex: 1 }}>{file.path}</span>
      <span style={{ color: C.textMuted, fontSize: 11, background: "#1a1a1a", padding: "2px 8px", borderRadius: 4 }}>{file.reason}</span>
    </div>
  );
}

// ── Views ────────────────────────────────────────────────────────────────────
function Dashboard({ onSelect }) {
  const total = MOCK_TASKS.length;
  const accepted = MOCK_TASKS.filter(t => t.acceptance === 1).length;
  const avgAcceptance = MOCK_TASKS.filter(t => t.acceptance !== null).reduce((a, t) => a + t.acceptance, 0) / MOCK_TASKS.filter(t => t.acceptance !== null).length;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: C.textMuted, fontSize: 12, fontFamily: "monospace", marginBottom: 4 }}>WORKSPACE</div>
        <h2 style={{ color: C.text, fontSize: 22, fontWeight: 700, margin: 0 }}>acme / backend</h2>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <MetricCard label="Total Tasks" value={total} sub="all time" />
        <MetricCard label="Acceptance Rate" value={`${Math.round(avgAcceptance * 100)}%`} sub="accepted / total" color={avgAcceptance > 0.7 ? C.green : C.yellow} />
        <MetricCard label="Avg Fix Time" value="18m" sub="median across runs" color={C.blue} />
        <MetricCard label="Patterns Learned" value={MOCK_MEMORY.length} sub="in memory store" color={C.purple} />
      </div>

      <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Recent Tasks</div>

      {MOCK_TASKS.map(task => (
        <div key={task.id}
          onClick={() => onSelect(task)}
          style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 18px", marginBottom: 8, cursor: "pointer", transition: "border-color 0.15s", display: "flex", alignItems: "center", gap: 14 }}
          onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
          onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
        >
          <Dot color={statusColor(task.status)} pulse={task.status === "running"} />

          <div style={{ flex: 1 }}>
            <div style={{ color: C.text, fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{task.title}</div>
            <div style={{ color: C.textMuted, fontSize: 12, fontFamily: "monospace" }}>{task.repo} · {task.branch} · {task.lastRun}</div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {task.confidence && (
              <Badge label={task.confidence} color={confidenceColor(task.confidence)} />
            )}
            <Badge label={task.status} color={statusColor(task.status)} bg={statusBg(task.status)} />
            <div style={{ textAlign: "right", minWidth: 80 }}>
              <div style={{ fontSize: 12, fontFamily: "monospace", color: C.greenText }}>+{task.filesChanged} files</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{task.skipped} skipped</div>
            </div>
            {task.acceptance !== null && (
              <div style={{ width: 36, height: 36, borderRadius: "50%", border: `2px solid ${task.acceptance > 0.7 ? C.green : C.yellow}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: task.acceptance > 0.7 ? C.greenText : C.yellowText, fontFamily: "monospace" }}>
                {Math.round(task.acceptance * 100)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditView({ task, onBack }) {
  const r = MOCK_AUDIT;
  const [activeTab, setActiveTab] = useState("changes");
  const blockers = r.mismatches.filter(m => m.severity === "blocker");
  const warnings = r.mismatches.filter(m => m.severity === "warning");

  const tabs = [
    { id: "changes", label: "Changes" },
    { id: "skipped", label: `Skipped (${r.filesSkipped.length})` },
    { id: "tests", label: "Tests" },
    { id: "trace", label: "Decision Trace" },
  ];

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
        ← Back to dashboard
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: C.textMuted, fontSize: 11, fontFamily: "monospace", marginBottom: 4 }}>AUDIT REPORT · {r.runId}</div>
          <h2 style={{ color: C.text, fontSize: 20, fontWeight: 700, margin: "0 0 6px" }}>{task.title}</h2>
          <div style={{ color: C.textMuted, fontSize: 12, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon d={Icons.git} size={12} stroke={C.textMuted} />
            {r.branch}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Badge label={r.confidence} color={confidenceColor(r.confidence)} />
        </div>
      </div>

      {/* Mismatch Banner */}
      {blockers.length > 0 && (
        <div style={{ background: C.redDim, border: `1px solid ${C.red}44`, borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Icon d={Icons.alert} size={15} stroke={C.redText} />
            <span style={{ color: C.redText, fontWeight: 700, fontSize: 13 }}>{blockers.length} Blocker{blockers.length > 1 ? "s" : ""} — Merge not safe</span>
          </div>
          {blockers.map((b, i) => <div key={i} style={{ color: C.textDim, fontSize: 12, marginLeft: 23 }}>· {b.description}</div>)}
        </div>
      )}

      {warnings.length > 0 && (
        <div style={{ background: C.yellowDim, border: `1px solid ${C.yellow}44`, borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ color: C.yellowText, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>⚠ {warnings.length} Warning{warnings.length > 1 ? "s" : ""}</div>
          {warnings.map((w, i) => <div key={i} style={{ color: C.textDim, fontSize: 12 }}>· {w.description}</div>)}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ background: "none", border: "none", borderBottom: activeTab === t.id ? `2px solid ${C.accent}` : "2px solid transparent", color: activeTab === t.id ? C.accent : C.textMuted, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: -1 }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "changes" && (
        <div>
          {r.filesChanged.map((f, i) => <FileDiff key={i} file={f} />)}
        </div>
      )}

      {activeTab === "skipped" && (
        <div>
          <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 12 }}>Files Cursor inspected but did not modify, and reasons why.</div>
          {r.filesSkipped.map((f, i) => <SkippedFile key={i} file={f} />)}
          {r.todosLeft.map((t, i) => (
            <div key={i} style={{ padding: "10px 14px", background: C.yellowDim, border: `1px solid ${C.yellow}33`, borderRadius: 6, marginBottom: 6 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                <span style={{ color: C.yellowText, fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}>TODO</span>
                <span style={{ color: C.textMuted, fontSize: 11, fontFamily: "monospace" }}>{t.file}:{t.line}</span>
              </div>
              <div style={{ color: C.textDim, fontSize: 12 }}>{t.reason}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "tests" && (
        <div>
          {r.testsRun.map((t, i) => <TestPill key={i} test={t} />)}
        </div>
      )}

      {activeTab === "trace" && (
        <div>
          <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 12 }}>Why Cursor made each non-trivial edit.</div>
          {r.decisionTrace.map((d, i) => (
            <div key={i} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 6, padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ color: C.accent, fontSize: 12, fontFamily: "monospace", marginBottom: 6 }}>{d.file}</div>
              <div style={{ color: C.textDim, fontSize: 13 }}>{d.decision}</div>
            </div>
          ))}
        </div>
      )}

      {/* Next Steps + Actions */}
      <div style={{ marginTop: 20, background: C.bgCard, border: `1px solid ${C.borderBright}`, borderRadius: 8, padding: 16 }}>
        <div style={{ color: C.text, fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Next Steps</div>
        {r.nextSteps.map((step, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
            <span style={{ color: C.accent, fontFamily: "monospace", fontSize: 12, minWidth: 20 }}>{i + 1}.</span>
            <span style={{ color: C.textDim, fontSize: 13 }}>{step}</span>
          </div>
        ))}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button style={{ flex: 1, background: C.accentDim, border: `1px solid ${C.accent}`, color: C.accent, padding: "10px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            ⚡ Create Focused Rerun
          </button>
          <button style={{ background: C.greenDim, border: `1px solid ${C.green}`, color: C.greenText, padding: "10px 20px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            ✓ Accept Changes
          </button>
          <button style={{ background: C.redDim, border: `1px solid ${C.red}44`, color: C.redText, padding: "10px 20px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            ✗ Reject
          </button>
        </div>
      </div>
    </div>
  );
}

function MemoryView() {
  return (
    <div>
      <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>PATTERN MEMORY</div>
      <h2 style={{ color: C.text, fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Learned Patterns</h2>
      <p style={{ color: C.textMuted, fontSize: 13, margin: "0 0 24px" }}>OpsTwin clusters failures by type and surfaces better prompts for future tasks.</p>

      {MOCK_MEMORY.map((m, i) => (
        <div key={i} style={{ background: C.bgCard, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <Badge label={m.taskType} color={C.purple} bg={C.purpleDim} />
            <span style={{ color: C.text, fontWeight: 600, fontSize: 14, flex: 1 }}>{m.pattern}</span>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: m.successRate > 0.7 ? C.greenText : m.successRate > 0.5 ? C.yellowText : C.redText, fontWeight: 700, fontSize: 15, fontFamily: "monospace" }}>
                {Math.round(m.successRate * 100)}%
              </div>
              <div style={{ color: C.textMuted, fontSize: 10 }}>success · {m.reuseCount} uses</div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ height: 3, background: C.border, borderRadius: 2, marginBottom: 10, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${m.successRate * 100}%`, background: m.successRate > 0.7 ? C.green : m.successRate > 0.5 ? C.yellow : C.red, borderRadius: 2 }} />
          </div>

          <div style={{ color: C.textMuted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Suggested Fix</div>
          <div style={{ color: C.textDim, fontSize: 13 }}>{m.fix}</div>
        </div>
      ))}
    </div>
  );
}

function NewTaskModal({ onClose }) {
  const [prompt, setPrompt] = useState("");
  const [repo, setRepo] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000a", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: C.bgCard, border: `1px solid ${C.borderBright}`, borderRadius: 12, padding: 28, width: 560, maxWidth: "90vw" }}>
        <h3 style={{ color: C.text, fontWeight: 700, fontSize: 17, margin: "0 0 20px" }}>New Cursor Task</h3>
        <div style={{ marginBottom: 16 }}>
          <label style={{ color: C.textMuted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Repo / Branch</label>
          <input value={repo} onChange={e => setRepo(e.target.value)} placeholder="acme/backend · main"
            style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 12px", color: C.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ color: C.textMuted, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>Task Prompt</label>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={5}
            placeholder="Describe the task. E.g.: Refactor payment service to use Stripe API v3. Update webhook handlers and add idempotency keys. Do not change src/lib/stripe.ts."
            style={{ width: "100%", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 12px", color: C.text, fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: "none", border: `1px solid ${C.border}`, color: C.textMuted, padding: "10px 0", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>Cancel</button>
          <button onClick={onClose} style={{ flex: 2, background: C.accent, border: "none", color: "#000", padding: "10px 0", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
            Start Task →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── App Shell ────────────────────────────────────────────────────────────────
export default function OpsTwin() {
  const [view, setView] = useState("dashboard");
  const [selectedTask, setSelectedTask] = useState(null);
  const [showNewTask, setShowNewTask] = useState(false);

  const navItems = [
    { id: "dashboard", icon: Icons.layers, label: "Tasks" },
    { id: "memory", icon: Icons.brain, label: "Memory" },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", background: C.bg, color: C.text, fontFamily: "'IBM Plex Mono', 'Fira Code', 'Courier New', monospace", overflow: "hidden" }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a3545; border-radius: 2px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        input::placeholder, textarea::placeholder { color: #334155; }
      `}</style>

      {/* Sidebar */}
      <div style={{ width: 56, background: C.bgCard, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0", gap: 4, flexShrink: 0 }}>
        <div style={{ color: C.accent, fontWeight: 900, fontSize: 13, letterSpacing: "-0.05em", marginBottom: 20, writingMode: "vertical-rl", textOrientation: "mixed", transform: "rotate(180deg)" }}>OPS</div>
        {navItems.map(item => (
          <button key={item.id} onClick={() => { setView(item.id); setSelectedTask(null); }}
            title={item.label}
            style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: view === item.id ? C.accentDim : "none", border: view === item.id ? `1px solid ${C.accent}44` : "1px solid transparent", borderRadius: 8, cursor: "pointer", color: view === item.id ? C.accent : C.textMuted, transition: "all 0.15s" }}>
            <Icon d={item.icon} size={16} stroke="currentColor" />
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowNewTask(true)} title="New Task"
          style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: C.accent, border: "none", borderRadius: 8, cursor: "pointer", color: "#000" }}>
          <Icon d={Icons.plus} size={16} stroke="currentColor" />
        </button>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflow: "auto", padding: 28 }}>
        {view === "dashboard" && !selectedTask && (
          <Dashboard onSelect={(task) => { setSelectedTask(task); setView("audit"); }} />
        )}
        {view === "audit" && selectedTask && (
          <AuditView task={selectedTask} onBack={() => { setSelectedTask(null); setView("dashboard"); }} />
        )}
        {view === "memory" && <MemoryView />}
      </div>

      {showNewTask && <NewTaskModal onClose={() => setShowNewTask(false)} />}
    </div>
  );
}
