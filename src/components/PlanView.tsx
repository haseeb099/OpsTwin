'use client'

import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { MvpPlan, PlanGap, PromptProposal } from '@/types'

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

type DocTab = 'prd' | 'trd' | 'useCases' | 'testPlan' | 'architecture'

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
          const d = (await detail.json()) as { gaps: PlanGap[] }
          setGaps(d.gaps ?? [])
        }
      } else {
        setGaps([])
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
  }, [taskId, onToast, onPlanChange])

  useEffect(() => {
    loadPlan()
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d: { llmEnabled?: boolean; llmProvider?: string }) => {
        setLlmProvider(d.llmProvider ?? (d.llmEnabled ? 'openai' : 'none'))
      })
      .catch(() => {})
  }, [loadPlan])

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
        body: JSON.stringify({ taskId, planStepOrder }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { proposal: PromptProposal }
      setProposals((prev) => [data.proposal, ...prev])
      setShowProposal(true)
      onToast('Prompt proposed — review and approve', 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to propose prompt', 'error')
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
      onToast(
        `Dispatched! Run: node opstwin-cli.js dispatch ${proposalId} in your repo`,
        'success',
      )
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
    setEditDocs({ ...plan.documents })
    setEditingDocs(true)
  }

  const latestDraft = proposals.find((p) => p.status === 'draft')
  const latestApproved = proposals.find((p) => p.status === 'approved')

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

  const docTabs: { id: DocTab; label: string }[] = [
    { id: 'prd', label: 'PRD' },
    { id: 'trd', label: 'TRD' },
    { id: 'useCases', label: 'Use Cases' },
    { id: 'testPlan', label: 'Test Plan' },
    { id: 'architecture', label: 'Architecture' },
  ]

  const stepColor = (status: string) =>
    status === 'complete'
      ? C.greenText
      : status === 'failed'
        ? C.redText
        : status === 'in_progress'
          ? C.blueText
          : C.textMuted

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
          <div style={{ color: C.textMuted, fontSize: 12, marginTop: 4 }}>
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
            onClick={() => proposePrompt()}
            disabled={plan.status !== 'approved' || busy === 'propose'}
            style={btnSecondary}
          >
            {busy === 'propose' ? '...' : 'Propose Next Prompt'}
          </button>
          <button onClick={generatePlan} disabled={busy === 'generate'} style={btnSecondary}>
            Regenerate
          </button>
        </div>
      </div>

      <Section title={`Steps (${plan.steps.length})`}>
        {plan.steps.map((step) => (
          <div
            key={step.order}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: 14,
              marginBottom: 8,
              background: '#0a0c10',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <div>
                <span style={{ color: C.accent, fontWeight: 700 }}>{step.order}.</span>{' '}
                <span style={{ fontWeight: 600 }}>{step.title}</span>
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    color: stepColor(step.status),
                    textTransform: 'uppercase',
                  }}
                >
                  {step.status}
                </span>
              </div>
              <button
                onClick={() => copyText(step.agentPrompt, `Step ${step.order} prompt`)}
                style={btnSmall}
              >
                Copy prompt
              </button>
            </div>
            <div style={{ color: C.textDim, fontSize: 12, marginTop: 6 }}>{step.goal}</div>
          </div>
        ))}
      </Section>

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
                {(latestApproved ?? latestDraft) && (
                  <button
                    onClick={() => dispatchToAgent((latestApproved ?? latestDraft)!.id)}
                    disabled={!!busy}
                    style={btnPrimary}
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

      <Section title="Generated Documents">
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
          {docTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setDocTab(t.id)}
              style={{
                ...btnSmall,
                background: docTab === t.id ? C.accentDim : 'transparent',
                borderColor: docTab === t.id ? C.accent : C.border,
                color: docTab === t.id ? C.accent : C.textMuted,
              }}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={() => copyText(plan.documents[docTab], docTab)}
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
            value={editDocs[docTab]}
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
            {plan.documents[docTab]}
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
