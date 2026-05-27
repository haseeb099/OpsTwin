import { NextRequest, NextResponse } from 'next/server'
import { destroySession, COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  await destroySession(token)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
