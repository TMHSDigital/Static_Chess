/**
 * @fileoverview Service worker: keeps a copy of the app so it opens and plays
 * without a connection. The network is always tried first, so a new release
 * shows up at once when online; the copy is used when the network fails, or
 * when it has not answered after a few seconds.
 */

// Cache Storage is shared by every app on the same host, so this app's caches
// carry its own prefix and nothing else is ever touched
const CACHE_PREFIX = 'static-chess-';
const CACHE_NAME = `${CACHE_PREFIX}v1`; // Change only to throw every saved copy away

// How long the network gets to answer before the saved copy is used instead.
// A connection that is up but delivers nothing (a captive portal, a weak
// signal) does not fail; without this the app would wait for the browser's own
// timeout although a complete copy is saved.
const NETWORK_WAIT_MS = 3000;

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
    'js/notation.js',
    'js/saved-game.js',
    'js/clock.js',
    'js/engine-bridge.js',
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
                    names
                        .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
                        .map((name) => caches.delete(name))
                )
            )
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

    const savedCopy = () => caches.match(request, { ignoreSearch: true });

    event.respondWith(
        new Promise((resolve) => {
            // The network is slow: answer from the saved copy if there is one.
            // Without one there is nothing better to do than keep waiting.
            const waiting = setTimeout(() => {
                savedCopy().then((saved) => {
                    if (saved) resolve(saved);
                });
            }, NETWORK_WAIT_MS);

            // 'no-cache' asks the server every time, also while the browser's
            // own HTTP cache still holds a copy it considers fresh. Without it
            // "the network" can be that copy, each file with its own age, and
            // a page can run new scripts next to old ones after a release. An
            // unchanged file costs a 304 with no body.
            fetch(request, { cache: 'no-cache' })
                .then((response) => {
                    clearTimeout(waiting);
                    if (response.ok) {
                        // Saved also when the copy has already been used, so the
                        // next visit gets the new version
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    resolve(response); // Has no effect if the saved copy was used
                })
                .catch(() => {
                    clearTimeout(waiting);
                    savedCopy().then((saved) => resolve(saved || Response.error()));
                });
        })
    );
});
