const fs = require('fs');
const path = require('path');
const vm = require('vm');

function setup(saved) {
  const handlers = {};
  const cache = { put: jest.fn() };
  const caches = {
    match: jest.fn().mockResolvedValue(saved),
    open: jest.fn().mockResolvedValue(cache),
  };
  const fetch = jest.fn();
  const networkError = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../sw.js'), 'utf8'), {
    self: {
      location: { origin: 'https://chess.test' },
      addEventListener: (name, callback) => {
        handlers[name] = callback;
      },
    },
    caches,
    fetch,
    URL,
    AbortController,
    Response: { error: () => networkError },
    setTimeout,
    clearTimeout,
  });
  const run = () => {
    let response;
    handlers.fetch({
      request: { method: 'GET', url: 'https://chess.test/index.html' },
      respondWith: (value) => {
        response = value;
      },
    });
    return response;
  };
  return { fetch, caches, cache, run, networkError };
}

describe('service worker network fallback', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('a filled cache wins within three seconds when fetch never settles', async () => {
    const saved = {};
    const worker = setup(saved);
    worker.fetch.mockImplementation(() => new Promise(() => {}));
    let response;
    worker.run().then((value) => {
      response = value;
    });
    await jest.advanceTimersByTimeAsync(3000);
    expect(response).toBe(saved);
    expect(worker.fetch.mock.calls[0][1].signal.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('a fresh network response wins and updates the cache', async () => {
    const worker = setup({});
    const copy = {};
    const fresh = { ok: true, clone: () => copy };
    worker.fetch.mockResolvedValue(fresh);
    expect(await worker.run()).toBe(fresh);
    await Promise.resolve();
    expect(worker.cache.put).toHaveBeenCalledWith(expect.anything(), copy);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('an uncached request keeps waiting for the network after the deadline', async () => {
    const worker = setup(undefined);
    let finish;
    worker.fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    let resolved = false;
    const response = worker.run().then((value) => {
      resolved = true;
      return value;
    });
    await jest.advanceTimersByTimeAsync(3000);
    expect(resolved).toBe(false);
    expect(worker.fetch.mock.calls[0][1].signal.aborted).toBe(false);
    const fresh = { ok: false };
    finish(fresh);
    expect(await response).toBe(fresh);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('an unavailable cache does not break a fresh network response', async () => {
    const worker = setup(undefined);
    const fresh = { ok: false };
    worker.caches.match.mockRejectedValue(new Error('cache unavailable'));
    worker.fetch.mockResolvedValue(fresh);
    expect(await worker.run()).toBe(fresh);
    expect(jest.getTimerCount()).toBe(0);
  });

  test.each([true, false])('a rejected fetch uses cache when present: %s', async (cached) => {
    const saved = cached ? {} : undefined;
    const worker = setup(saved);
    worker.fetch.mockRejectedValue(new Error('offline'));
    expect(await worker.run()).toBe(saved || worker.networkError);
    expect(jest.getTimerCount()).toBe(0);
  });
});
