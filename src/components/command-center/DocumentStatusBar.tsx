'use client'

import type { DocumentBundle, MvpPlan } from '@/types'

const C = {
  border: '#1e2530',
  text: '#e2e8f0',
  textMuted: '#64748b',
  textDim: '#94a3b8',
  greenText: '#34d399',
  yellowText: '#fbbf24',
  accent: '#00d4ff',
}

export type DocKey = keyof DocumentBundle

export const DOC_META: Record<
  DocKey,
  { label: string; stepHint: string; minStep: number }
> = {
  prd: { label: 'PRD', stepHint: 'Requirements', minStep: 1 },
  useCases: { label: 'Use Cases', stepHint: 'Requirements', minStep: 2 },
  trd: { label: 'TRD', stepHint: 'Technical design', minStep: 2 },
  architecture: { label: 'Architecture', stepHint: 'System design', minStep: 3 },
  erd: { label: 'ERD', stepHint: 'Data model', minStep: 3 },
  testPlan: { label: 'Test Plan', stepHint: 'Verification', minStep: 5 },
}

function docStatus(plan: MvpPlan, key: DocKey): 'locked' | 'draft' | 'ready' {
  const content = plan.documents[key] ?? ''
  if (!content.trim()) return 'locked'
  const minStep = DOC_META[key].minStep
  const stepDone = plan.steps.some((s) => s.order >= minStep && s.status === 'complete')
  if (stepDone) return 'ready'
  const active = plan.steps.some((s) => s.order === minStep && s.status === 'in_progress')
  if (active) return 'draft'
  return 'draft'
}

export default function DocumentStatusBar({
  plan,
  activeTab,
  onSelect,
}: {
  plan: MvpPlan
  activeTab: DocKey
  onSelect: (key: DocKey) => void
}) {
  const keys = Object.keys(DOC_META) as DocKey[]

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
      {keys.map((key) => {
        const meta = DOC_META[key]
        const status = docStatus(plan, key)
        const selected = activeTab === key
        const color =
          status === 'ready' ? C.greenText : status === 'draft' ? C.yellowText : C.textMuted
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: selected ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
              background: selected ? '#003344' : '#0a0c10',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              minWidth: 120,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{meta.label}</div>
            <div style={{ fontSize: 10, color: C.textMuted }}>{meta.stepHint}</div>
            <div style={{ fontSize: 10, color, marginTop: 4, textTransform: 'uppercase' }}>
              {status}
            </div>
            <div style={{ fontSize: 9, color: C.textDim, marginTop: 2 }}>
              v{plan.version} · {new Date(plan.updatedAt).toLocaleDateString()}
            </div>
          </button>
        )
      })}
    </div>
  )
}
