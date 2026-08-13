import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { AuthProvider } from '@/context/AuthContext'
import { ServiceWorkerRegistrar } from '@/components/layout/ServiceWorkerRegistrar'
import './globals.css'

/*
 * IBM Plex is getekend voor technische interfaces: rustige letters, cijfers die
 * onderling goed te onderscheiden zijn, en een smalle variant die grote
 * kiosknummers op een telefoonscherm laat passen.
 *
 * De bestanden staan in de repo in plaats van bij Google: zo heeft de
 * Docker-build op de server geen internetverbinding nodig om te slagen.
 */
const plex = localFont({
  src: [
    { path: './fonts/ibm-plex-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/ibm-plex-sans-latin-700-normal.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-plex',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})

const plexCondensed = localFont({
  src: [
    {
      path: './fonts/ibm-plex-sans-condensed-latin-600-normal.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: './fonts/ibm-plex-sans-condensed-latin-700-normal.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-plex-condensed',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
})

export const metadata: Metadata = {
  title: 'StockFlow — Voorraad & logistiek',
  description: 'Voorraadbeheer voor kiosken in de Johan Cruijff ArenA',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    // Staat onder het icoon op het beginscherm; daar past alleen de naam.
    title: 'StockFlow',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#16181A',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={`${plex.variable} ${plexCondensed.variable}`}>
      <body>
        <ServiceWorkerRegistrar />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
