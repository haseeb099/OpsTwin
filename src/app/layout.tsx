// src/app/layout.tsx
// Root layout — IBM Plex Mono, dark base background, full viewport shell.

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
  title: 'OpsTwin — Agent Orchestration Platform',
  description:
    'Install in your repo. Any coding agent writes audits. OpsTwin plans, detects gaps, and delivers improved prompts.',
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
