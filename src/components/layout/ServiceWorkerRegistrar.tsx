'use client'

import { useEffect } from 'react'

/**
 * Registreert de service worker.
 *
 * In development staat dit uit: een cachende worker maakt hot reload
 * onvoorspelbaar en levert verwarrende oude pagina's op.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        console.error('[pwa] Service worker registreren mislukt.', error)
      })
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
    }
  }, [])

  return null
}

/** Wist de caches van de service worker, bijvoorbeeld bij uitloggen. */
export function clearServiceWorkerCaches(): void {
  navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_CACHES' })
}
