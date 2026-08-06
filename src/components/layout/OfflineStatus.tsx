'use client'

import { useEffect, useState } from 'react'

export function OfflineStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)

    function onOnline() {
      setIsOnline(true)
      // Toon 'weer online' bericht 3 seconden
      setVisible(true)
      setTimeout(() => setVisible(false), 3000)
    }
    function onOffline() {
      setIsOnline(false)
      setVisible(true)
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-0 right-0 top-14 z-50 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
        isOnline ? 'bg-green-500 text-white' : 'bg-gray-800 text-white'
      }`}
    >
      <span aria-hidden="true">{isOnline ? '✓' : '●'}</span>
      {isOnline ? 'Verbinding hersteld' : 'Geen internetverbinding — wijzigingen worden lokaal opgeslagen'}
    </div>
  )
}
