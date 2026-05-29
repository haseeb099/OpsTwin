'use client'

import { useState } from 'react'

export default function SetupPanel({ taskId }: { taskId?: string }) {
  const [copied, setCopied] = useState<string | null>(null)

  const commands = [
    {
      label: 'Clone OpsTwin (public GitHub repo)',
      code: 'git clone https://github.com/haseeb099/OpsTwin.git && cd OpsTwin && npm install',
    },
    {
      label: 'Install into your project',
      code: 'node opstwin/opstwin-init.js /path/to/your-project',
    },
    {
      label: 'Start the dashboard',
      code: 'cd opstwin && npm run dev',
    },
    {
      label: 'Start autopilot in your project (one command — leave running)',
      code: taskId
        ? `node opstwin-cli.js daemon ${taskId}`
        : `node opstwin-cli.js daemon <task-id-from-dashboard>`,
    },
  ]

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="card mb-6">
      <div className="border-b border-surface-border px-5 py-4">
        <p className="label-section mb-1">Repository integration</p>
        <h3 className="text-sm font-semibold text-white">Install from GitHub, connect any agent</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Clone OpsTwin, run init in your codebase. Cursor, Claude, Copilot, and others read{' '}
          <code className="rounded bg-surface-overlay px-1 py-0.5 font-mono text-xs text-zinc-400">
            .opstwin/
          </code>{' '}
          and write audits to{' '}
          <code className="rounded bg-surface-overlay px-1 py-0.5 font-mono text-xs text-zinc-400">
            .ops/runs/
          </code>
          .
        </p>
      </div>

      <div className="divide-y divide-surface-border">
        {commands.map((cmd, i) => (
          <div key={i} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm text-zinc-400">{cmd.label}</span>
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-xl sm:justify-end">
              <code className="block truncate rounded-lg border border-surface-border bg-surface px-3 py-1.5 font-mono text-xs text-zinc-300">
                {cmd.code}
              </code>
              <button
                type="button"
                onClick={() => copy(cmd.code, String(i))}
                className="btn-ghost shrink-0 text-xs"
              >
                {copied === String(i) ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-surface-border bg-surface/50 px-5 py-3">
        <p className="text-xs text-zinc-500">
          Agent config files:{' '}
          <span className="font-mono text-zinc-400">.cursor/</span>,{' '}
          <span className="font-mono text-zinc-400">CLAUDE.md</span>,{' '}
          <span className="font-mono text-zinc-400">AGENTS.md</span> — auto-loaded by each tool.
        </p>
      </div>
    </div>
  )
}
