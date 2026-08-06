import type { Metadata, Viewport } from 'next'
import { AuthProvider } from '@/context/AuthContext'
import './globals.css'

export const metadata: Metadata = {
  title: 'LogistiekStock — Johan Cruijff ArenA',
  description: 'Voorraadbeheer voor kiosken in de Johan Cruijff ArenA',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'LogistiekStock',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#E8000D',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
