'use client'

import { useCallback, useState } from 'react'

const C = {
  border: '#1e2530',
  textMuted: '#64748b',
  textDim: '#94a3b8',
  accent: '#00d4ff',
  accentDim: '#003344',
} as const

export function formatTaskId(id: string, mode: 'short' | 'full' = 'short'): string {
  if (mode === 'full' || id.length <= 14) return id
  return `${id.slice(0, 8)}…${id.slice(-4)}`
}

export function TaskIdChip({
  id,
  label = 'Task ID',
  compact = false,
  onCopied,
}: {
  id: string
  label?: string
  compact?: boolean
  onCopied?: (msg: string) => void
}) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
      onCopied?.('Task ID copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      onCopied?.('Copy failed — select the ID manually')
    }
  }, [id, onCopied])

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 6 : 8,
        flexWrap: 'wrap',
        maxWidth: '100%',
      }}
    >
      {!compact && (
        <span
          style={{
            color: C.textMuted,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      )}
      <code
        title={id}
        style={{
          color: C.textDim,
          fontSize: compact ? 11 : 12,
          fontFamily: 'inherit',
          background: '#0a0c10',
          border: `1px solid ${C.border}`,
          borderRadius: 4,
          padding: compact ? '2px 6px' : '3px 8px',
          wordBreak: 'break-all',
        }}
      >
        {formatTaskId(id, compact ? 'short' : 'full')}
      </code>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          void copy()
        }}
        title="Copy full task ID"
        style={{
          background: copied ? C.accentDim : 'transparent',
          border: `1px solid ${copied ? C.accent : C.border}`,
          color: copied ? C.accent : C.textMuted,
          padding: compact ? '1px 6px' : '2px 8px',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 10,
          fontWeight: 700,
          fontFamily: 'inherit',
          flexShrink: 0,
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}
