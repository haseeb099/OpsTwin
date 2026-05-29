'use client'

import type { ReactNode } from 'react'
import type { PlanStep } from '@/types'

const C = {
  border: '#1e2530',
  text: '#e2e8f0',
  textMuted: '#64748b',
  textDim: '#94a3b8',
  green: '#10b981',
  greenText: '#34d399',
  red: '#ef4444',
  redText: '#f87171',
  blue: '#3b82f6',
  blueText: '#60a5fa',
  accent: '#00d4ff',
}

function fmtTime(iso?: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function stepTone(status: PlanStep['status']) {
  switch (status) {
    case 'complete':
      return { border: C.green, bg: '#052e22', label: C.greenText, icon: '✓' }
    case 'failed':
      return { border: C.red, bg: '#1a1010', label: C.redText, icon: '✗' }
    case 'in_progress':
      return { border: C.blue, bg: '#0f172a', label: C.blueText, icon: '●' }
    default:
      return { border: C.border, bg: '#0a0c10', label: C.textMuted, icon: '○' }
  }
}

export interface PipelineStepperProps {
  steps: PlanStep[]
  planStatus: string
  busy?: boolean
  onStepAction: (order: number, action: 'mark_done' | 'mark_failed' | 'skip' | 'reset' | 'activate') => void
  onProposeStep: (order: number) => void
  onCopyPrompt: (step: PlanStep) => void
}

export default function PipelineStepper({
  steps,
  planStatus,
  busy,
  onStepAction,
  onProposeStep,
  onCopyPrompt,
}: PipelineStepperProps) {
  const doneCount = steps.filter((s) => s.status === 'complete').length
  const active = steps.find((s) => s.status === 'in_progress')

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ fontSize: 13, color: C.textDim }}>
          Pipeline · {doneCount}/{steps.length} done
          {active && (
            <span style={{ color: C.blueText, marginLeft: 8 }}>
              Active: Step {active.order} — {active.title}
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: C.textMuted }}>Plan: {planStatus}</div>
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
        {steps.map((step) => {
          const tone = stepTone(step.status)
          return (
            <div
              key={step.order}
              style={{
                minWidth: 200,
                flex: '1 1 180px',
                border: `1px solid ${tone.border}`,
                borderRadius: 8,
                background: tone.bg,
                padding: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ color: tone.label, fontWeight: 700 }}>{tone.icon}</span>
                <span style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>{step.order}</span>
                <span
                  style={{
                    fontSize: 10,
                    color: tone.label,
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  {step.skipped ? 'skipped' : step.status.replace('_', ' ')}
                </span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>
                {step.title}
              </div>
              <div style={{ fontSize: 10, color: C.textMuted, lineHeight: 1.4 }}>
                <div>Started: {fmtTime(step.startedAt)}</div>
                <div>Done: {fmtTime(step.completedAt)}</div>
                {step.lastRunId && (
                  <div title={step.lastRunId}>Run: {step.lastRunId.slice(0, 8)}…</div>
                )}
              </div>
              {planStatus !== 'draft' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                  {step.status === 'in_progress' && (
                    <>
                      <MiniBtn disabled={busy} onClick={() => onProposeStep(step.order)}>
                        Propose
                      </MiniBtn>
                      <MiniBtn disabled={busy} onClick={() => onStepAction(step.order, 'mark_done')}>
                        Done
                      </MiniBtn>
                      <MiniBtn disabled={busy} onClick={() => onStepAction(step.order, 'skip')}>
                        Skip
                      </MiniBtn>
                    </>
                  )}
                  {step.status === 'failed' && (
                    <>
                      <MiniBtn disabled={busy} onClick={() => onStepAction(step.order, 'activate')}>
                        Retry
                      </MiniBtn>
                      <MiniBtn disabled={busy} onClick={() => onStepAction(step.order, 'reset')}>
                        Reset
                      </MiniBtn>
                    </>
                  )}
                  {step.status === 'pending' && (
                    <MiniBtn disabled={busy} onClick={() => onStepAction(step.order, 'activate')}>
                      Start
                    </MiniBtn>
                  )}
                  <MiniBtn disabled={busy} onClick={() => onCopyPrompt(step)}>
                    Copy
                  </MiniBtn>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MiniBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: 10,
        padding: '3px 8px',
        borderRadius: 4,
        border: '1px solid #1e2530',
        background: '#0f1218',
        color: '#94a3b8',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}
