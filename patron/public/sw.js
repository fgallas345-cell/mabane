// Service worker de « Mabane Patron » : rend l'application installable et garde
// l'interface en cache pour qu'elle s'ouvre vite. Les données (Supabase) ne sont
// jamais mises en cache : les chiffres affichés sont toujours ceux du serveur.
const CACHE = 'mabane-patron-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/logo.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  // Seulement les fichiers de l'application elle-même (jamais l'API ni Supabase)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  // Pages : réseau d'abord (nouvelle version dès qu'elle est en ligne), cache si hors ligne
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/')))
    return
  }
  // Fichiers JS/CSS/images : cache d'abord, puis mise à jour en arrière-plan
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()))
          return res
        })
        .catch(() => cached)
      return cached || network
    })
  )
})
