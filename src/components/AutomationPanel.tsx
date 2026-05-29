'use client'

import { useCallback, useEffect, useState } from 'react'
import { TaskIdChip } from '@/components/TaskIdChip'

const C = {
  bgCard: '#0f1218',
  border: '#1e2530',
  text: '#e2e8f0',
  textMuted: '#64748b',
  textDim: '#94a3b8',
  green: '#10b981',
  greenText: '#34d399',
  red: '#ef4444',
  redText: '#f87171',
  yellow: '#f59e0b',
  yellowText: '#fbbf24',
  accent: '#00d4ff',
  accentDim: '#003344',
}

type NextAction =
  | 'connect_cli'
  | 'review_draft'
  | 'wait_delivery'
  | 'agent_running'
  | 'run_agent'
  | 'propose_next'
  | 'idle'

interface CliStatus {
  connected: boolean
  autoRun?: boolean
  pendingDelivery: number
  draftProposals: number
  nextAction?: NextAction
  pendingRun?: { id: string; createdAt: string } | null
  runningRun?: { id: string; startedAt: string | null } | null
  lastDelivered?: {
    proposalId: string
    deliveredAt: string
    promptPreview: string
  } | null
  session?: { repoPath?: string; lastSeen?: string }
  lastRun?: { id: string; status: string; finishedAt: string | null } | null
}

interface AutomationPanelProps {
  taskId: string
  onToast: (msg: string, variant: 'error' | 'success') => void
  onPropose?: () => void
  latestProposalId?: string
}

const ACTION_COPY: Record<
  NextAction,
  { title: string; detail: string; tone: 'red' | 'yellow' | 'green' | 'accent' | 'muted' }
> = {
  connect_cli: {
    title: 'Start the automation CLI',
    detail: 'Run loop in your project folder (needs CURSOR_API_KEY for full auto-run).',
    tone: 'red',
  },
  review_draft: {
    title: 'Review improved prompt',
    detail: 'OpsTwin analyzed the last run and found gaps. Approve below, then CLI runs Cursor.',
    tone: 'yellow',
  },
  wait_delivery: {
    title: 'CLI is working…',
    detail: 'Delivering prompt or starting Cursor agent in your repo.',
    tone: 'accent',
  },
  agent_running: {
    title: 'Cursor agent is running',
    detail: 'Wait for the terminal to finish. Audit will upload automatically; a new draft proposal will appear.',
    tone: 'accent',
  },
  run_agent: {
    title: 'Ready — run Cursor from dashboard or CLI',
    detail:
      'Prompt is in your repo. Click "Run in Cursor now" (needs daemon + CURSOR_API_KEY) or run: node opstwin-cli.js run-agent',
    tone: 'green',
  },
  propose_next: {
    title: 'Generate next precise prompt',
    detail: 'Last audit processed. Propose uses gaps + memory to reduce hallucination and wasted tokens.',
    tone: 'accent',
  },
  idle: {
    title: 'Waiting',
    detail: 'Create a plan, approve a prompt, or start the loop CLI.',
    tone: 'muted',
  },
}

export default function AutomationPanel({
  taskId,
  onToast,
  onPropose,
  latestProposalId,
}: AutomationPanelProps) {
  const [status, setStatus] = useState<CliStatus | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const loopCmd = `node opstwin-cli.js loop ${taskId}`

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/cli/status?taskId=${encodeURIComponent(taskId)}`)
      if (!res.ok) {
        setStatus({ connected: false, pendingDelivery: 0, draftProposals: 0, nextAction: 'connect_cli' })
        return
      }
      setStatus((await res.json()) as CliStatus)
    } catch {
      setStatus({ connected: false, pendingDelivery: 0, draftProposals: 0, nextAction: 'connect_cli' })
    }
  }, [taskId])

  useEffect(() => {
    void loadStatus()
    const id = setInterval(() => void loadStatus(), 4000)
    return () => clearInterval(id)
  }, [loadStatus])

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      onToast(`${label} copied`, 'success')
    } catch {
      onToast('Copy failed', 'error')
    }
  }

  const disconnect = async () => {
    setBusy('disconnect')
    try {
      const res = await fetch('/api/cli/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onToast('CLI disconnected — stop the daemon terminal with Ctrl+C', 'success')
      await loadStatus()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Disconnect failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  const runInCursor = async () => {
    setBusy('run')
    try {
      const res = await fetch('/api/cli/run-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          proposalId: latestProposalId ?? status?.lastDelivered?.proposalId,
        }),
      })
      if (!res.ok) {
        const e = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(e?.error ?? `HTTP ${res.status}`)
      }
      onToast('Queued for Cursor — daemon will run the agent (watch terminal)', 'success')
      await loadStatus()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Run request failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  const toggleAutoRun = async (enabled: boolean) => {
    setBusy('auto')
    try {
      const res = await fetch('/api/cli/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, autoRun: enabled }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onToast(
        enabled
          ? 'Auto-run enabled — restart daemon with: node opstwin-cli.js loop'
          : 'Auto-run disabled',
        'success',
      )
      await loadStatus()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Settings failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  const connected = status?.connected ?? false
  const nextAction = status?.nextAction ?? (connected ? 'idle' : 'connect_cli')
  const action = ACTION_COPY[nextAction]

  const toneStyles = {
    red: { border: C.red, bg: '#1a1010', color: C.redText },
    yellow: { border: C.yellow, bg: '#1a1508', color: C.yellowText },
    green: { border: C.green, bg: '#052e22', color: C.greenText },
    accent: { border: C.accent, bg: C.accentDim, color: C.accent },
    muted: { border: C.border, bg: '#0a0c10', color: C.textDim },
  }[action.tone]

  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${connected ? '#065f46' : C.border}`,
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>OpsTwin automation loop</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>
            Plan → approve → Cursor runs → audit → gap analysis → better prompt (you stay in control)
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              borderRadius: 999,
              background: connected ? '#052e22' : '#1a1010',
              border: `1px solid ${connected ? C.green : C.red}`,
              fontSize: 12,
              fontWeight: 700,
              color: connected ? C.greenText : C.redText,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: connected ? C.green : C.red,
              }}
            />
            {connected ? 'CLI connected' : 'CLI not connected'}
          </div>
          {connected && (
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={!!busy}
              style={{
                background: 'transparent',
                border: `1px solid ${C.border}`,
                color: C.textMuted,
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {busy === 'disconnect' ? '…' : 'Disconnect CLI'}
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 8,
          border: `1px solid ${toneStyles.border}`,
          background: toneStyles.bg,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, marginBottom: 6 }}>
          WHAT TO DO NOW
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: toneStyles.color, marginBottom: 6 }}>
          {action.title}
        </div>
        <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.55 }}>{action.detail}</div>
        {status?.lastDelivered?.promptPreview && (
          <pre
            style={{
              marginTop: 10,
              marginBottom: 0,
              padding: 10,
              background: '#06080c',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              fontSize: 11,
              color: C.textDim,
              whiteSpace: 'pre-wrap',
              maxHeight: 100,
              overflow: 'auto',
            }}
          >
            {status.lastDelivered.promptPreview}
          </pre>
        )}
        {status?.lastRun?.finishedAt && (
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 10 }}>
            Last run: {status.lastRun.status} ·{' '}
            {new Date(status.lastRun.finishedAt).toLocaleString()} ·{' '}
            {status.lastRun.id.slice(0, 8)}…
          </div>
        )}
        {status?.session?.lastSeen && (
          <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>
            CLI heartbeat: {new Date(status.session.lastSeen).toLocaleString()}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {connected && (
          <button
            type="button"
            onClick={() => void runInCursor()}
            disabled={!!busy || nextAction === 'agent_running'}
            style={{
              background: C.accent,
              color: '#000',
              border: 'none',
              padding: '8px 14px',
              borderRadius: 6,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
            }}
          >
            {busy === 'run' ? '…' : 'Run in Cursor now'}
          </button>
        )}
        {onPropose && (
          <button
            type="button"
            onClick={onPropose}
            style={{
              background: 'transparent',
              border: `1px solid ${C.accent}`,
              color: C.accent,
              padding: '8px 14px',
              borderRadius: 6,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
            }}
          >
            Propose next prompt
          </button>
        )}
        <button
          type="button"
          onClick={() => toggleAutoRun(!(status?.autoRun ?? false))}
          disabled={!!busy}
          style={{
            background: status?.autoRun ? C.accentDim : 'transparent',
            border: `1px solid ${C.border}`,
            color: status?.autoRun ? C.accent : C.textMuted,
            padding: '8px 14px',
            borderRadius: 6,
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Auto-run: {status?.autoRun ? 'ON' : 'OFF'}
        </button>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8, fontWeight: 700 }}>
          Full automation — one command in your repo (PowerShell)
        </div>
        <pre
          style={{
            margin: '0 0 8px',
            padding: '10px 12px',
            background: '#06080c',
            border: `1px solid ${C.accentDim}`,
            borderRadius: 6,
            fontSize: 11,
            color: C.accent,
          }}
        >
          {`$env:CURSOR_API_KEY="your-key-from-cursor.com/settings"\n${loopCmd}`}
        </pre>
        <button
          type="button"
          onClick={() =>
            copy(
              `$env:CURSOR_API_KEY="your-key"\n${loopCmd}`,
              'Full loop command',
            )
          }
          style={{
            background: 'transparent',
            border: `1px solid ${C.border}`,
            color: C.textMuted,
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Copy full loop command
        </button>
      </div>

      <div style={{ marginTop: 10 }}>
        <TaskIdChip id={taskId} compact onCopied={(msg) => onToast(msg, 'success')} />
      </div>
    </div>
  )
}
