const CACHE_NAME = 'jmc-v10'

// Critical assets loaded immediately
const CRITICAL_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './css/fonts.css',
  './js/main.js',
  './js/loader.js',
  './manifest.json',
  './assets/img/favicon.png'
]

// Non-critical assets loaded lazily
const LAZY_ASSETS = [
  './about.html',
  './artifacts.html',
  './presentation.html',
  './reflection.html',
  './references.html',
  './css/constellation.css',
  './js/anti-fouc.js',
  './js/three.min.js',
  './js/constellation.js',
  './fonts/VT323-Regular.ttf',
  './fonts/ShareTechMono-Regular.ttf',
  './fonts/Lato-Regular.ttf',
  './fonts/Lato-Light.ttf',
  './fonts/Lato-Bold.ttf',
  './fonts/Raleway-Light.ttf',
  './fonts/Raleway-Regular.ttf',
  './fonts/Raleway-Medium.ttf',
  './fonts/Oswald-Regular.ttf',
  './fonts/Oswald-Medium.ttf',
  './fonts/GFSDidot-Regular.ttf',
  './aect-standard-1.html',
  './aect-standard-2.html',
  './aect-standard-3.html',
  './aect-standard-4.html',
  './aect-standard-5.html'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching critical assets')
        // Cache critical assets first, then lazy assets
        return cache.addAll(CRITICAL_ASSETS)
          .then(() => cache.addAll(LAZY_ASSETS))
      })
  )
  // Activate immediately
  self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          // Return cached response immediately
          return response
        }
        // Network request with caching
        return fetch(event.request).then((networkResponse) => {
          // Cache successful responses for future use
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone)
            })
          }
          return networkResponse
        })
      })
  )
})

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME]
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
})
