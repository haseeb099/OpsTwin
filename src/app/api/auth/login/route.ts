import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyAdminPassword, createSession, COOKIE_NAME } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const LoginSchema = z.object({
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { password } = LoginSchema.parse(body)

    if (!verifyAdminPassword(password)) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    const token = await createSession()
    const res = NextResponse.json({ ok: true, user: 'admin' })
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    })
    return res
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Login failed' }, { status: 500 })
  }
}
