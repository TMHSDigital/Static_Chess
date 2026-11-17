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
    'js/game-store.js',
    'js/clock.js',
    'js/review.js',
    'js/engine-bridge.js',
    'js/game-ui.js',
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
            // 'no-cache' as in the fetch handler below: every file comes from the
            // server, not from the browser's HTTP cache, so the saved copy is one release
            .then((cache) =>
                cache.addAll(APP_FILES.map((file) => new Request(file, { cache: 'no-cache' })))
            )
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
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;

    const savedCopy = () => caches.match(request, { ignoreSearch: true });

    // 'no-cache' asks the server every time, also while the browser's own HTTP
    // cache still holds a copy it considers fresh. Without it "the network" can
    // be that copy, each file with its own age, and a page can run new scripts
    // next to old ones after a release. An unchanged file costs a 304 with no body.
    const network = fetch(request, { cache: 'no-cache' });

    // A good answer is saved also when the saved copy has already been used, so
    // the next visit gets the new version. waitUntil is called now, while the
    // event is being handled: called later, after the saved copy has answered,
    // the browser would refuse it and could stop the worker before the write.
    // The copy is kept under the address without its query string, which is how
    // savedCopy looks it up, so "?utm_source=..." links do not each add a copy
    // that is never read.
    event.waitUntil(
        network
            .then(async (response) => {
                if (!response.ok) return;
                const copy = response.clone(); // Before the page reads the body
                url.search = '';
                const cache = await caches.open(CACHE_NAME);
                await cache.put(url.href, copy);
            })
            .catch(() => {}) // No connection, or a full or blocked cache: the page is answered below
    );

    event.respondWith(
        new Promise((resolve) => {
            // The network is slow: answer from the saved copy if there is one.
            // Without one there is nothing better to do than keep waiting.
            const waiting = setTimeout(() => {
                savedCopy().then((saved) => {
                    if (saved) resolve(saved);
                });
            }, NETWORK_WAIT_MS);

            network
                .then((response) => {
                    clearTimeout(waiting);
                    resolve(response); // Has no effect if the saved copy was used
                })
                .catch(() => {
                    clearTimeout(waiting);
                    savedCopy().then((saved) => resolve(saved || Response.error()));
                });
        })
    );
});
