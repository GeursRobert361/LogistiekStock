/**
 * Service worker voor LogistiekStock.
 *
 * Uitgangspunt: alleen de app-shell en statische build-assets worden gecachet.
 * Operationele gegevens (tellingen, bijvullijsten, gebruikersprofielen) gaan
 * NOOIT in deze cache — die horen in IndexedDB, waar ze bij het uitloggen
 * beheerd kunnen worden en niet per ongeluk tussen gebruikers lekken.
 */

const VERSION = 'v1'
const SHELL_CACHE = `logistiekstock-shell-${VERSION}`
const ASSET_CACHE = `logistiekstock-assets-${VERSION}`

/** Minimale set om de app offline te kunnen starten. */
const SHELL_URLS = ['/', '/offline', '/manifest.json', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        // Eén ontbrekend bestand mag de installatie niet laten mislukken.
        Promise.allSettled(SHELL_URLS.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('logistiekstock-') && !key.endsWith(VERSION))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  )
})

/** Onveranderlijke build-output van Next.js en losse statische bestanden. */
function isStaticAsset(url) {
  if (url.pathname.startsWith('/_next/static/')) return true
  return /\.(?:css|js|png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)
}

/** Alles wat gebruikers- of voorraadgegevens kan bevatten blijft ongecachet. */
function isPrivateRequest(request, url) {
  if (url.pathname.startsWith('/api/')) return true
  if (url.pathname.startsWith('/auth/')) return true
  if (request.headers.has('Authorization')) return true
  return false
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Andere origins (o.a. Supabase) laten we volledig met rust.
  if (url.origin !== self.location.origin) return
  if (isPrivateRequest(request, url)) return

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request))
  }
})

/** Statische assets zijn versienummer-gebonden: uit de cache is altijd goed. */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(cacheName)
    await cache.put(request, response.clone())
  }
  return response
}

/**
 * Pagina's: eerst het netwerk, zodat een nieuwe versie meteen zichtbaar is.
 *
 * Een geslaagde navigatie wordt onder zijn eigen URL bewaard, zodat een
 * refresh zonder verbinding dezelfde pagina teruggeeft en niet de homepage.
 * Deze HTML is een lege app-shell: de telgegevens komen uit IndexedDB, dus er
 * belandt geen voorraad- of gebruikersinformatie in de cache.
 */
async function navigationHandler(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE)
      await cache.put(request, response.clone())
      await cache.put('/', response.clone())
    }
    return response
  } catch {
    const cached = (await caches.match(request)) ?? (await caches.match('/'))
    if (cached) return cached

    const offline = await caches.match('/offline')
    if (offline) return offline

    return new Response('Offline en geen opgeslagen versie beschikbaar.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

/** Bij uitloggen wist de app de shell-cache, zodat er niets blijft hangen. */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_CACHES') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))))
  }
})
