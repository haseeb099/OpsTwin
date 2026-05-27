import { NextRequest, NextResponse } from 'next/server'
import { isAuthEnabled, validateSession, COOKIE_NAME } from '@/lib/auth'
import { isLlmEnabled, getLlmProvider } from '@/lib/llm'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  const authenticated = await validateSession(token)
  return NextResponse.json({
    authEnabled: isAuthEnabled(),
    authenticated,
    llmEnabled: isLlmEnabled(),
    llmProvider: getLlmProvider(),
  })
}
