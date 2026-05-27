'use client'

import type { WorkflowStep } from '@/types/workflow'

const STEPS: {
  n: WorkflowStep
  title: string
  subtitle: string
}[] = [
  { n: 1, title: 'Install', subtitle: 'Add OpsTwin to your repo' },
  { n: 2, title: 'Plan', subtitle: 'AI decomposes your MVP' },
  { n: 3, title: 'Approve', subtitle: 'You confirm the plan' },
  { n: 4, title: 'Execute', subtitle: 'Agent writes code' },
  { n: 5, title: 'Audit', subtitle: 'Files, tests, terminal' },
  { n: 6, title: 'Improve', subtitle: 'Better prompt, repeat' },
]

export default function Pipeline({ currentStep }: { currentStep: WorkflowStep }) {
  return (
    <div className="card mb-6 overflow-hidden">
      <div className="border-b border-surface-border px-5 py-4">
        <p className="label-section mb-1">Orchestration pipeline</p>
        <h2 className="text-base font-semibold text-white">
          Your repo → Agent → OpsTwin → Improved prompt
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Install once. Any coding agent reads project rules, writes audit files, and OpsTwin
          closes the loop with gap analysis and Groq-powered prompt refinement.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px bg-surface-border md:grid-cols-3 lg:grid-cols-6">
        {STEPS.map((step) => {
          const isActive = step.n === currentStep
          const isDone = step.n < currentStep
          return (
            <div
              key={step.n}
              className={`relative bg-surface-raised px-4 py-4 transition ${
                isActive ? 'bg-brand-muted ring-1 ring-inset ring-brand/40' : ''
              }`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    isDone
                      ? 'bg-success/20 text-success'
                      : isActive
                        ? 'bg-brand text-white'
                        : 'bg-surface-overlay text-zinc-500'
                  }`}
                >
                  {isDone ? (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.n
                  )}
                </span>
                {isActive && (
                  <span className="badge bg-brand-muted text-brand-hover">Current</span>
                )}
              </div>
              <div className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-zinc-300'}`}>
                {step.title}
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">{step.subtitle}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
