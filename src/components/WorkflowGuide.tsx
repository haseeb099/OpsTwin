'use client'

/**
 * Legacy step guide (replaced by Pipeline in the main UI).
 * Kept for detectWorkflowStep helper used across the app.
 */

import type { WorkflowStep } from '@/types/workflow'

export type { WorkflowStep }

const C = {
  bgCard: '#0f1218',
  border: '#1e2530',
  text: '#e2e8f0',
  textMuted: '#64748b',
  textDim: '#94a3b8',
  accent: '#00d4ff',
  accentDim: '#003344',
  green: '#10b981',
  greenDim: '#064e3b',
  yellow: '#f59e0b',
}

const STEPS: {
  n: WorkflowStep
  title: string
  short: string
  who: string
  desc: string
}[] = [
  {
    n: 1,
    title: 'Your MVP idea',
    short: 'Idea',
    who: 'You',
    desc: 'Click + and paste what you want to build. One paragraph is enough.',
  },
  {
    n: 2,
    title: 'AI breaks it into steps',
    short: 'Plan',
    who: 'OpsTwin + Groq',
    desc: 'Open your task → MVP Plan → Generate. You get steps, PRD, tests, architecture.',
  },
  {
    n: 3,
    title: 'You approve the plan',
    short: 'Approve',
    who: 'You',
    desc: 'Read the steps. Edit docs if needed. Click Approve Plan.',
  },
  {
    n: 4,
    title: 'Agent builds it',
    short: 'Build',
    who: 'Cursor / Claude / any agent',
    desc: 'Copy a step prompt or Dispatch to Agent. Paste into your coding agent. It edits files.',
  },
  {
    n: 5,
    title: 'OpsTwin watches results',
    short: 'Audit',
    who: 'OpsTwin',
    desc: 'Audit tab shows: files changed, terminal output, screenshots, test pass/fail.',
  },
  {
    n: 6,
    title: 'AI improves the next prompt',
    short: 'Improve',
    who: 'OpsTwin + Groq',
    desc: 'Propose Next Prompt → Approve → paste into agent again. Repeat until MVP is done.',
  },
]

export function detectWorkflowStep(input: {
  hasTask: boolean
  planStatus?: string | null
  runStatus?: string | null
  hasMismatches?: boolean
}): WorkflowStep {
  if (!input.hasTask) return 1
  if (!input.planStatus || input.planStatus === 'none') return 2
  if (input.planStatus === 'draft') return 3
  if (!input.runStatus || input.runStatus === 'none' || input.runStatus === 'pending') return 4
  if (input.runStatus === 'running') return 5
  return 6
}

/** Compact progress bar — use on dashboard and task views instead of the full guide. */
export function WorkflowStrip({
  currentStep,
  onOpenGuide,
}: {
  currentStep: WorkflowStep
  onOpenGuide?: () => void
}) {
  const current = STEPS[currentStep - 1]
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: '10px 14px',
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {STEPS.map((s, i) => {
          const active = s.n === currentStep
          const done = s.n < currentStep
          return (
            <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span
                title={s.title}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 800,
                  background: done ? C.green : active ? C.accent : '#1a1a1a',
                  color: done || active ? '#000' : C.textMuted,
                  border: active ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
                }}
              >
                {done ? '✓' : s.n}
              </span>
              {i < STEPS.length - 1 && (
                <span
                  style={{
                    width: 10,
                    height: 1,
                    background: done ? C.green + '66' : C.border,
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 140,
          fontSize: 11,
          color: C.textDim,
        }}
      >
        <span style={{ color: C.accent, fontWeight: 700 }}>Step {currentStep}</span>
        {' · '}
        {current.title}
      </div>
      {onOpenGuide && (
        <button
          type="button"
          onClick={onOpenGuide}
          style={{
            background: 'transparent',
            border: `1px solid ${C.border}`,
            color: C.textMuted,
            padding: '4px 10px',
            borderRadius: 4,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          Full guide →
        </button>
      )}
    </div>
  )
}

export default function WorkflowGuide({
  currentStep,
  taskId,
  showCliHint = true,
}: {
  currentStep: WorkflowStep
  taskId?: string
  showCliHint?: boolean
}) {
  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 20,
        marginBottom: 24,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: C.textMuted,
            marginBottom: 4,
          }}
        >
          How OpsTwin works
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
          Prompt → Plan → Approve → Agent builds → AI improves
        </div>
        <div style={{ fontSize: 12, color: C.textDim, marginTop: 6 }}>
          You stay in control. AI plans and improves prompts. Any coding agent does the work.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {STEPS.map((s) => {
          const active = s.n === currentStep
          const done = s.n < currentStep
          return (
            <div
              key={s.n}
              style={{
                display: 'flex',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 6,
                border: `1px solid ${active ? C.accent + '66' : C.border}`,
                background: active ? C.accentDim : done ? C.greenDim : 'transparent',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 800,
                  background: active ? C.accent : done ? C.green : '#1a1a1a',
                  color: active || done ? '#000' : C.textMuted,
                }}
              >
                {done ? '✓' : s.n}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: active ? C.accent : C.text }}>
                    {s.title}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: C.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {s.who}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{s.desc}</div>
              </div>
            </div>
          )
        })}
      </div>

      {showCliHint && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: '#0a0c10',
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            fontSize: 11,
            color: C.textDim,
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: C.yellow }}>Optional — auto-upload from your code repo:</strong>
          <br />
          In your project folder (not this OpsTwin app), run once:
          <br />
          <code style={{ color: C.accent }}>node opstwin-init.js</code>
          <br />
          Then in a second terminal:
          <br />
          <code style={{ color: C.accent }}>
            {taskId
              ? `$env:OPSTWIN_TASK_ID="${taskId}"; node opstwin-cli.js watch`
              : '$env:OPSTWIN_TASK_ID="<your-task-id>"; node opstwin-cli.js watch'}
          </code>
          <br />
          When your agent finishes, results appear in the <strong>Audit</strong> tab automatically.
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11, color: C.textMuted }}>
        <strong>Right now → Step {currentStep}:</strong> {STEPS[currentStep - 1].title}
      </div>
    </div>
  )
}
