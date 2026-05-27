// src/lib/auth.ts
// Simple session auth — no external deps

import { createHmac, randomBytes } from 'crypto'
import { prisma } from '@/lib/db'

const COOKIE_NAME = 'opstwin_session'
const SESSION_DAYS = 7

export function isAuthEnabled(): boolean {
  if (process.env.OPSTWIN_AUTH_DISABLED === 'true') return false
  return !!(process.env.OPSTWIN_ADMIN_PASSWORD || process.env.OPSTWIN_API_KEY)
}

export function verifyApiKey(header: string | null): boolean {
  const key = process.env.OPSTWIN_API_KEY
  if (!key) return false
  return header === key
}

export function verifyAdminPassword(password: string): boolean {
  const expected = process.env.OPSTWIN_ADMIN_PASSWORD
  if (!expected) return false
  return password === expected
}

function hashToken(token: string): string {
  const secret = process.env.NEXTAUTH_SECRET || 'opstwin-dev-secret'
  return createHmac('sha256', secret).update(token).digest('hex')
}

export async function createSession(user = 'admin'): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const hashed = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await prisma.authSession.create({
    data: { token: hashed, user, expiresAt },
  })

  return token
}

export async function validateSession(token: string | undefined): Promise<boolean> {
  if (!token) return false
  const hashed = hashToken(token)
  const session = await prisma.authSession.findUnique({ where: { token: hashed } })
  if (!session) return false
  if (session.expiresAt < new Date()) {
    await prisma.authSession.delete({ where: { id: session.id } }).catch(() => {})
    return false
  }
  return true
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return
  const hashed = hashToken(token)
  await prisma.authSession.deleteMany({ where: { token: hashed } })
}

export { COOKIE_NAME }
