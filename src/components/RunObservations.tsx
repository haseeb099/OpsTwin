'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'

const C = {
  border: '#1e2530',
  textMuted: '#64748b',
  textDim: '#94a3b8',
  redText: '#f87171',
  greenText: '#34d399',
  accent: '#00d4ff',
}

interface TerminalLog {
  id: string
  command: string
  exitCode: number
  stdout: string
  stderr: string
  capturedAt: string
}

interface Screenshot {
  id: string
  label: string
  dataUrl: string
  capturedAt: string
}

export default function RunObservations({
  runId,
  onToast,
}: {
  runId: string
  onToast: (msg: string, variant: 'error' | 'success') => void
}) {
  const [logs, setLogs] = useState<TerminalLog[]>([])
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    const [tRes, sRes] = await Promise.all([
      fetch(`/api/runs/${runId}/terminal`),
      fetch(`/api/runs/${runId}/screenshots`),
    ])
    if (tRes.ok) {
      const d = (await tRes.json()) as { logs: TerminalLog[] }
      setLogs(d.logs ?? [])
    }
    if (sRes.ok) {
      const d = (await sRes.json()) as { screenshots: Screenshot[] }
      setScreenshots(d.screenshots ?? [])
    }
  }, [runId])

  useEffect(() => {
    load()
  }, [load])

  const onScreenshotFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch(`/api/runs/${runId}/screenshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: file.name, dataUrl }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      onToast('Screenshot uploaded', 'success')
      await load()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Upload failed', 'error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 20 }}>
      <Section title="Terminal output">
        {logs.length === 0 ? (
          <p style={{ color: C.textMuted, fontSize: 12, margin: 0 }}>
            No terminal logs. Use: node opstwin-cli.js run npm test
          </p>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              style={{
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: 10,
                marginBottom: 8,
                fontSize: 11,
              }}
            >
              <div style={{ color: log.exitCode === 0 ? C.greenText : C.redText }}>
                $ {log.command} → exit {log.exitCode}
              </div>
              {log.stdout && (
                <pre style={{ color: C.textDim, whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>
                  {log.stdout.slice(0, 2000)}
                </pre>
              )}
              {log.stderr && (
                <pre style={{ color: C.redText, whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>
                  {log.stderr.slice(0, 2000)}
                </pre>
              )}
            </div>
          ))
        )}
      </Section>

      <Section title="UI screenshots">
        <label
          style={{
            display: 'inline-block',
            padding: '8px 14px',
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            fontSize: 12,
            cursor: uploading ? 'wait' : 'pointer',
            color: C.accent,
            marginBottom: 12,
          }}
        >
          {uploading ? 'Uploading...' : 'Upload screenshot'}
          <input
            type="file"
            accept="image/*"
            onChange={onScreenshotFile}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {screenshots.map((s) => (
            <div key={s.id} style={{ maxWidth: 280 }}>
              <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{s.label}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.dataUrl}
                alt={s.label}
                style={{
                  maxWidth: '100%',
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                }}
              />
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        background: '#0f1218',
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: C.textMuted,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}
