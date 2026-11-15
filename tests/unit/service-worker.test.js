const fs = require('fs');
const path = require('path');

const ORIGIN = 'https://example.test';
const PAGE = `${ORIGIN}/chess/`;
const OFFLINE = { offline: true }; // What the stubbed Response.error() returns
const WORKER_GLOBALS = ['self', 'caches', 'fetch', 'Request', 'Response'];

/** The APP_FILES list in sw.js, read from its source. */
function appFiles() {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
  const list = source.match(/const APP_FILES = \[([\s\S]*?)\];/)[1];
  return [...list.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

const withoutQuery = (url) => url.split('?')[0];
const response = (ok, body) => ({ ok, body, clone: () => ({ ok, body, copy: true }) });
const get = (url) => ({ method: 'GET', url });
const settled = () => new Promise((resolve) => setTimeout(resolve, 0)); // Lets unawaited work finish

/**
 * Loads sw.js with the service worker globals stubbed: Cache Storage is a Map
 * of Maps, and the network is the function passed in.
 * @param {(request: object) => Promise<object>} [network]
 */
function startServiceWorker(network = () => Promise.reject(new Error('offline'))) {
  const listeners = {};
  const stores = new Map(); // Cache name -> Map of URL -> response
  const log = []; // What the worker did, in order
  const installed = []; // Every request the install step asked the cache to fetch

  global.self = {
    location: { origin: ORIGIN },
    addEventListener: (type, listener) => {
      listeners[type] = listener;
    },
    skipWaiting: async () => log.push('skipWaiting'),
    clients: { claim: async () => log.push('claim') },
  };
  global.caches = {
    open: async (name) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        addAll: async (requests) => {
          log.push('addAll');
          for (const request of requests) {
            installed.push(request);
            store.set(request.url, response(true, request.file));
          }
        },
        put: async (request, saved) => store.set(request.url, saved),
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name) => {
      log.push(`delete ${name}`);
      return stores.delete(name);
    },
    match: async (request, options = {}) => {
      const same = (a, b) => (options.ignoreSearch ? withoutQuery(a) === withoutQuery(b) : a === b);
      for (const store of stores.values()) {
        for (const [url, saved] of store) {
          if (same(url, request.url)) return saved;
        }
      }
      return undefined;
    },
  };
  global.fetch = network;
  // As in a worker, a relative address is taken from where the worker is
  global.Request = class {
    constructor(file, init = {}) {
      this.file = file;
      this.url = new URL(file, PAGE).href;
      this.cache = init.cache;
    }
  };
  global.Response = { error: () => OFFLINE };

  jest.resetModules();
  require('../../sw.js');

  /** Fires an install or activate event and waits for what it asked to wait for. */
  const lifecycle = async (type) => {
    let work;
    listeners[type]({ waitUntil: (promise) => (work = promise) });
    await work;
  };
  /** Fires a fetch event. @returns {Promise<object>|undefined} undefined if it was not answered. */
  const fetchEvent = (request) => {
    let answer;
    listeners.fetch({ request, respondWith: (promise) => (answer = promise) });
    return answer;
  };
  return { stores, log, installed, lifecycle, fetchEvent };
}

afterEach(() => {
  for (const name of WORKER_GLOBALS) delete global[name];
});

describe('service worker', () => {
  test('install saves every app file, then takes over without waiting', async () => {
    const sw = startServiceWorker();
    await sw.lifecycle('install');

    expect(sw.log).toEqual(['addAll', 'skipWaiting']);
    expect(sw.stores.size).toBe(1);
    const [saved] = sw.stores.values();
    expect([...saved.keys()]).toEqual(appFiles().map((file) => new URL(file, PAGE).href));
    expect(saved.size).toBeGreaterThan(20);
  });

  test("install asks the server for every file, past the browser's own HTTP cache", async () => {
    const sw = startServiceWorker();
    await sw.lifecycle('install');

    expect(sw.installed.map((request) => request.file)).toEqual(appFiles());
    // Otherwise a file fetched in the last ten minutes would be saved in its old version
    expect(new Set(sw.installed.map((request) => request.cache))).toEqual(new Set(['no-cache']));
  });

  test("activate removes this app's older caches and no others, then claims the pages", async () => {
    const sw = startServiceWorker();
    await sw.lifecycle('install');
    const [current] = sw.stores.keys();
    sw.stores.set('static-chess-v0', new Map());
    sw.stores.set('static-chess-old', new Map());
    sw.stores.set('another-app-v3', new Map()); // Another app on the same host
    sw.stores.set('chess', new Map());

    await sw.lifecycle('activate');
    expect([...sw.stores.keys()]).toEqual([current, 'another-app-v3', 'chess']);
    expect(sw.log.slice(2)).toEqual(['delete static-chess-v0', 'delete static-chess-old', 'claim']);
  });

  test('requests that are not same-origin GETs are left to the browser', () => {
    const network = jest.fn();
    const sw = startServiceWorker(network);
    expect(sw.fetchEvent({ method: 'POST', url: `${PAGE}index.html` })).toBeUndefined();
    expect(sw.fetchEvent(get('https://other.test/chess/js/game.js'))).toBeUndefined();
    expect(network).not.toHaveBeenCalled();
  });

  test('a page that loads from the network is returned and a copy is saved', async () => {
    const fresh = response(true, 'new version');
    const sw = startServiceWorker(async () => fresh);
    await sw.lifecycle('install');
    const request = get(`${PAGE}js/game.js`);

    expect(await sw.fetchEvent(request)).toBe(fresh);
    await settled();
    const [saved] = sw.stores.values();
    expect(saved.get(request.url)).toEqual({ ok: true, body: 'new version', copy: true });
  });

  test("the server is asked every time, past the browser's own HTTP cache", async () => {
    const network = jest.fn(async () => response(true, 'new version'));
    const sw = startServiceWorker(network);
    await sw.lifecycle('install');
    const request = get(`${PAGE}js/rules.js`);

    await sw.fetchEvent(request);
    // 'no-cache' revalidates with the server instead of trusting a fresh entry
    expect(network).toHaveBeenCalledTimes(1);
    expect(network).toHaveBeenCalledWith(request, { cache: 'no-cache' });
  });

  test('a failed response is returned but not saved', async () => {
    const missing = response(false, 'not found');
    const sw = startServiceWorker(async () => missing);
    await sw.lifecycle('install');
    const request = get(`${PAGE}no-such-file.js`);

    expect(await sw.fetchEvent(request)).toBe(missing);
    await settled();
    const [saved] = sw.stores.values();
    expect(saved.has(request.url)).toBe(false);
    expect(saved.get(`${PAGE}js/game.js`).body).toBe('js/game.js'); // The good copy is untouched
  });

  test('without a connection the saved copy is used, also for a URL with a query string', async () => {
    const sw = startServiceWorker();
    await sw.lifecycle('install');

    expect((await sw.fetchEvent(get(`${PAGE}js/game.js`))).body).toBe('js/game.js');
    expect((await sw.fetchEvent(get(`${PAGE}index.html?source=pwa`))).body).toBe('index.html');
    expect((await sw.fetchEvent(get(PAGE))).body).toBe('./');
  });

  describe('a network that does not answer', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    /** A network whose requests stay open until the test settles them. */
    function stalledNetwork() {
      const pending = [];
      const network = () => new Promise((resolve, reject) => pending.push({ resolve, reject }));
      return { network, pending };
    }
    /** Tells whether a promise has settled yet, without waiting for it. */
    const stateOf = async (promise) => {
      let state = 'waiting';
      promise.then(
        () => (state = 'answered'),
        () => (state = 'rejected')
      );
      await jest.advanceTimersByTimeAsync(0);
      return state;
    };

    test('the saved copy is used after three seconds', async () => {
      const { network } = stalledNetwork();
      const sw = startServiceWorker(network);
      await sw.lifecycle('install');
      const answer = sw.fetchEvent(get(`${PAGE}js/game.js?v=2`));

      await jest.advanceTimersByTimeAsync(2999);
      expect(await stateOf(answer)).toBe('waiting');
      await jest.advanceTimersByTimeAsync(1);
      expect((await answer).body).toBe('js/game.js');
    });

    test('an answer that comes late is still saved for the next visit', async () => {
      const { network, pending } = stalledNetwork();
      const sw = startServiceWorker(network);
      await sw.lifecycle('install');
      const request = get(`${PAGE}js/game.js`);
      const answer = sw.fetchEvent(request);
      await jest.advanceTimersByTimeAsync(3000);
      expect((await answer).body).toBe('js/game.js'); // The copy from the install

      pending[0].resolve(response(true, 'new version'));
      await jest.advanceTimersByTimeAsync(0);
      const [saved] = sw.stores.values();
      expect(saved.get(request.url).body).toBe('new version');
    });

    test('a file that was never saved waits for the network', async () => {
      const { network, pending } = stalledNetwork();
      const sw = startServiceWorker(network);
      await sw.lifecycle('install');
      const answer = sw.fetchEvent(get(`${PAGE}never-saved.png`));
      await jest.advanceTimersByTimeAsync(60000);
      expect(await stateOf(answer)).toBe('waiting');

      const late = response(true, 'at last');
      pending[0].resolve(late);
      expect(await answer).toBe(late);
    });

    test('a network that answers in time is not overtaken by the saved copy', async () => {
      const { network, pending } = stalledNetwork();
      const sw = startServiceWorker(network);
      await sw.lifecycle('install');
      const answer = sw.fetchEvent(get(`${PAGE}js/game.js`));
      await jest.advanceTimersByTimeAsync(2000);
      const fresh = response(true, 'new version');
      pending[0].resolve(fresh);
      expect(await answer).toBe(fresh);
      await jest.advanceTimersByTimeAsync(5000); // The timer was cancelled: nothing more happens
      expect(jest.getTimerCount()).toBe(0);
    });

    test('a network that fails after a while still falls back to the copy', async () => {
      const { network, pending } = stalledNetwork();
      const sw = startServiceWorker(network);
      await sw.lifecycle('install');
      const answer = sw.fetchEvent(get(`${PAGE}index.html`));
      await jest.advanceTimersByTimeAsync(1000);
      pending[0].reject(new Error('connection reset'));
      expect((await answer).body).toBe('index.html');
      expect(jest.getTimerCount()).toBe(0);
    });
  });

  test('without a connection and without a copy the answer is a network error, not a rejection', async () => {
    const sw = startServiceWorker();
    await sw.lifecycle('install');
    await expect(sw.fetchEvent(get(`${PAGE}never-saved.png`))).resolves.toBe(OFFLINE);
  });
});
