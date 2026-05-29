'use client'

import type { TimelineEvent } from '@/types'

const C = {
  border: '#1e2530',
  text: '#e2e8f0',
  textMuted: '#64748b',
  textDim: '#94a3b8',
  greenText: '#34d399',
  redText: '#f87171',
  yellowText: '#fbbf24',
  accent: '#00d4ff',
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return iso
  }
}

function severityColor(s?: TimelineEvent['severity']) {
  switch (s) {
    case 'success':
      return C.greenText
    case 'error':
      return C.redText
    case 'warning':
      return C.yellowText
    default:
      return C.textDim
  }
}

function kindIcon(kind: TimelineEvent['kind']) {
  switch (kind) {
    case 'step_completed':
    case 'plan_approved':
    case 'proposal_delivered':
      return '✓'
    case 'step_failed':
    case 'cursor_run_finished':
      return '✗'
    case 'step_started':
    case 'cursor_run_queued':
      return '▶'
    default:
      return '·'
  }
}

export default function ActivityTimeline({
  events,
  loading,
}: {
  events: TimelineEvent[]
  loading?: boolean
}) {
  if (loading) {
    return <div style={{ fontSize: 12, color: C.textMuted }}>Loading activity…</div>
  }

  if (events.length === 0) {
    return (
      <div style={{ fontSize: 12, color: C.textMuted }}>
        No activity yet — approve a plan or upload a run to see timestamps here.
      </div>
    )
  }

  return (
    <div
      style={{
        maxHeight: 320,
        overflowY: 'auto',
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        background: '#0a0c10',
      }}
    >
      {events.slice(0, 40).map((ev) => (
        <div
          key={ev.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '140px 20px 1fr',
            gap: 8,
            padding: '10px 12px',
            borderBottom: `1px solid ${C.border}`,
            fontSize: 12,
          }}
        >
          <div style={{ color: C.textMuted, fontFamily: 'monospace', fontSize: 10 }}>
            {fmtTime(ev.at)}
          </div>
          <div style={{ color: severityColor(ev.severity) }}>{kindIcon(ev.kind)}</div>
          <div>
            <div style={{ color: C.text, fontWeight: 600 }}>{ev.title}</div>
            {ev.detail && (
              <div style={{ color: C.textDim, marginTop: 2, fontSize: 11 }}>{ev.detail}</div>
            )}
            {ev.stepOrder != null && (
              <div style={{ color: C.accent, fontSize: 10, marginTop: 2 }}>
                Step {ev.stepOrder}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
