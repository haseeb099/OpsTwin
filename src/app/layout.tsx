// src/app/layout.tsx
// Root layout — applies IBM Plex Mono, sets dark base background, and strips
// default browser padding so the OpsTwin shell can take the full viewport.

import type { Metadata } from 'next'
import { IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-ibm-plex-mono',
})

export const metadata: Metadata = {
  title: 'OpsTwin — Cursor Execution Audit',
  description:
    'Audit and memory layer for AI-assisted coding with Cursor. Tracks what was changed, skipped, and why.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={ibmPlexMono.variable}>
      <body
        style={{
          margin: 0,
          padding: 0,
          background: '#0a0c10',
          color: '#e2e8f0',
          fontFamily: "'IBM Plex Mono', 'Fira Code', 'Courier New', monospace",
        }}
      >
        {children}
      </body>
    </html>
  )
}
