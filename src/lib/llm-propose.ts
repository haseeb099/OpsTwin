// src/lib/llm-propose.ts
// LLM-powered next-prompt proposal with structured JSON output

import { z } from 'zod'
import { isLlmEnabled, getLlmProvider } from '@/lib/llm'
import type {
  AuditReport,
  DocumentBundle,
  MemoryEntry,
  MvpPlan,
  PlanGap,
  StackContext,
} from '@/types'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

const LlmProposeResponseSchema = z.object({
  improvedPrompt: z.string().min(10),
  rationale: z.string().min(1),
  docPatches: z
    .object({
      prd: z.string().optional(),
      trd: z.string().optional(),
      useCases: z.string().optional(),
      testPlan: z.string().optional(),
      architecture: z.string().optional(),
    })
    .optional(),
  suggestedCommands: z.array(z.string()).default([]),
})

export type LlmProposeResult = z.infer<typeof LlmProposeResponseSchema> & { source: 'llm' }

export function isLlmProposeEnabled(): boolean {
  return process.env.OPSTWIN_LLM_PROPOSE !== 'false' && isLlmEnabled()
}

function resolveLlmConfig() {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase()

  if (process.env.GROQ_API_KEY && explicit !== 'openai') {
    return {
      apiKey: process.env.GROQ_API_KEY,
      baseUrl: GROQ_URL,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    }
  }

  if (process.env.OPENAI_API_KEY && explicit !== 'groq') {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: OPENAI_URL,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    }
  }

  return null
}

export interface ProposeWithLlmInput {
  taskTitle: string
  originalPrompt: string
  capturedPrompt?: string | null
  plan?: MvpPlan | null
  report?: AuditReport | null
  gaps: PlanGap[]
  stackContext?: StackContext | null
  memories?: MemoryEntry[]
  planStepOrder?: number
}

export async function proposeWithLlm(
  input: ProposeWithLlmInput,
): Promise<LlmProposeResult | null> {
  if (!isLlmProposeEnabled()) return null

  const config = resolveLlmConfig()
  if (!config) return null

  const step = input.planStepOrder
    ? input.plan?.steps.find((s) => s.order === input.planStepOrder)
    : input.plan?.steps.find((s) => s.status === 'in_progress' || s.status === 'pending')

  const payload = {
    task: {
      title: input.taskTitle,
      originalPrompt: input.originalPrompt,
      capturedPrompt: input.capturedPrompt ?? null,
    },
    planStep: step
      ? { order: step.order, title: step.title, goal: step.goal }
      : null,
    audit: input.report
      ? {
          filesChanged: input.report.filesChanged.map((f) => f.path),
          tests: input.report.testsRun,
          blockers: input.report.blockers,
          nextSteps: input.report.nextSteps,
          mismatches: input.report.mismatches,
        }
      : null,
    gaps: input.gaps.filter((g) => g.severity !== 'info').slice(0, 8),
    stack: input.stackContext ?? null,
    memoryHint: input.memories?.[0]?.improvementSuggestion ?? null,
  }

  try {
    const res = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are OpsTwin. Compare user intent vs agent outcome and produce ONE improved agent prompt.
Return JSON: { "improvedPrompt": string, "rationale": string, "docPatches"?: { prd?, trd?, useCases?, testPlan?, architecture? }, "suggestedCommands": string[] }
The improvedPrompt must be actionable, reference specific gaps/blockers, and remind the agent to write .ops/runs/<run_id>/last_run.json.`,
          },
          {
            role: 'user',
            content: JSON.stringify(payload),
          },
        ],
        temperature: 0.3,
      }),
    })

    if (!res.ok) {
      console.error('[llm-propose] API error', res.status, await res.text())
      return null
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    const content = data.choices?.[0]?.message?.content
    if (!content) return null

    const parsed = LlmProposeResponseSchema.parse(JSON.parse(content))
    return { ...parsed, source: 'llm' as const }
  } catch (err) {
    console.error('[llm-propose] Failed, will use rules fallback:', err)
    return null
  }
}

export function getLlmProposeProvider(): string {
  if (!isLlmProposeEnabled()) return 'rules'
  return getLlmProvider()
}

export type DocPatches = Partial<DocumentBundle>
