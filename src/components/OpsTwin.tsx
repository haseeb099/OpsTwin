'use client'

// src/components/OpsTwin.tsx
// Full OpsTwin dashboard. Inline-styled (no Tailwind / shadcn). Wired to:
//   GET  /api/tasks           — task list
//   POST /api/tasks           — new task modal
//   GET  /api/runs?taskId=    — runs for a task
//   GET  /api/runs/[id]       — full audit report + focused rerun prompt
//   GET  /api/memory          — memory entries
//   POST /api/outcomes        — accept / reject decisions

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { AuditReport, MemoryEntry } from '@/types'
import type { WorkflowStep } from '@/types/workflow'
import PlanView from '@/components/PlanView'
import RunObservations from '@/components/RunObservations'
import WorkflowGuide, { detectWorkflowStep, WorkflowStrip } from '@/components/WorkflowGuide'

// ── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#0a0c10',
  bgCard: '#0f1218',
  bgHover: '#141820',
  border: '#1e2530',
  borderBright: '#2a3545',
  text: '#e2e8f0',
  textMuted: '#64748b',
  textDim: '#94a3b8',
  green: '#10b981',
  greenDim: '#064e3b',
  greenText: '#34d399',
  red: '#ef4444',
  redDim: '#450a0a',
  redText: '#f87171',
  yellow: '#f59e0b',
  yellowDim: '#431407',
  yellowText: '#fbbf24',
  blue: '#3b82f6',
  blueDim: '#172554',
  blueText: '#60a5fa',
  purple: '#8b5cf6',
  purpleDim: '#2e1065',
  accent: '#00d4ff',
  accentDim: '#003344',
} as const

// ── Icons ────────────────────────────────────────────────────────────────────
const Icon = ({
  d,
  size = 16,
  stroke = 'currentColor',
  fill = 'none',
  strokeWidth = 2,
}: {
  d: string
  size?: number
  stroke?: string
  fill?: string
  strokeWidth?: number
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={fill}
    stroke={stroke}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d={d} />
  </svg>
)

const Icons = {
  alert:
    'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01',
  file: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6',
  git: 'M18 3a3 3 0 00-3 3v1H9V6a3 3 0 10-1 0v1H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V8a2 2 0 00-2-2h-4V6a3 3 0 00-3-3z',
  brain:
    'M9.5 2A2.5 2.5 0 0112 4.5v15a2.5 2.5 0 01-2.5 2.5h-1A2.5 2.5 0 016 19.5v-1a2.5 2.5 0 012.5-2.5H9v-2H8.5A2.5 2.5 0 016 11.5v-1A2.5 2.5 0 018.5 8H9V6H8.5A2.5 2.5 0 016 3.5v-1A2.5 2.5 0 018.5 0',
  plus: 'M12 5v14M5 12h14',
  skip: 'M5 4l10 8-10 8V4zM19 5v14',
  layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  upload: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12',
  copy: 'M16 3H4a2 2 0 00-2 2v12M9 7h11a2 2 0 012 2v11a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2z',
  help: 'M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 2a10 10 0 100 20 10 10 0 000-20z',
} as const

// ── Types from the API ───────────────────────────────────────────────────────
type Confidence = 'high' | 'medium' | 'low'
type RunStatus = 'running' | 'complete' | 'failed' | 'partial'

interface TaskWithRuns {
  id: string
  user: string
  repo: string
  branch: string
  originalPrompt: string
  title: string
  createdAt: string
  runs: {
    id: string
    status: RunStatus
    confidence: Confidence | null
    startedAt: string
    finishedAt: string | null
    branch: string
    fileEdits: { id: string; path: string; linesAdded: number; linesRemoved: number }[]
    inspectedFiles: { id: string; path: string; reason: string; touched: boolean }[]
  }[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const confidenceColor = (c: Confidence | null | undefined) =>
  c === 'high'
    ? C.green
    : c === 'medium'
      ? C.yellow
      : c === 'low'
        ? C.red
        : C.textMuted

const statusColor = (s: RunStatus | 'pending' | undefined) =>
  s === 'complete'
    ? C.green
    : s === 'partial'
      ? C.yellow
      : s === 'failed'
        ? C.red
        : s === 'running'
          ? C.blue
          : C.textMuted

const statusBg = (s: RunStatus | 'pending' | undefined) =>
  s === 'complete'
    ? C.greenDim
    : s === 'partial'
      ? C.yellowDim
      : s === 'failed'
        ? C.redDim
        : s === 'running'
          ? C.blueDim
          : '#1a1a1a'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

// ── Small reusable bits ──────────────────────────────────────────────────────
function Badge({ label, color, bg }: { label: string; color: string; bg?: string }) {
  return (
    <span
      style={{
        background: bg || '#1a1a1a',
        color,
        border: `1px solid ${color}22`,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        fontFamily: 'monospace',
      }}
    >
      {label}
    </span>
  )
}

function Dot({ color, pulse }: { color: string; pulse?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: color,
        boxShadow: pulse ? `0 0 6px ${color}` : 'none',
        animation: pulse ? 'pulse 1.5s infinite' : 'none',
      }}
    />
  )
}

function MetricCard({
  label,
  value,
  sub,
  color = C.text,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '16px 20px',
        flex: 1,
      }}
    >
      <div
        style={{
          color: C.textMuted,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color,
          fontSize: 28,
          fontWeight: 800,
          fontFamily: 'monospace',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ color: C.textMuted, fontSize: 12, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function SkeletonRow() {
  return (
    <div
      className="opstwin-skeleton"
      style={{
        height: 64,
        marginBottom: 8,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
      }}
    />
  )
}

function TestPill({
  test,
}: {
  test: { name: string; status: 'pass' | 'fail' | 'skipped'; output?: string }
}) {
  const color =
    test.status === 'pass' ? C.green : test.status === 'fail' ? C.red : C.textMuted
  const bg =
    test.status === 'pass' ? C.greenDim : test.status === 'fail' ? C.redDim : '#1a1a1a'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '8px 12px',
        background: bg,
        border: `1px solid ${color}33`,
        borderRadius: 6,
        marginBottom: 6,
      }}
    >
      <span style={{ color, marginTop: 1, flexShrink: 0 }}>
        {test.status === 'pass' ? '\u2713' : test.status === 'fail' ? '\u2717' : '\u2014'}
      </span>
      <div>
        <div style={{ color: C.text, fontSize: 13, fontFamily: 'monospace' }}>{test.name}</div>
        {test.output && (
          <div style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>{test.output}</div>
        )}
      </div>
    </div>
  )
}

function FileDiff({
  file,
}: {
  file: { path: string; linesAdded: number; linesRemoved: number; diff: string }
}) {
  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        marginBottom: 8,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderBottom: `1px solid ${C.border}`,
          background: C.bgHover,
        }}
      >
        <Icon d={Icons.file} size={13} stroke={C.textMuted} />
        <span style={{ color: C.text, fontSize: 12, fontFamily: 'monospace', flex: 1 }}>
          {file.path}
        </span>
        <span style={{ color: C.greenText, fontSize: 11, fontFamily: 'monospace' }}>
          +{file.linesAdded}
        </span>
        <span style={{ color: C.redText, fontSize: 11, fontFamily: 'monospace' }}>
          -{file.linesRemoved}
        </span>
      </div>
      <div
        style={{
          padding: '10px 12px',
          fontFamily: 'monospace',
          fontSize: 12,
          color: C.greenText,
          background: '#0a1a12',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {file.diff}
      </div>
    </div>
  )
}

function SkippedFile({ file }: { file: { path: string; reason: string } }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 12px',
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 6,
        marginBottom: 6,
      }}
    >
      <Icon d={Icons.skip} size={13} stroke={C.textMuted} />
      <span style={{ color: C.textDim, fontSize: 12, fontFamily: 'monospace', flex: 1 }}>
        {file.path}
      </span>
      <span
        style={{
          color: C.textMuted,
          fontSize: 11,
          background: '#1a1a1a',
          padding: '2px 8px',
          borderRadius: 4,
        }}
      >
        {file.reason}
      </span>
    </div>
  )
}

// ── Toast (error / success) ──────────────────────────────────────────────────
function Toast({
  message,
  variant,
  onClose,
}: {
  message: string
  variant: 'error' | 'success'
  onClose: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])

  const bg = variant === 'error' ? C.redDim : C.greenDim
  const border = variant === 'error' ? C.red : C.green
  const color = variant === 'error' ? C.redText : C.greenText
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        background: bg,
        border: `1px solid ${border}`,
        color,
        padding: '10px 16px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 600,
        zIndex: 200,
        animation: 'fadeIn 0.2s ease-out',
        maxWidth: 420,
      }}
    >
      {message}
    </div>
  )
}

// ── Copyable Prompt Modal ────────────────────────────────────────────────────
function PromptModal({
  prompt,
  onClose,
  onToast,
}: {
  prompt: string
  onClose: () => void
  onToast: (msg: string, variant: 'error' | 'success') => void
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      onToast('Focused rerun prompt copied to clipboard', 'success')
    } catch {
      onToast('Failed to copy — select and copy manually', 'error')
    }
  }
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.bgCard,
          border: `1px solid ${C.borderBright}`,
          borderRadius: 12,
          padding: 24,
          width: 720,
          maxWidth: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <h3 style={{ color: C.text, fontWeight: 700, fontSize: 17, margin: 0, flex: 1 }}>
            Focused Rerun Prompt
          </h3>
          <button
            onClick={copy}
            style={{
              background: C.accentDim,
              border: `1px solid ${C.accent}`,
              color: C.accent,
              padding: '8px 14px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon d={Icons.copy} size={13} /> Copy
          </button>
        </div>
        <pre
          style={{
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 16,
            color: C.textDim,
            fontSize: 12,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowY: 'auto',
            flex: 1,
            margin: 0,
          }}
        >
          {prompt}
        </pre>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: `1px solid ${C.border}`,
              color: C.textMuted,
              padding: '8px 18px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── New Task Modal (wired) ───────────────────────────────────────────────────
function NewTaskModal({
  onClose,
  onCreated,
  onToast,
  memory,
}: {
  onClose: () => void
  onCreated: () => void
  onToast: (msg: string, variant: 'error' | 'success') => void
  memory: MemoryEntry[]
}) {
  const [title, setTitle] = useState('')
  const [repo, setRepo] = useState('')
  const [branch, setBranch] = useState('main')
  const [prompt, setPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [hintOpen, setHintOpen] = useState(true)

  function getTaskType(text: string): string {
    const lower = text.toLowerCase()
    if (lower.includes('refactor')) return 'refactor'
    if (lower.includes('add') || lower.includes('create')) return 'feature'
    if (lower.includes('fix') || lower.includes('bug')) return 'bugfix'
    if (lower.includes('test')) return 'testing'
    if (lower.includes('migrate')) return 'migration'
    return 'general'
  }

  const memoryHint =
    prompt.length > 10
      ? (() => {
          const taskType = getTaskType(prompt)
          return memory.find((m) => m.taskType === taskType && m.reuseCount > 0) ?? null
        })()
      : null

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: 'local@opstwin',
          repo: repo || 'local/repo',
          branch: branch || 'main',
          title: title || 'Untitled task',
          originalPrompt: prompt,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }
      onToast('Task created', 'success')
      onCreated()
      onClose()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to create task', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: C.bgCard,
          border: `1px solid ${C.borderBright}`,
          borderRadius: 12,
          padding: 28,
          width: 560,
          maxWidth: '90vw',
        }}
      >
        <h3 style={{ color: C.text, fontWeight: 700, fontSize: 17, margin: '0 0 20px' }}>
          New Cursor Task
        </h3>

        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              color: C.textMuted,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              display: 'block',
              marginBottom: 6,
            }}
          >
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Refactor payment service"
            style={{
              width: '100%',
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: '10px 12px',
              color: C.text,
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 2 }}>
            <label
              style={{
                color: C.textMuted,
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Repo
            </label>
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="acme/backend"
              style={{
                width: '100%',
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: '10px 12px',
                color: C.text,
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label
              style={{
                color: C.textMuted,
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                display: 'block',
                marginBottom: 6,
              }}
            >
              Branch
            </label>
            <input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              style={{
                width: '100%',
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: '10px 12px',
                color: C.text,
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: memoryHint ? 10 : 20 }}>
          <label
            style={{
              color: C.textMuted,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              display: 'block',
              marginBottom: 6,
            }}
          >
            Task Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            placeholder="Refactor payment service to use Stripe API v3. Update webhook handlers and add idempotency keys. Do not change src/lib/stripe.ts."
            style={{
              width: '100%',
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: '10px 12px',
              color: C.text,
              fontSize: 13,
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {memoryHint && (
          <div
            style={{
              background: C.yellowDim,
              border: `1px solid ${C.yellow}`,
              borderRadius: 8,
              marginBottom: 20,
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setHintOpen((o) => !o)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                textAlign: 'left',
              }}
            >
              <span style={{ color: C.yellowText, fontWeight: 700, fontSize: 12, flex: 1 }}>
                💡 Memory hint
              </span>
              <span style={{ color: C.textMuted, fontSize: 11 }}>{hintOpen ? '▲' : '▼'}</span>
            </button>
            {hintOpen && (
              <div style={{ padding: '0 14px 12px' }}>
                <div style={{ color: C.textDim, fontSize: 13, marginBottom: 6 }}>
                  {memoryHint.outcomeSummary}
                </div>
                <div
                  style={{
                    color: C.textMuted,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 4,
                  }}
                >
                  Suggestion
                </div>
                <div style={{ color: C.yellowText, fontSize: 12 }}>
                  {memoryHint.improvementSuggestion}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              flex: 1,
              background: 'none',
              border: `1px solid ${C.border}`,
              color: C.textMuted,
              padding: '10px 0',
              borderRadius: 6,
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || prompt.length < 10}
            style={{
              flex: 2,
              background: C.accent,
              border: 'none',
              color: '#000',
              padding: '10px 0',
              borderRadius: 6,
              cursor: submitting || prompt.length < 10 ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 700,
              opacity: prompt.length < 10 ? 0.55 : 1,
            }}
          >
            {submitting ? 'Creating...' : 'Start Task \u2192'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({
  tasks,
  loading,
  memory,
  onSelect,
  onOpenGuide,
  workflowStep,
}: {
  tasks: TaskWithRuns[]
  loading: boolean
  memory: MemoryEntry[]
  onSelect: (task: TaskWithRuns) => void
  onOpenGuide: () => void
  workflowStep: WorkflowStep
}) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | RunStatus | 'pending'>('all')

  const filteredTasks = tasks.filter((task) => {
    const q = search.toLowerCase()
    const matchesSearch =
      search === '' ||
      task.title.toLowerCase().includes(q) ||
      task.repo.toLowerCase().includes(q)
    const taskStatus = task.runs[0]?.status ?? 'pending'
    const matchesStatus = filterStatus === 'all' || taskStatus === filterStatus
    return matchesSearch && matchesStatus
  })

  const total = tasks.length
  const completed = tasks.filter((t) => t.runs[0]?.status === 'complete').length
  const avgAcceptance = total > 0 ? completed / total : 0

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              color: C.textMuted,
              fontSize: 12,
              fontFamily: 'monospace',
              marginBottom: 4,
            }}
          >
            WORKSPACE
          </div>
          <h2 style={{ color: C.text, fontSize: 22, fontWeight: 700, margin: 0 }}>
            OpsTwin · local
          </h2>
          <p style={{ color: C.textDim, fontSize: 12, margin: '6px 0 0' }}>
            Prompt → Plan → Agent → Audit → Improve
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenGuide}
          style={{
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            color: C.textDim,
            padding: '8px 14px',
            borderRadius: 6,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          How it works →
        </button>
      </div>

      <WorkflowStrip currentStep={workflowStep} onOpenGuide={onOpenGuide} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <MetricCard label="Total Tasks" value={total} sub="all time" />
        <MetricCard
          label="Completion Rate"
          value={`${Math.round(avgAcceptance * 100)}%`}
          sub="complete / total"
          color={avgAcceptance > 0.7 ? C.green : C.yellow}
        />
        <MetricCard
          label="Patterns Learned"
          value={memory.length}
          sub="in memory store"
          color={C.purple}
        />
        <MetricCard
          label="Active Runs"
          value={tasks.filter((t) => t.runs[0]?.status === 'running').length}
          sub="currently executing"
          color={C.blue}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            color: C.textMuted,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            flex: 1,
          }}
        >
          Recent Tasks
        </div>
        <Link
          href="/upload"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            color: C.textDim,
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <Icon d={Icons.upload} size={13} stroke={C.textDim} />
          Upload audit JSON
        </Link>
      </div>

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search tasks…"
        style={{
          width: '100%',
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          padding: '8px 12px',
          color: C.text,
          fontSize: 13,
          outline: 'none',
          boxSizing: 'border-box',
          marginBottom: 10,
        }}
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['all', 'running', 'complete', 'partial', 'failed'] as const).map((s) => {
          const active = filterStatus === s
          const label = s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              style={{
                background: active ? C.accentDim : C.bgCard,
                border: `1px solid ${active ? C.accent : C.border}`,
                color: active ? C.accent : C.textMuted,
                padding: '4px 12px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {loading && (
        <>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </>
      )}

      {!loading && tasks.length === 0 && (
        <div
          style={{
            background: C.bgCard,
            border: `1px dashed ${C.border}`,
            borderRadius: 8,
            padding: 40,
            textAlign: 'center',
            color: C.textMuted,
            fontSize: 13,
          }}
        >
          <div style={{ color: C.text, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
            No tasks yet
          </div>
          <p style={{ margin: '0 0 16px', lineHeight: 1.6 }}>
            Click <span style={{ color: C.accent }}>+</span> in the sidebar to create your first
            MVP task.
          </p>
          <button
            type="button"
            onClick={onOpenGuide}
            style={{
              background: C.accentDim,
              border: `1px solid ${C.accent}44`,
              color: C.accent,
              padding: '8px 16px',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Read the full guide
          </button>
        </div>
      )}

      {!loading && tasks.length > 0 && filteredTasks.length === 0 && (
        <div
          style={{
            background: C.bgCard,
            border: `1px dashed ${C.border}`,
            borderRadius: 8,
            padding: 32,
            textAlign: 'center',
            color: C.textMuted,
            fontSize: 13,
          }}
        >
          No tasks match your search/filter.
        </div>
      )}

      {!loading &&
        filteredTasks.map((task) => {
          const run = task.runs[0]
          const filesChanged = run?.fileEdits.length ?? 0
          const skipped = run?.inspectedFiles.filter((f) => !f.touched).length ?? 0
          const status = run?.status ?? 'pending'
          return (
            <div
              key={task.id}
              onClick={() => onSelect(task)}
              style={{
                background: C.bgCard,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: '14px 18px',
                marginBottom: 8,
                cursor: 'pointer',
                transition: 'border-color 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.accent
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = C.border
              }}
            >
              <Dot color={statusColor(status)} pulse={status === 'running'} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: C.text,
                    fontWeight: 600,
                    fontSize: 14,
                    marginBottom: 3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {task.title}
                </div>
                <div
                  style={{
                    color: C.textMuted,
                    fontSize: 12,
                    fontFamily: 'monospace',
                  }}
                >
                  {task.repo} · {task.branch} ·{' '}
                  {run ? timeAgo(run.startedAt) : timeAgo(task.createdAt)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {run?.confidence && (
                  <Badge label={run.confidence} color={confidenceColor(run.confidence)} />
                )}
                <Badge
                  label={status}
                  color={statusColor(status)}
                  bg={statusBg(status)}
                />
                <div style={{ textAlign: 'right', minWidth: 90 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontFamily: 'monospace',
                      color: C.greenText,
                    }}
                  >
                    {filesChanged} files
                  </div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>
                    {skipped} skipped
                  </div>
                </div>
              </div>
            </div>
          )
        })}
    </div>
  )
}

// ── Audit View ───────────────────────────────────────────────────────────────
function AuditView({
  task,
  onBack,
  onToast,
}: {
  task: TaskWithRuns
  onBack: () => void
  onToast: (msg: string, variant: 'error' | 'success') => void
}) {
  const [activeTab, setActiveTab] = useState<'changes' | 'skipped' | 'tests' | 'trace' | 'rules'>(
    'changes',
  )
  const [report, setReport] = useState<AuditReport | null>(null)
  const [focusedPrompt, setFocusedPrompt] = useState<string | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const latestRun = task.runs[0]

  const loadRun = useCallback(async () => {
    if (!latestRun) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/runs/${latestRun.id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as {
        report: AuditReport | null
        focusedRerunPrompt: string | null
      }
      setReport(data.report)
      setFocusedPrompt(data.focusedRerunPrompt)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to load run', 'error')
    } finally {
      setLoading(false)
    }
  }, [latestRun, onToast])

  useEffect(() => {
    loadRun()
  }, [loadRun])

  const sendOutcome = async (action: 'accepted' | 'rejected') => {
    if (!latestRun || actionLoading) return
    setActionLoading(action)
    try {
      const res = await fetch('/api/outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId: latestRun.id, action }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }
      onToast(
        action === 'accepted' ? 'Changes accepted' : 'Changes rejected',
        action === 'accepted' ? 'success' : 'error',
      )
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : `Failed to ${action} changes`,
        'error',
      )
    } finally {
      setActionLoading(null)
    }
  }

  const openFocusedRerun = async () => {
    if (!latestRun) return
    if (focusedPrompt) {
      setShowPrompt(true)
      return
    }
    setActionLoading('rerun')
    try {
      const res = await fetch(`/api/runs/${latestRun.id}`)
      const data = (await res.json()) as { focusedRerunPrompt: string | null }
      if (!data.focusedRerunPrompt) {
        onToast('No mismatches — focused rerun not needed', 'success')
      } else {
        setFocusedPrompt(data.focusedRerunPrompt)
        setShowPrompt(true)
      }
    } catch {
      onToast('Failed to generate focused rerun prompt', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  if (!latestRun) {
    return (
      <div>
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            color: C.textMuted,
            cursor: 'pointer',
            fontSize: 13,
            padding: 0,
            marginBottom: 20,
          }}
        >
          {'\u2190 Back to dashboard'}
        </button>
        <div
          style={{
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 24,
            color: C.textMuted,
          }}
        >
          No runs yet for <span style={{ color: C.text }}>{task.title}</span>.
        </div>
      </div>
    )
  }

  const blockers = report?.mismatches.filter((m) => m.severity === 'blocker') ?? []
  const warnings = report?.mismatches.filter((m) => m.severity === 'warning') ?? []

  const tabs: { id: 'changes' | 'skipped' | 'tests' | 'trace' | 'rules'; label: string }[] = [
    { id: 'changes', label: 'Changes' },
    {
      id: 'skipped',
      label: `Skipped (${report?.filesSkipped.length ?? 0})`,
    },
    { id: 'tests', label: 'Tests' },
    { id: 'trace', label: 'Decision Trace' },
    { id: 'rules', label: 'Rules & Skills' },
  ]

  return (
    <div>
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: C.textMuted,
          cursor: 'pointer',
          fontSize: 13,
          padding: 0,
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {'\u2190 Back to dashboard'}
      </button>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              color: C.textMuted,
              fontSize: 11,
              fontFamily: 'monospace',
              marginBottom: 4,
            }}
          >
            AUDIT REPORT · {latestRun.id}
          </div>
          <h2 style={{ color: C.text, fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>
            {task.title}
          </h2>
          <div
            style={{
              color: C.textMuted,
              fontSize: 12,
              fontFamily: 'monospace',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Icon d={Icons.git} size={12} stroke={C.textMuted} />
            {latestRun.branch}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {report && (
            <Badge label={report.confidence} color={confidenceColor(report.confidence)} />
          )}
        </div>
      </div>

      {loading && (
        <>
          <SkeletonRow />
          <SkeletonRow />
        </>
      )}

      {!loading && report && (
        <>
          {blockers.length > 0 && (
            <div
              style={{
                background: C.redDim,
                border: `1px solid ${C.red}44`,
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <Icon d={Icons.alert} size={15} stroke={C.redText} />
                <span style={{ color: C.redText, fontWeight: 700, fontSize: 13 }}>
                  {blockers.length} Blocker{blockers.length > 1 ? 's' : ''}
                  {' \u2014 Merge not safe'}
                </span>
              </div>
              {blockers.map((b, i) => (
                <div
                  key={i}
                  style={{ color: C.textDim, fontSize: 12, marginLeft: 23 }}
                >
                  · {b.description}
                </div>
              ))}
            </div>
          )}

          {warnings.length > 0 && (
            <div
              style={{
                background: C.yellowDim,
                border: `1px solid ${C.yellow}44`,
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  color: C.yellowText,
                  fontWeight: 700,
                  fontSize: 13,
                  marginBottom: 6,
                }}
              >
                ⚠ {warnings.length} Warning{warnings.length > 1 ? 's' : ''}
              </div>
              {warnings.map((w, i) => (
                <div key={i} style={{ color: C.textDim, fontSize: 12 }}>
                  · {w.description}
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              gap: 4,
              borderBottom: `1px solid ${C.border}`,
              marginBottom: 16,
            }}
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom:
                    activeTab === t.id
                      ? `2px solid ${C.accent}`
                      : '2px solid transparent',
                  color: activeTab === t.id ? C.accent : C.textMuted,
                  padding: '8px 14px',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'changes' && (
            <div>
              {report.filesChanged.length === 0 ? (
                <div style={{ color: C.textMuted, fontSize: 13, padding: 16 }}>
                  No file edits recorded.
                </div>
              ) : (
                report.filesChanged.map((f) => <FileDiff key={f.id} file={f} />)
              )}
            </div>
          )}

          {activeTab === 'skipped' && (
            <div>
              <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 12 }}>
                Files Cursor inspected but did not modify, and reasons why.
              </div>
              {report.filesSkipped.map((f, i) => (
                <SkippedFile key={i} file={f} />
              ))}
              {report.todosLeft.map((t, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 14px',
                    background: C.yellowDim,
                    border: `1px solid ${C.yellow}33`,
                    borderRadius: 6,
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      alignItems: 'center',
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        color: C.yellowText,
                        fontSize: 11,
                        fontFamily: 'monospace',
                        fontWeight: 700,
                      }}
                    >
                      TODO
                    </span>
                    <span
                      style={{
                        color: C.textMuted,
                        fontSize: 11,
                        fontFamily: 'monospace',
                      }}
                    >
                      {t.file}:{t.line}
                    </span>
                  </div>
                  <div style={{ color: C.textDim, fontSize: 12 }}>{t.reason}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'tests' && (
            <div>
              {report.testsRun.map((t, i) => (
                <TestPill key={i} test={t} />
              ))}
            </div>
          )}

          {activeTab === 'trace' && (
            <div>
              <div style={{ color: C.textMuted, fontSize: 12, marginBottom: 12 }}>
                Why Cursor made each non-trivial edit.
              </div>
              {report.decisionTrace.map((d, i) => (
                <div
                  key={i}
                  style={{
                    background: C.bgCard,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: '12px 14px',
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      color: C.accent,
                      fontSize: 12,
                      fontFamily: 'monospace',
                      marginBottom: 6,
                    }}
                  >
                    {d.file}
                  </div>
                  <div style={{ color: C.textDim, fontSize: 13 }}>{d.decision}</div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'rules' && (
            <div>
              {report.rulesRead.length === 0 && report.skillsUsed.length === 0 ? (
                <div
                  style={{
                    color: C.textMuted,
                    fontSize: 13,
                    padding: '16px 0',
                    fontStyle: 'italic',
                  }}
                >
                  No rules/skills recorded — update your .cursor/rules.mdc to emit these fields.
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        color: C.textMuted,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginBottom: 10,
                      }}
                    >
                      Rules Read
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {report.rulesRead.length === 0 ? (
                        <span style={{ color: C.textMuted, fontSize: 12 }}>None recorded.</span>
                      ) : (
                        report.rulesRead.map((r, i) => (
                          <span
                            key={i}
                            style={{
                              fontFamily: 'monospace',
                              fontSize: 12,
                              color: C.accent,
                              background: C.accentDim,
                              border: `1px solid ${C.accent}`,
                              borderRadius: 4,
                              padding: '3px 10px',
                            }}
                          >
                            {r}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        color: C.textMuted,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginBottom: 10,
                      }}
                    >
                      Skills Used
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {report.skillsUsed.length === 0 ? (
                        <span style={{ color: C.textMuted, fontSize: 12 }}>None recorded.</span>
                      ) : (
                        report.skillsUsed.map((s, i) => (
                          <span
                            key={i}
                            style={{
                              fontFamily: 'monospace',
                              fontSize: 12,
                              color: C.purple,
                              background: C.purpleDim,
                              border: `1px solid ${C.purple}`,
                              borderRadius: 4,
                              padding: '3px 10px',
                            }}
                          >
                            {s}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <div
            style={{
              marginTop: 20,
              background: C.bgCard,
              border: `1px solid ${C.borderBright}`,
              borderRadius: 8,
              padding: 16,
            }}
          >
            <div
              style={{ color: C.text, fontWeight: 700, fontSize: 13, marginBottom: 12 }}
            >
              Next Steps
            </div>
            {report.nextSteps.map((step, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    color: C.accent,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    minWidth: 20,
                  }}
                >
                  {i + 1}.
                </span>
                <span style={{ color: C.textDim, fontSize: 13 }}>{step}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
              <button
                onClick={openFocusedRerun}
                disabled={!!actionLoading}
                style={{
                  flex: '1 1 200px',
                  background: C.accentDim,
                  border: `1px solid ${C.accent}`,
                  color: C.accent,
                  padding: '10px 16px',
                  borderRadius: 6,
                  cursor: actionLoading ? 'wait' : 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                ⚡ {actionLoading === 'rerun' ? 'Loading...' : 'Create Focused Rerun'}
              </button>
              <button
                onClick={() => sendOutcome('accepted')}
                disabled={!!actionLoading}
                style={{
                  background: C.greenDim,
                  border: `1px solid ${C.green}`,
                  color: C.greenText,
                  padding: '10px 20px',
                  borderRadius: 6,
                  cursor: actionLoading ? 'wait' : 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                ✓ {actionLoading === 'accepted' ? 'Saving...' : 'Accept Changes'}
              </button>
              <button
                onClick={() => sendOutcome('rejected')}
                disabled={!!actionLoading}
                style={{
                  background: C.redDim,
                  border: `1px solid ${C.red}44`,
                  color: C.redText,
                  padding: '10px 20px',
                  borderRadius: 6,
                  cursor: actionLoading ? 'wait' : 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                ✗ {actionLoading === 'rejected' ? 'Saving...' : 'Reject'}
              </button>
            </div>
          </div>
        </>
      )}

      {!loading && !report && latestRun && (
        <div style={{ background: C.bgCard, border: `1px dashed ${C.border}`, borderRadius: 8, padding: 24, color: C.textMuted, fontSize: 13 }}>
          No audit data yet for this run. Upload a <code style={{ color: C.accent }}>last_run.json</code> via the{' '}
          <a href="/upload" style={{ color: C.accent }}>Upload page</a> or use{' '}
          <code style={{ color: C.accent }}>node opstwin-cli.js upload</code>.
        </div>
      )}

      {latestRun && (
        <RunObservations runId={latestRun.id} onToast={onToast} />
      )}

      {showPrompt && focusedPrompt && (
        <PromptModal
          prompt={focusedPrompt}
          onClose={() => setShowPrompt(false)}
          onToast={onToast}
        />
      )}
    </div>
  )
}

// ── Memory View ──────────────────────────────────────────────────────────────
function MemoryView({ memory, loading }: { memory: MemoryEntry[]; loading: boolean }) {
  return (
    <div>
      <div
        style={{
          color: C.textMuted,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        PATTERN MEMORY
      </div>
      <h2 style={{ color: C.text, fontSize: 20, fontWeight: 700, margin: '0 0 8px' }}>
        Learned Patterns
      </h2>
      <p style={{ color: C.textMuted, fontSize: 13, margin: '0 0 24px' }}>
        OpsTwin clusters failures by type and surfaces better prompts for future tasks.
      </p>

      {loading && (
        <>
          <SkeletonRow />
          <SkeletonRow />
        </>
      )}

      {!loading && memory.length === 0 && (
        <div
          style={{
            background: C.bgCard,
            border: `1px dashed ${C.border}`,
            borderRadius: 8,
            padding: 32,
            textAlign: 'center',
            color: C.textMuted,
            fontSize: 13,
          }}
        >
          No memory entries yet. Upload an audit JSON to start learning.
        </div>
      )}

      {memory.map((m) => (
        <div
          key={m.id}
          style={{
            background: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: 16,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
            }}
          >
            <Badge label={m.taskType} color={C.purple} bg={C.purpleDim} />
            <span style={{ color: C.text, fontWeight: 600, fontSize: 14, flex: 1 }}>
              {m.outcomeSummary}
            </span>
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  color:
                    m.successRate > 0.7
                      ? C.greenText
                      : m.successRate > 0.5
                        ? C.yellowText
                        : C.redText,
                  fontWeight: 700,
                  fontSize: 15,
                  fontFamily: 'monospace',
                }}
              >
                {Math.round(m.successRate * 100)}%
              </div>
              <div style={{ color: C.textMuted, fontSize: 10 }}>
                success · {m.reuseCount} uses
              </div>
            </div>
          </div>

          <div
            style={{
              height: 3,
              background: C.border,
              borderRadius: 2,
              marginBottom: 10,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${m.successRate * 100}%`,
                background:
                  m.successRate > 0.7
                    ? C.green
                    : m.successRate > 0.5
                      ? C.yellow
                      : C.red,
                borderRadius: 2,
              }}
            />
          </div>

          <div
            style={{
              color: C.textMuted,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: 4,
            }}
          >
            Suggested Fix
          </div>
          <div style={{ color: C.textDim, fontSize: 13 }}>{m.improvementSuggestion}</div>
        </div>
      ))}
    </div>
  )
}

// ── App Shell ────────────────────────────────────────────────────────────────
export default function OpsTwin() {
  const [view, setView] = useState<'dashboard' | 'memory' | 'audit' | 'guide'>('dashboard')
  const [taskTab, setTaskTab] = useState<'audit' | 'plan'>('plan')
  const [taskPlanStatus, setTaskPlanStatus] = useState<string | null>(null)
  const [selectedTask, setSelectedTask] = useState<TaskWithRuns | null>(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [tasks, setTasks] = useState<TaskWithRuns[]>([])
  const [memory, setMemory] = useState<MemoryEntry[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)
  const [memoryLoading, setMemoryLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; variant: 'error' | 'success' } | null>(
    null,
  )

  const pushToast = useCallback((msg: string, variant: 'error' | 'success') => {
    setToast({ msg, variant })
  }, [])

  const loadTasks = useCallback(async () => {
    setTasksLoading(true)
    try {
      const res = await fetch('/api/tasks')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { tasks: TaskWithRuns[] }
      setTasks(data.tasks)
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to load tasks', 'error')
    } finally {
      setTasksLoading(false)
    }
  }, [pushToast])

  const loadMemory = useCallback(async () => {
    setMemoryLoading(true)
    try {
      const res = await fetch('/api/memory')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { entries: MemoryEntry[] }
      setMemory(data.entries)
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Failed to load memory', 'error')
    } finally {
      setMemoryLoading(false)
    }
  }, [pushToast])

  useEffect(() => {
    loadTasks()
    loadMemory()
  }, [loadTasks, loadMemory])

  useEffect(() => {
    const hasRunning = tasks.some((t) => t.runs[0]?.status === 'running')
    if (!hasRunning) return
    const interval = setInterval(loadTasks, 5000)
    return () => clearInterval(interval)
  }, [tasks, loadTasks])

  useEffect(() => {
    if (!selectedTask) {
      setTaskPlanStatus(null)
      return
    }
    fetch(`/api/plans?taskId=${selectedTask.id}`)
      .then((r) => r.json())
      .then((d: { plan?: { status: string } | null }) => setTaskPlanStatus(d.plan?.status ?? null))
      .catch(() => setTaskPlanStatus(null))
  }, [selectedTask])

  const workflowStep = useMemo(() => {
    if (selectedTask) {
      return detectWorkflowStep({
        hasTask: true,
        planStatus: taskPlanStatus,
        runStatus: selectedTask.runs[0]?.status ?? 'none',
      })
    }
    return tasks.length === 0 ? 1 : 2
  }, [selectedTask, taskPlanStatus, tasks])

  const openGuide = useCallback(() => setView('guide'), [])

  const navItems = useMemo(
    () => [
      { id: 'dashboard' as const, icon: Icons.layers, label: 'Tasks' },
      { id: 'memory' as const, icon: Icons.brain, label: 'Memory' },
      { id: 'guide' as const, icon: Icons.help, label: 'Guide' },
    ],
    [],
  )

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: C.bg,
        color: C.text,
        fontFamily: "'IBM Plex Mono', 'Fira Code', 'Courier New', monospace",
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: 56,
          background: C.bgCard,
          borderRight: `1px solid ${C.border}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px 0',
          gap: 4,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            color: C.accent,
            fontWeight: 900,
            fontSize: 13,
            letterSpacing: '-0.05em',
            marginBottom: 20,
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            transform: 'rotate(180deg)',
          }}
        >
          OPS
        </div>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setView(item.id)
              if (item.id !== 'guide') setSelectedTask(null)
            }}
            title={item.label}
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: view === item.id ? C.accentDim : 'none',
              border:
                view === item.id ? `1px solid ${C.accent}44` : '1px solid transparent',
              borderRadius: 8,
              cursor: 'pointer',
              color: view === item.id ? C.accent : C.textMuted,
              transition: 'all 0.15s',
            }}
          >
            <Icon d={item.icon} size={16} stroke="currentColor" />
          </button>
        ))}
        <Link
          href="/upload"
          title="Upload audit"
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'none',
            border: '1px solid transparent',
            borderRadius: 8,
            color: C.textMuted,
            textDecoration: 'none',
          }}
        >
          <Icon d={Icons.upload} size={16} stroke="currentColor" />
        </Link>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowNewTask(true)}
          title="New Task"
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: C.accent,
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            color: '#000',
          }}
        >
          <Icon d={Icons.plus} size={16} stroke="currentColor" />
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
        {view === 'dashboard' && !selectedTask && (
          <Dashboard
            tasks={tasks}
            loading={tasksLoading}
            memory={memory}
            workflowStep={workflowStep}
            onOpenGuide={openGuide}
            onSelect={(task) => {
              setSelectedTask(task)
              setTaskTab('plan')
              setView('audit')
            }}
          />
        )}
        {view === 'guide' && (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
                gap: 12,
              }}
            >
              <div>
                <div
                  style={{
                    color: C.textMuted,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Reference
                </div>
                <h2 style={{ color: C.text, fontSize: 20, fontWeight: 700, margin: '4px 0 0' }}>
                  How OpsTwin works
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setView(selectedTask ? 'audit' : 'dashboard')}
                style={{
                  background: C.bgCard,
                  border: `1px solid ${C.border}`,
                  color: C.textMuted,
                  padding: '6px 12px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: 12,
                }}
              >
                ← Back
              </button>
            </div>
            <WorkflowGuide
              currentStep={workflowStep}
              taskId={selectedTask?.id}
              showCliHint
            />
          </div>
        )}
        {view === 'audit' && selectedTask && (
          <div>
            <WorkflowStrip
              currentStep={workflowStep}
              onOpenGuide={openGuide}
            />
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(['plan', 'audit'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTaskTab(tab)}
                  style={{
                    background: taskTab === tab ? C.accentDim : 'transparent',
                    border: `1px solid ${taskTab === tab ? C.accent + '44' : C.border}`,
                    color: taskTab === tab ? C.accent : C.textMuted,
                    padding: '8px 16px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {tab === 'plan' ? 'MVP Plan' : 'Audit'}
                </button>
              ))}
              <button
                onClick={() => {
                  setSelectedTask(null)
                  setView('dashboard')
                  loadTasks()
                }}
                style={{
                  marginLeft: 'auto',
                  background: 'none',
                  border: 'none',
                  color: C.textMuted,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: 'inherit',
                }}
              >
                {'\u2190 Back'}
              </button>
            </div>
            {taskTab === 'plan' ? (
              <PlanView
                taskId={selectedTask.id}
                taskTitle={selectedTask.title}
                onToast={pushToast}
                onPlanChange={setTaskPlanStatus}
              />
            ) : (
              <AuditView
                task={selectedTask}
                onBack={() => {
                  setSelectedTask(null)
                  setView('dashboard')
                  loadTasks()
                }}
                onToast={pushToast}
              />
            )}
          </div>
        )}
        {view === 'memory' && <MemoryView memory={memory} loading={memoryLoading} />}
      </div>

      {showNewTask && (
        <NewTaskModal
          onClose={() => setShowNewTask(false)}
          onCreated={() => {
            loadTasks()
          }}
          onToast={pushToast}
          memory={memory}
        />
      )}

      {toast && (
        <Toast
          message={toast.msg}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
