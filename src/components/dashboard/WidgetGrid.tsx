'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import GridLayout, { type Layout } from 'react-grid-layout'
import type { MemoryEntry, PlanGap, PromptProposal } from '@/types'
import type { WorkflowStep } from '@/types/workflow'
import { TaskIdChip } from '@/components/TaskIdChip'
import { WorkflowStrip } from '@/components/WorkflowGuide'

const C = {
  bgCard: '#0f1218',
  border: '#1e2530',
  text: '#e2e8f0',
  textMuted: '#64748b',
  textDim: '#94a3b8',
  accent: '#00d4ff',
  green: '#10b981',
  yellow: '#f59e0b',
  purple: '#8b5cf6',
  blue: '#3b82f6',
}

const LAYOUT_KEY = 'opstwin-dashboard-layout'

const DEFAULT_LAYOUT: Layout[] = [
  { i: 'pipeline', x: 0, y: 0, w: 12, h: 2, minH: 2 },
  { i: 'metrics', x: 0, y: 2, w: 6, h: 3, minH: 2 },
  { i: 'lastRun', x: 6, y: 2, w: 6, h: 3, minH: 2 },
  { i: 'gaps', x: 0, y: 5, w: 6, h: 4, minH: 2 },
  { i: 'prompt', x: 6, y: 5, w: 6, h: 4, minH: 2 },
  { i: 'terminal', x: 0, y: 9, w: 6, h: 3, minH: 2 },
  { i: 'doc', x: 6, y: 9, w: 6, h: 3, minH: 2 },
]

interface TaskSummary {
  id: string
  title: string
  runs: {
    id: string
    status: string
    confidence: string | null
    branch: string
    finishedAt: string | null
  }[]
}

interface WidgetGridProps {
  tasks: TaskSummary[]
  memory: MemoryEntry[]
  workflowStep: WorkflowStep
  onOpenGuide: () => void
}

function WidgetShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 12,
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: C.textMuted,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

export default function WidgetGrid({
  tasks,
  memory,
  workflowStep,
  onOpenGuide,
}: WidgetGridProps) {
  const [layout, setLayout] = useState<Layout[]>(DEFAULT_LAYOUT)
  const [gaps, setGaps] = useState<PlanGap[]>([])
  const [draftProposal, setDraftProposal] = useState<PromptProposal | null>(null)
  const [docSnippet, setDocSnippet] = useState<string>('')
  const [terminalPreview, setTerminalPreview] = useState<string>('')
  const [width, setWidth] = useState(1200)

  const focusTask = tasks.find((t) => t.runs.length > 0) ?? tasks[0]
  const lastRun = focusTask?.runs[0]

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_KEY)
      if (saved) setLayout(JSON.parse(saved) as Layout[])
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const onResize = () => {
      const el = document.getElementById('opstwin-widget-grid')
      if (el) setWidth(el.clientWidth)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!focusTask) return
    ;(async () => {
      const planRes = await fetch(`/api/plans?taskId=${focusTask.id}`)
      if (!planRes.ok) return
      const planData = (await planRes.json()) as { plan: { id: string } | null }
      if (planData.plan) {
        const detail = await fetch(`/api/plans/${planData.plan.id}`)
        if (detail.ok) {
          const d = (await detail.json()) as { gaps: PlanGap[]; plan: { documents: { prd: string } } }
          setGaps(d.gaps ?? [])
          setDocSnippet(d.plan?.documents?.prd?.slice(0, 400) ?? '')
        }
      }
      const pRes = await fetch(`/api/prompts?taskId=${focusTask.id}`)
      if (pRes.ok) {
        const pData = (await pRes.json()) as { proposals: PromptProposal[] }
        setDraftProposal(pData.proposals?.find((p) => p.status === 'draft') ?? null)
      }
      if (lastRun) {
        const tRes = await fetch(`/api/runs/${lastRun.id}/terminal`)
        if (tRes.ok) {
          const tData = (await tRes.json()) as {
            logs: { command: string; exitCode: number; stdout: string }[]
          }
          const log = tData.logs?.[0]
          if (log) {
            setTerminalPreview(`$ ${log.command} → exit ${log.exitCode}\n${log.stdout.slice(0, 300)}`)
          }
        }
      }
    })()
  }, [focusTask, lastRun])

  const onLayoutChange = useCallback((next: Layout[]) => {
    setLayout(next)
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(next))
  }, [])

  const resetLayout = () => {
    setLayout(DEFAULT_LAYOUT)
    localStorage.removeItem(LAYOUT_KEY)
  }

  const total = tasks.length
  const completed = tasks.filter((t) => t.runs[0]?.status === 'complete').length
  const avgAcceptance = total > 0 ? completed / total : 0

  const metrics = useMemo(
    () => [
      { label: 'Tasks', value: String(total), color: C.text },
      { label: 'Completion', value: `${Math.round(avgAcceptance * 100)}%`, color: C.green },
      { label: 'Memory', value: String(memory.length), color: C.purple },
      {
        label: 'Running',
        value: String(tasks.filter((t) => t.runs[0]?.status === 'running').length),
        color: C.blue,
      },
    ],
    [total, avgAcceptance, memory.length, tasks],
  )

  return (
    <div id="opstwin-widget-grid" style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button
          type="button"
          onClick={resetLayout}
          style={{
            background: 'transparent',
            border: `1px solid ${C.border}`,
            color: C.textMuted,
            padding: '4px 10px',
            borderRadius: 4,
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Reset layout
        </button>
      </div>
      <GridLayout
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={48}
        width={width}
        onLayoutChange={onLayoutChange}
        draggableHandle=".widget-drag"
        compactType="vertical"
      >
        <div key="pipeline">
          <WidgetShell title="Pipeline">
            <div className="widget-drag" style={{ cursor: 'move', marginBottom: 8, color: C.textMuted, fontSize: 10 }}>
              ⠿ drag
            </div>
            <WorkflowStrip currentStep={workflowStep} onOpenGuide={onOpenGuide} />
          </WidgetShell>
        </div>
        <div key="metrics">
          <WidgetShell title="Metrics">
            <div className="widget-drag" style={{ cursor: 'move', marginBottom: 8, color: C.textMuted, fontSize: 10 }}>
              ⠿ drag
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {metrics.map((m) => (
                <div key={m.label} style={{ fontSize: 12 }}>
                  <div style={{ color: C.textMuted, fontSize: 10 }}>{m.label}</div>
                  <div style={{ color: m.color, fontWeight: 700, fontSize: 18 }}>{m.value}</div>
                </div>
              ))}
            </div>
          </WidgetShell>
        </div>
        <div key="lastRun">
          <WidgetShell title="Last run">
            <div className="widget-drag" style={{ cursor: 'move', marginBottom: 8, color: C.textMuted, fontSize: 10 }}>
              ⠿ drag
            </div>
            {lastRun ? (
              <div style={{ fontSize: 12, color: C.textDim }}>
                <div>
                  <strong style={{ color: C.text }}>{focusTask?.title}</strong>
                </div>
                {focusTask && (
                  <div style={{ margin: '6px 0' }}>
                    <TaskIdChip id={focusTask.id} compact />
                  </div>
                )}
                <div>Status: {lastRun.status}</div>
                <div>Branch: {lastRun.branch}</div>
                <div>Confidence: {lastRun.confidence ?? '—'}</div>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: C.textMuted }}>No runs yet</div>
            )}
          </WidgetShell>
        </div>
        <div key="gaps">
          <WidgetShell title="Plan gaps">
            <div className="widget-drag" style={{ cursor: 'move', marginBottom: 8, color: C.textMuted, fontSize: 10 }}>
              ⠿ drag
            </div>
            {gaps.length === 0 ? (
              <div style={{ fontSize: 11, color: C.textMuted }}>No gaps or no plan</div>
            ) : (
              gaps.slice(0, 4).map((g) => (
                <div key={g.stepOrder} style={{ fontSize: 11, color: C.textDim, marginBottom: 6 }}>
                  Step {g.stepOrder}: {g.type} — {g.actual.slice(0, 80)}
                </div>
              ))
            )}
          </WidgetShell>
        </div>
        <div key="prompt">
          <WidgetShell title="Draft proposal">
            <div className="widget-drag" style={{ cursor: 'move', marginBottom: 8, color: C.textMuted, fontSize: 10 }}>
              ⠿ drag
            </div>
            {draftProposal ? (
              <pre
                style={{
                  fontSize: 10,
                  color: C.textDim,
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                  maxHeight: 120,
                  overflow: 'auto',
                }}
              >
                {draftProposal.proposedPrompt.slice(0, 400)}
              </pre>
            ) : (
              <div style={{ fontSize: 11, color: C.textMuted }}>No draft proposal</div>
            )}
          </WidgetShell>
        </div>
        <div key="terminal">
          <WidgetShell title="Terminal">
            <div className="widget-drag" style={{ cursor: 'move', marginBottom: 8, color: C.textMuted, fontSize: 10 }}>
              ⠿ drag
            </div>
            <pre
              style={{
                fontSize: 10,
                color: C.textDim,
                whiteSpace: 'pre-wrap',
                margin: 0,
                maxHeight: 100,
                overflow: 'auto',
              }}
            >
              {terminalPreview || 'No terminal logs'}
            </pre>
          </WidgetShell>
        </div>
        <div key="doc">
          <WidgetShell title="PRD excerpt">
            <div className="widget-drag" style={{ cursor: 'move', marginBottom: 8, color: C.textMuted, fontSize: 10 }}>
              ⠿ drag
            </div>
            <pre
              style={{
                fontSize: 10,
                color: C.textDim,
                whiteSpace: 'pre-wrap',
                margin: 0,
                maxHeight: 100,
                overflow: 'auto',
              }}
            >
              {docSnippet || 'Generate a plan to see docs'}
            </pre>
          </WidgetShell>
        </div>
      </GridLayout>
      <style jsx global>{`
        .react-grid-item.react-grid-placeholder {
          background: #003344;
          opacity: 0.3;
          border-radius: 8px;
        }
      `}</style>
    </div>
  )
}
