'use client'

// src/app/upload/page.tsx
// Drag-and-drop a Cursor last_run.json. We validate it locally, POST to
// /api/runs with action="upload_audit", then render the resulting AuditReport
// with mismatches highlighted and a copy-to-clipboard focused rerun prompt.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { AuditReport } from '@/types'

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
  accent: '#00d4ff',
  accentDim: '#003344',
} as const

interface ValidatedAudit {
  runId: string
  taskId?: string
  raw: Record<string, unknown>
}

function validateAuditJson(parsed: unknown): { ok: true; value: ValidatedAudit } | { ok: false; error: string } {
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'JSON root must be an object' }
  }
  const obj = parsed as Record<string, unknown>
  const runId = obj.run_id ?? obj.runId
  if (typeof runId !== 'string' || runId.length === 0) {
    return { ok: false, error: 'Missing required field: run_id' }
  }
  const filesChanged = obj.files_changed ?? obj.filesChanged
  if (!Array.isArray(filesChanged)) {
    return { ok: false, error: 'Missing required field: files_changed (must be array)' }
  }
  return {
    ok: true,
    value: {
      runId,
      taskId: typeof obj.task_id === 'string' ? obj.task_id : undefined,
      raw: obj,
    },
  }
}

type TaskOption = { id: string; title: string; repo: string }

export default function UploadPage() {
  const [dragActive, setDragActive] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [tasks, setTasks] = useState<TaskOption[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [pendingAudit, setPendingAudit] = useState<ValidatedAudit | null>(null)
  const [report, setReport] = useState<AuditReport | null>(null)
  const [focusedPrompt, setFocusedPrompt] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; variant: 'error' | 'success' } | null>(
    null,
  )
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    fetch('/api/tasks')
      .then((r) => r.json() as Promise<{ tasks: TaskOption[] }>)
      .then((d) => {
        setTasks(d.tasks)
        if (d.tasks.length > 0) setSelectedTaskId(d.tasks[0].id)
      })
      .catch(() => setToast({ msg: 'Failed to load tasks list', variant: 'error' }))
  }, [])

  const handleFile = useCallback(async (file: File) => {
    setReport(null)
    setFocusedPrompt(null)
    setPendingAudit(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const result = validateAuditJson(parsed)
      if (!result.ok) {
        setToast({ msg: result.error, variant: 'error' })
        return
      }
      setPendingAudit(result.value)
      setToast({ msg: `Loaded ${file.name}`, variant: 'success' })
    } catch {
      setToast({ msg: 'File is not valid JSON', variant: 'error' })
    }
  }, [])

  const submitAudit = useCallback(async () => {
    if (!pendingAudit || !selectedTaskId || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload_audit',
          runId: pendingAudit.runId,
          taskId: selectedTaskId,
          auditJson: pendingAudit.raw,
        }),
      })
      const data = (await res.json()) as {
        report?: AuditReport
        focusedRerunPrompt?: string | null
        error?: string
      }
      if (!res.ok || !data.report) {
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      setReport(data.report)
      setFocusedPrompt(data.focusedRerunPrompt ?? null)
      setToast({ msg: 'Audit ingested', variant: 'success' })
    } catch (err) {
      setToast({
        msg: err instanceof Error ? err.message : 'Failed to upload audit',
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }, [pendingAudit, selectedTaskId, submitting])

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.json')) {
      setToast({ msg: 'Only .json files are supported', variant: 'error' })
      return
    }
    handleFile(file)
  }

  const copyPrompt = async () => {
    if (!focusedPrompt) return
    try {
      await navigator.clipboard.writeText(focusedPrompt)
      setToast({ msg: 'Focused rerun prompt copied', variant: 'success' })
    } catch {
      setToast({ msg: 'Failed to copy — select manually', variant: 'error' })
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        color: C.text,
        padding: '32px 24px',
        fontFamily: "'IBM Plex Mono', 'Fira Code', 'Courier New', monospace",
      }}
    >
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <Link
          href="/"
          style={{
            color: C.textMuted,
            fontSize: 13,
            display: 'inline-block',
            marginBottom: 18,
          }}
        >
          {'\u2190 Back to dashboard'}
        </Link>

        <h1 style={{ color: C.text, fontSize: 24, fontWeight: 700, margin: '0 0 6px' }}>
          Upload Audit JSON
        </h1>
        <p style={{ color: C.textMuted, fontSize: 13, marginTop: 0 }}>
          Drop a <code style={{ color: C.accent }}>.ops/runs/&lt;id&gt;/last_run.json</code>{' '}
          to ingest it. We validate, parse mismatches, and generate a focused rerun prompt.
        </p>

        <div style={{ marginTop: 18 }}>
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
            Attach to task
          </label>
          <select
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
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
              fontFamily: 'inherit',
            }}
          >
            {tasks.length === 0 && <option value="">(no tasks — create one first)</option>}
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} · {t.repo}
              </option>
            ))}
          </select>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            marginTop: 16,
            border: `2px dashed ${dragActive ? C.accent : C.border}`,
            background: dragActive ? C.accentDim : C.bgCard,
            borderRadius: 12,
            padding: '48px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <div
            style={{
              fontSize: 38,
              color: dragActive ? C.accent : C.textMuted,
              lineHeight: 1,
            }}
          >
            ⬆
          </div>
          <div style={{ color: C.text, fontWeight: 700, marginTop: 12 }}>
            {pendingAudit
              ? `Loaded run ${pendingAudit.runId}`
              : 'Drop last_run.json here or click to browse'}
          </div>
          <div style={{ color: C.textMuted, fontSize: 12, marginTop: 6 }}>
            Required fields: <code>run_id</code>, <code>files_changed</code>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
              e.target.value = ''
            }}
          />
        </div>

        {pendingAudit && !report && (
          <button
            onClick={submitAudit}
            disabled={!selectedTaskId || submitting}
            style={{
              marginTop: 14,
              width: '100%',
              background: C.accent,
              border: 'none',
              color: '#000',
              padding: '12px 0',
              borderRadius: 8,
              cursor: !selectedTaskId || submitting ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 700,
              opacity: !selectedTaskId ? 0.55 : 1,
            }}
          >
            {submitting ? 'Ingesting...' : 'Ingest Audit \u2192'}
          </button>
        )}

        {report && (
          <div style={{ marginTop: 28 }}>
            <h2 style={{ color: C.text, fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>
              Audit Report · {report.runId}
            </h2>

            {report.mismatches.length > 0 && (
              <div
                style={{
                  background: C.bgCard,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    color: C.textMuted,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    marginBottom: 10,
                  }}
                >
                  Mismatches ({report.mismatches.length})
                </div>
                {report.mismatches.map((m, i) => {
                  const blocker = m.severity === 'blocker'
                  return (
                    <div
                      key={i}
                      style={{
                        background: blocker ? C.redDim : C.yellowDim,
                        border: `1px solid ${(blocker ? C.red : C.yellow)}44`,
                        borderRadius: 6,
                        padding: '10px 12px',
                        marginBottom: 6,
                      }}
                    >
                      <div
                        style={{
                          color: blocker ? C.redText : C.yellowText,
                          fontWeight: 700,
                          fontSize: 12,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          marginBottom: 4,
                        }}
                      >
                        {m.severity} · {m.type}
                      </div>
                      <div style={{ color: C.textDim, fontSize: 13 }}>{m.description}</div>
                      {m.suggestedFix && (
                        <div
                          style={{
                            color: C.textMuted,
                            fontSize: 12,
                            marginTop: 4,
                            fontStyle: 'italic',
                          }}
                        >
                          Suggested: {m.suggestedFix}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div
              style={{
                background: C.bgCard,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: 16,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  color: C.textMuted,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                Files Changed ({report.filesChanged.length})
              </div>
              {report.filesChanged.map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 0',
                    borderBottom: `1px solid ${C.border}`,
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: C.text, fontFamily: 'monospace', flex: 1 }}>
                    {f.path}
                  </span>
                  <span style={{ color: C.greenText, fontFamily: 'monospace' }}>
                    +{f.linesAdded}
                  </span>
                  <span style={{ color: C.redText, fontFamily: 'monospace' }}>
                    -{f.linesRemoved}
                  </span>
                </div>
              ))}
            </div>

            {focusedPrompt && (
              <div
                style={{
                  background: C.bgCard,
                  border: `1px solid ${C.borderBright}`,
                  borderRadius: 8,
                  padding: 16,
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
                  <div
                    style={{
                      color: C.accent,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      flex: 1,
                    }}
                  >
                    Focused Rerun Prompt
                  </div>
                  <button
                    onClick={copyPrompt}
                    style={{
                      background: C.accentDim,
                      border: `1px solid ${C.accent}`,
                      color: C.accent,
                      padding: '6px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Copy
                  </button>
                </div>
                <pre
                  style={{
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: 12,
                    color: C.textDim,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    margin: 0,
                    maxHeight: 320,
                    overflowY: 'auto',
                  }}
                >
                  {focusedPrompt}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            background: toast.variant === 'error' ? C.redDim : C.greenDim,
            border: `1px solid ${toast.variant === 'error' ? C.red : C.green}`,
            color: toast.variant === 'error' ? C.redText : C.greenText,
            padding: '10px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            zIndex: 200,
            maxWidth: 420,
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
