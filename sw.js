/**
 * @fileoverview Service worker: keeps a copy of the app so it opens and plays
 * without a connection. The network is always tried first, so a new release
 * shows up at once when online; a saved copy also handles stalled connections.
 */

const NETWORK_TIMEOUT_MS = 2500;
const CACHE_NAME = 'static-chess-v1'; // Change only to throw every saved copy away

// Everything the app needs. tests/unit/offline.test.js checks this list
// against index.html and the files on disk.
const APP_FILES = [
    './',
    'index.html',
    'manifest.webmanifest',
    'css/style.css',
    'css/board.css',
    'css/pieces.css',
    'js/config.js',
    'js/utils.js',
    'js/pieces.js',
    'js/rules.js',
    'js/ai.js',
    'js/ai-worker.js',
    'js/board.js',
    'js/drag.js',
    'js/promotion.js',
    'js/game.js',
    'js/main.js',
    'assets/wk.svg',
    'assets/wq.svg',
    'assets/wr.svg',
    'assets/wb.svg',
    'assets/wn.svg',
    'assets/wp.svg',
    'assets/bk.svg',
    'assets/bq.svg',
    'assets/br.svg',
    'assets/bb.svg',
    'assets/bn.svg',
    'assets/bp.svg',
    'assets/icons/icon.svg',
    'assets/icons/icon-192.png',
    'assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_FILES))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((names) =>
                Promise.all(
                    names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
                )
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

    const controller = new AbortController();
    const saved = caches.match(request, { ignoreSearch: true }).catch(() => undefined);
    let timer;
    const cachedAfterDeadline = new Promise((resolve) => {
        timer = setTimeout(() => {
            saved
                .then((response) => {
                    if (response) {
                        resolve(response);
                        controller.abort();
                    }
                })
                .catch(() => {});
        }, NETWORK_TIMEOUT_MS);
    });

    event.respondWith(
        Promise.race([
            fetch(request, { signal: controller.signal }).then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                }
                return response;
            }),
            cachedAfterDeadline,
        ])
            .catch(() => saved.then((response) => response || Response.error()))
            .finally(() => clearTimeout(timer))
    );
});
