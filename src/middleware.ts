import { NextRequest, NextResponse } from 'next/server'
import { isAuthEnabled, verifyApiKey, validateSession, COOKIE_NAME } from '@/lib/auth'

const PUBLIC_API = ['/api/auth/login', '/api/auth/logout', '/api/auth/me', '/api/health']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!pathname.startsWith('/api/')) {
    if (pathname === '/login') return NextResponse.next()
    if (!isAuthEnabled()) return NextResponse.next()
    const token = req.cookies.get(COOKIE_NAME)?.value
    const ok = await validateSession(token)
    if (!ok && pathname !== '/login') {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return NextResponse.next()
  }

  if (!isAuthEnabled()) return NextResponse.next()
  if (PUBLIC_API.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const apiKey = req.headers.get('x-opstwin-key')
  if (verifyApiKey(apiKey)) return NextResponse.next()

  const token = req.cookies.get(COOKIE_NAME)?.value
  if (await validateSession(token)) return NextResponse.next()

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
