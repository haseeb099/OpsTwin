'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? 'Login failed')
      }
      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0c10',
        color: '#e2e8f0',
        fontFamily: "'IBM Plex Mono', monospace",
      }}
    >
      <form
        onSubmit={submit}
        style={{
          background: '#0f1218',
          border: '1px solid #1e2530',
          borderRadius: 8,
          padding: 32,
          width: 360,
        }}
      >
        <h1 style={{ margin: '0 0 8px', fontSize: 20, color: '#00d4ff' }}>OpsTwin</h1>
        <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 13 }}>Sign in to continue</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin password"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '10px 12px',
            background: '#0a0c10',
            border: '1px solid #1e2530',
            borderRadius: 6,
            color: '#e2e8f0',
            fontFamily: 'inherit',
            marginBottom: 12,
          }}
        />
        {error && <p style={{ color: '#f87171', fontSize: 12, margin: '0 0 12px' }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            background: '#00d4ff',
            color: '#000',
            border: 'none',
            borderRadius: 6,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
