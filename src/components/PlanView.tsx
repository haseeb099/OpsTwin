'use client'

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { TaskIdChip } from '@/components/TaskIdChip'
import AutomationPanel from '@/components/AutomationPanel'
import ActivityTimeline from '@/components/command-center/ActivityTimeline'
import DocumentStatusBar, { type DocKey } from '@/components/command-center/DocumentStatusBar'
import PipelineStepper from '@/components/command-center/PipelineStepper'
import type { AnalysisPreview, CapturedPromptRecord, MvpPlan, PlanGap, PlanStep, PromptProposal, TimelineEvent } from '@/types'

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
  blue: '#3b82f6',
  blueText: '#60a5fa',
  accent: '#00d4ff',
  accentDim: '#003344',
}

type DocTab = DocKey

interface PlanViewProps {
  taskId: string
  taskTitle: string
  onToast: (msg: string, variant: 'error' | 'success') => void
  onPlanChange?: (status: string | null) => void
}

export default function PlanView({ taskId, taskTitle, onToast, onPlanChange }: PlanViewProps) {
  const [plan, setPlan] = useState<MvpPlan | null>(null)
  const [gaps, setGaps] = useState<PlanGap[]>([])
  const [proposals, setProposals] = useState<PromptProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [docTab, setDocTab] = useState<DocTab>('prd')
  const [showProposal, setShowProposal] = useState(false)
  const [editingDocs, setEditingDocs] = useState(false)
  const [editDocs, setEditDocs] = useState<MvpPlan['documents'] | null>(null)
  const [llmProvider, setLlmProvider] = useState<string>('none')
  const [latestRunId, setLatestRunId] = useState<string | null>(null)
  const [analysisPreview, setAnalysisPreview] = useState<AnalysisPreview | null>(null)
  const [proposeSource, setProposeSource] = useState<'llm' | 'rules'>('rules')
  const [capturedPrompt, setCapturedPrompt] = useState<CapturedPromptRecord | null>(null)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)

  const loadTimeline = useCallback(async (planId: string) => {
    setTimelineLoading(true)
    try {
      const res = await fetch(`/api/plans/${planId}/timeline`)
      if (res.ok) {
        const data = (await res.json()) as { events: TimelineEvent[] }
        setTimeline(data.events ?? [])
      }
    } catch {
      setTimeline([])
    } finally {
      setTimelineLoading(false)
    }
  }, [])

  const loadPlan = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/plans?taskId=${taskId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { plan: MvpPlan | null }
      setPlan(data.plan)

      if (data.plan) onPlanChange?.(data.plan.status)
      else onPlanChange?.(null)

      if (data.plan) {
        const detail = await fetch(`/api/plans/${data.plan.id}`)
        if (detail.ok) {
          const d = (await detail.json()) as { gaps: PlanGap[]; latestRunId?: string | null }
          setGaps(d.gaps ?? [])
          setLatestRunId(d.latestRunId ?? null)
        }
        void loadTimeline(data.plan.id)
      } else {
        setGaps([])
        setLatestRunId(null)
        setTimeline([])
      }

      const capRes = await fetch(`/api/prompts/capture?taskId=${taskId}`)
      if (capRes.ok) {
        const capData = (await capRes.json()) as { latest: CapturedPromptRecord | null }
        setCapturedPrompt(capData.latest ?? null)
      }

      const pRes = await fetch(`/api/prompts?taskId=${taskId}`)
      if (pRes.ok) {
        const pData = (await pRes.json()) as { proposals: PromptProposal[] }
        setProposals(pData.proposals ?? [])
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to load plan', 'error')
    } finally {
      setLoading(false)
    }
  }, [taskId, onToast, onPlanChange, loadTimeline])

  useEffect(() => {
    loadPlan()
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d: { llmEnabled?: boolean; llmProvider?: string }) => {
        setLlmProvider(d.llmProvider ?? (d.llmEnabled ? 'openai' : 'none'))
      })
      .catch(() => {})
  }, [loadPlan])

  useEffect(() => {
    if (!plan?.id) return
    const id = setInterval(() => void loadTimeline(plan.id), 12000)
    return () => clearInterval(id)
  }, [plan?.id, loadTimeline])

  const generatePlan = async () => {
    setBusy('generate')
    try {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      })
      if (!res.ok) {
        const e = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(e?.error ?? `HTTP ${res.status}`)
      }
      onToast('MVP plan generated', 'success')
      await loadPlan()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to generate plan', 'error')
    } finally {
      setBusy(null)
    }
  }

  const approvePlan = async () => {
    if (!plan) return
    setBusy('approve')
    try {
      const res = await fetch(`/api/plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onToast('Plan approved — ready to run agent steps', 'success')
      await loadPlan()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to approve plan', 'error')
    } finally {
      setBusy(null)
    }
  }

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      onToast(`${label} copied to clipboard`, 'success')
    } catch {
      onToast('Copy failed — select text manually', 'error')
    }
  }

  const proposePrompt = async (planStepOrder?: number) => {
    setBusy('propose')
    try {
      const res = await fetch('/api/prompts/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, planStepOrder, runId: latestRunId ?? undefined }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as {
        proposal: PromptProposal
        source?: 'llm' | 'rules'
      }
      setProposals((prev) => [data.proposal, ...prev])
      setProposeSource(data.source ?? 'rules')
      setShowProposal(true)
      onToast('Prompt proposed — review and approve', 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to propose prompt', 'error')
    } finally {
      setBusy(null)
    }
  }

  const analyzeRun = async () => {
    if (!latestRunId) {
      onToast('No run to analyze — upload an audit first', 'error')
      return
    }
    setBusy('analyze')
    try {
      const res = await fetch(`/api/runs/${latestRunId}/analyze`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { analysis: AnalysisPreview; gaps: PlanGap[] }
      setAnalysisPreview(data.analysis)
      setGaps(data.gaps)
      onToast(`Analysis complete (${data.analysis.source})`, 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Analyze failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  const sendToAgent = async (proposalId: string) => {
    setBusy('send')
    try {
      const approveRes = await fetch(`/api/prompts/${proposalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      if (!approveRes.ok) throw new Error(`Approve HTTP ${approveRes.status}`)

      const dispatchRes = await fetch(`/api/prompts/${proposalId}/dispatch`, { method: 'POST' })
      if (!dispatchRes.ok) throw new Error(`Dispatch HTTP ${dispatchRes.status}`)

      const data = (await dispatchRes.json()) as { prompt: string }
      await copyText(data.prompt, 'Sent to agent')

      await fetch('/api/cli/run-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, proposalId }),
      }).catch(() => {})

      onToast(
        'Sent to agent — CLI will deliver and run Cursor (if loop daemon is active)',
        'success',
      )
      await loadPlan()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Send to agent failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  const approveProposal = async (id: string) => {
    setBusy(`approve-${id}`)
    try {
      const res = await fetch(`/api/prompts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { approvedPrompt: string }
      await copyText(data.approvedPrompt, 'Approved prompt')
      await loadPlan()
      setShowProposal(true)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to approve', 'error')
    } finally {
      setBusy(null)
    }
  }

  const dispatchToAgent = async (proposalId: string) => {
    setBusy('dispatch')
    try {
      const res = await fetch(`/api/prompts/${proposalId}/dispatch`, { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { prompt: string; dispatchFiles: { primary: string } }
      await copyText(data.prompt, 'Dispatched prompt')
      onToast('Dispatched — CLI autopilot will write pending-prompt.md automatically', 'success')
      await loadPlan()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Dispatch failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  const saveDocuments = async () => {
    if (!plan || !editDocs) return
    setBusy('save-docs')
    try {
      const res = await fetch(`/api/plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_documents', documents: editDocs }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onToast('Documents saved', 'success')
      setEditingDocs(false)
      await loadPlan()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Save failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  const startEditDocs = () => {
    if (!plan) return
    setEditDocs({ ...plan.documents, erd: plan.documents.erd ?? '' })
    setEditingDocs(true)
  }

  const stepAction = async (
    order: number,
    action: 'mark_done' | 'mark_failed' | 'skip' | 'reset' | 'activate',
  ) => {
    if (!plan) return
    setBusy(`step-${order}`)
    try {
      const res = await fetch(`/api/plans/${plan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'step_action', stepOrder: order, stepAction: action }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onToast(`Step ${order} updated`, 'success')
      await loadPlan()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Step update failed', 'error')
    } finally {
      setBusy(null)
    }
  }

  const latestDraft = proposals.find((p) => p.status === 'draft')
  const latestApproved = proposals.find((p) => p.status === 'approved')
  const latestWithAgent = proposals.find((p) => p.status === 'dispatched' || p.deliveredAt)

  if (loading) {
    return <div style={{ color: C.textMuted, padding: 24 }}>Loading plan...</div>
  }

  if (!plan) {
    return (
      <div
        style={{
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 32,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No MVP plan yet</div>
        <div style={{ marginBottom: 12 }}>
          <TaskIdChip id={taskId} onCopied={(msg) => onToast(msg, 'success')} />
        </div>
        <div style={{ color: C.textMuted, marginBottom: 24, fontSize: 13 }}>
          Generate a step-by-step plan and docs for &ldquo;{taskTitle}&rdquo;
        </div>
        <button
          onClick={generatePlan}
          disabled={busy === 'generate'}
          style={{
            background: C.accent,
            color: '#000',
            border: 'none',
            padding: '10px 24px',
            borderRadius: 6,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {busy === 'generate' ? 'Generating...' : 'Generate MVP Plan'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>MVP Plan v{plan.version}</div>
          <div style={{ marginTop: 8 }}>
            <TaskIdChip id={taskId} compact onCopied={(msg) => onToast(msg, 'success')} />
          </div>
          <div style={{ color: C.textMuted, fontSize: 12, marginTop: 8 }}>
            Status:{' '}
            <span style={{ color: plan.status === 'approved' ? C.greenText : C.yellowText }}>
              {plan.status}
            </span>
            {' · '}
            Planner:{' '}
            {llmProvider === 'groq'
              ? 'LLM (Groq)'
              : llmProvider === 'openai'
                ? 'LLM (OpenAI)'
                : 'Rules (no API key)'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {plan.status === 'draft' && (
            <button onClick={approvePlan} disabled={busy === 'approve'} style={btnPrimary}>
              {busy === 'approve' ? '...' : 'Approve Plan'}
            </button>
          )}
          <button
            onClick={analyzeRun}
            disabled={!latestRunId || busy === 'analyze'}
            style={btnSecondary}
          >
            {busy === 'analyze' ? '...' : 'Analyze Run'}
          </button>
          <button
            onClick={() => proposePrompt()}
            disabled={plan.status !== 'approved' || busy === 'propose'}
            style={btnSecondary}
          >
            {busy === 'propose' ? '...' : 'Propose Next Prompt'}
            {(llmProvider === 'groq' || llmProvider === 'openai') && (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 9,
                  background: C.accentDim,
                  color: C.accent,
                  padding: '1px 5px',
                  borderRadius: 3,
                  fontWeight: 700,
                }}
              >
                LLM
              </span>
            )}
          </button>
          <button onClick={generatePlan} disabled={busy === 'generate'} style={btnSecondary}>
            Regenerate
          </button>
        </div>
      </div>

      <AutomationPanel
        taskId={taskId}
        onToast={onToast}
        onPropose={() => {
          const active = plan.steps.find((s) => s.status === 'in_progress')
          void proposePrompt(active?.order)
        }}
        latestProposalId={(latestDraft ?? latestApproved ?? latestWithAgent)?.id}
      />

      <Section title="Command Center — Pipeline">
        <PipelineStepper
          steps={plan.steps}
          planStatus={plan.status}
          busy={!!busy}
          onStepAction={stepAction}
          onProposeStep={(order) => void proposePrompt(order)}
          onCopyPrompt={(step: PlanStep) => void copyText(step.agentPrompt, `Step ${step.order} prompt`)}
        />
      </Section>

      <Section title="Activity Timeline">
        <ActivityTimeline events={timeline} loading={timelineLoading} />
      </Section>

      {capturedPrompt && (
        <Section title="Last Agent Prompt">
          <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>
            From {capturedPrompt.source} · {new Date(capturedPrompt.capturedAt).toLocaleString()}
          </div>
          <pre
            style={{
              fontSize: 11,
              color: C.textDim,
              whiteSpace: 'pre-wrap',
              maxHeight: 120,
              overflow: 'auto',
              margin: 0,
              background: '#0a0c10',
              padding: 10,
              borderRadius: 6,
              border: `1px solid ${C.border}`,
            }}
          >
            {capturedPrompt.content.slice(0, 800)}
          </pre>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>
            Append prompts to <code style={{ color: C.accent }}>.ops/prompts/inbound.md</code> in
            your repo — use <code style={{ color: C.accent }}>node opstwin-cli.js prompt-watch</code>
          </div>
        </Section>
      )}

      {analysisPreview && (
        <Section title="Run Analysis">
          <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
            {analysisPreview.rationale}
            <span style={{ marginLeft: 8, color: analysisPreview.source === 'llm' ? C.accent : C.textDim }}>
              [{analysisPreview.source}]
            </span>
          </div>
          <div style={{ fontSize: 11, color: C.textDim, marginBottom: 8 }}>
            Blockers: {analysisPreview.severitySummary.blockers} · Warnings:{' '}
            {analysisPreview.severitySummary.warnings}
            {analysisPreview.suggestedCommands.length > 0 && (
              <> · Suggested: {analysisPreview.suggestedCommands.join(', ')}</>
            )}
          </div>
          <pre
            style={{
              fontSize: 11,
              color: C.textDim,
              whiteSpace: 'pre-wrap',
              maxHeight: 160,
              overflow: 'auto',
              margin: 0,
              background: '#0a0c10',
              padding: 10,
              borderRadius: 6,
              border: `1px solid ${C.border}`,
            }}
          >
            {analysisPreview.improvedPrompt}
          </pre>
        </Section>
      )}

      {gaps.length > 0 && (
        <Section title="Plan vs Run Gaps">
          {gaps.map((g) => (
            <div
              key={g.stepOrder}
              style={{
                fontSize: 12,
                padding: '8px 0',
                borderBottom: `1px solid ${C.border}`,
                color:
                  g.severity === 'blocker'
                    ? C.redText
                    : g.severity === 'warning'
                      ? C.yellowText
                      : C.textDim,
              }}
            >
              <strong>
                Step {g.stepOrder}: {g.stepTitle}
              </strong>{' '}
              [{g.type}] — {g.actual}
            </div>
          ))}
        </Section>
      )}

      {(latestDraft || latestApproved) && (
        <Section title="Prompt Approval">
          {(latestDraft ?? latestApproved) && (
            <div
              style={{
                background: '#0a0c10',
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
                {(latestDraft ?? latestApproved)!.rationale}
                {latestDraft && proposeSource === 'llm' && (
                  <span style={{ marginLeft: 8, color: C.accent, fontSize: 10, fontWeight: 700 }}>
                    LLM
                  </span>
                )}
              </div>
              {showProposal && (
                <pre
                  style={{
                    fontSize: 11,
                    color: C.textDim,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 200,
                    overflow: 'auto',
                    margin: '0 0 12px',
                  }}
                >
                  {(latestDraft ?? latestApproved)!.proposedPrompt}
                </pre>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {latestDraft && (
                  <button
                    onClick={() => sendToAgent(latestDraft.id)}
                    disabled={!!busy}
                    style={btnPrimary}
                  >
                    {busy === 'send' ? '...' : 'Send to Agent'}
                  </button>
                )}
                {(latestApproved ?? latestDraft) && (
                  <button
                    onClick={() => dispatchToAgent((latestApproved ?? latestDraft)!.id)}
                    disabled={!!busy}
                    style={btnSecondary}
                  >
                    Dispatch to Agent
                  </button>
                )}
                {latestDraft && (
                  <button
                    onClick={() => approveProposal(latestDraft.id)}
                    disabled={!!busy}
                    style={btnPrimary}
                  >
                    Approve & Copy
                  </button>
                )}
                <button
                  onClick={() =>
                    copyText((latestDraft ?? latestApproved)!.proposedPrompt, 'Prompt')
                  }
                  style={btnSecondary}
                >
                  Copy
                </button>
                <button onClick={() => setShowProposal(!showProposal)} style={btnSecondary}>
                  {showProposal ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          )}
        </Section>
      )}

      {!latestDraft && !latestApproved && latestWithAgent && (
        <Section title="With Agent Now">
          <div
            style={{
              background: '#052e22',
              border: `1px solid ${C.green}`,
              borderRadius: 6,
              padding: 14,
            }}
          >
            <div style={{ fontSize: 12, color: C.greenText, fontWeight: 700, marginBottom: 8 }}>
              Prompt delivered to .ops/dispatch/pending-prompt.md — open Cursor in your repo to run it
            </div>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>
              {latestWithAgent.rationale}
            </div>
            <pre
              style={{
                fontSize: 11,
                color: C.textDim,
                whiteSpace: 'pre-wrap',
                maxHeight: 160,
                overflow: 'auto',
                margin: '0 0 12px',
                background: '#0a0c10',
                padding: 10,
                borderRadius: 6,
                border: `1px solid ${C.border}`,
              }}
            >
              {latestWithAgent.proposedPrompt}
            </pre>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => copyText(latestWithAgent.proposedPrompt, 'Agent prompt')}
                style={btnPrimary}
              >
                Copy prompt
              </button>
              <button onClick={() => proposePrompt()} disabled={!!busy} style={btnSecondary}>
                {busy === 'propose' ? '...' : 'Propose Next (after agent finishes)'}
              </button>
            </div>
          </div>
        </Section>
      )}

      <Section title="Generated Documents">
        <DocumentStatusBar plan={plan} activeTab={docTab} onSelect={setDocTab} />
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => copyText(plan.documents[docTab] ?? '', docTab)}
            style={{ ...btnSmall, marginLeft: 'auto' }}
          >
            Copy doc
          </button>
          {!editingDocs ? (
            <button onClick={startEditDocs} style={btnSmall}>
              Edit
            </button>
          ) : (
            <>
              <button onClick={saveDocuments} disabled={busy === 'save-docs'} style={btnSmall}>
                Save
              </button>
              <button
                onClick={() => {
                  setEditingDocs(false)
                  setEditDocs(null)
                }}
                style={btnSmall}
              >
                Cancel
              </button>
            </>
          )}
        </div>
        {editingDocs && editDocs ? (
          <textarea
            value={editDocs[docTab] ?? ''}
            onChange={(e) => setEditDocs({ ...editDocs, [docTab]: e.target.value })}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              minHeight: 280,
              background: '#0a0c10',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: 14,
              fontSize: 11,
              color: C.textDim,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        ) : (
          <pre
            style={{
              background: '#0a0c10',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: 14,
              fontSize: 11,
              color: C.textDim,
              whiteSpace: 'pre-wrap',
              maxHeight: 320,
              overflow: 'auto',
              margin: 0,
            }}
          >
            {plan.documents[docTab] ?? '(empty — edit to add content)'}
          </pre>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        background: C.bgCard,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: C.textMuted,
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

const btnPrimary: CSSProperties = {
  background: C.accent,
  color: '#000',
  border: 'none',
  padding: '8px 16px',
  borderRadius: 6,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 12,
}

const btnSecondary: CSSProperties = {
  background: 'transparent',
  color: C.text,
  border: `1px solid ${C.border}`,
  padding: '8px 16px',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 12,
}

const btnSmall: CSSProperties = {
  background: 'transparent',
  color: C.textMuted,
  border: `1px solid ${C.border}`,
  padding: '4px 10px',
  borderRadius: 4,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 11,
}
