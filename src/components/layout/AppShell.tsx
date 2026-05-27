'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

type NavId = 'dashboard' | 'memory' | 'audit'

interface AppShellProps {
  activeNav: NavId
  onNav: (id: NavId) => void
  onNewTask: () => void
  children: ReactNode
  header?: ReactNode
}

const NAV: { id: NavId; label: string; icon: ReactNode }[] = [
  {
    id: 'dashboard',
    label: 'Projects',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
      </svg>
    ),
  },
  {
    id: 'memory',
    label: 'Memory',
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182.553-.44 1.278-.659 2.003-.659.768 0 1.536.219 2.121.659z" />
      </svg>
    ),
  },
]

export default function AppShell({ activeNav, onNav, onNewTask, children, header }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-surface-border bg-surface-raised">
        <div className="flex h-14 items-center gap-2.5 border-b border-surface-border px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand shadow-glow">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-white">OpsTwin</div>
            <div className="text-[10px] text-zinc-500">Agent orchestration</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {NAV.map((item) => {
            const active = activeNav === item.id || (activeNav === 'audit' && item.id === 'dashboard')
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNav(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-brand-muted text-brand-hover'
                    : 'text-zinc-400 hover:bg-surface-overlay hover:text-zinc-200'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            )
          })}
          <Link
            href="/upload"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition hover:bg-surface-overlay hover:text-zinc-200"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload audit
          </Link>
        </nav>

        <div className="border-t border-surface-border p-3">
          <button type="button" onClick={onNewTask} className="btn-primary w-full">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New project
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {header && (
          <header className="flex h-14 shrink-0 items-center border-b border-surface-border bg-surface-raised/80 px-6 backdrop-blur-sm">
            {header}
          </header>
        )}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
