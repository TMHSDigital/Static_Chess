const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

/** The APP_FILES list in sw.js, read from its source. */
function appFiles() {
  const list = read('sw.js').match(/const APP_FILES = \[([\s\S]*?)\];/)[1];
  return [...list.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

/**
 * Runs sw.js against a fake Cache Storage, the way a browser would, and returns
 * the listeners it registered and the cache names its activate handler deleted.
 */
function loadServiceWorker(cacheNames) {
  const listeners = {};
  const deleted = [];
  const cache = { addAll: () => Promise.resolve(), put: () => Promise.resolve() };
  const sandbox = {
    self: {
      addEventListener: (type, listener) => {
        listeners[type] = listener;
      },
      skipWaiting: () => Promise.resolve(),
      clients: { claim: () => Promise.resolve() },
      location: { origin: 'https://example.test' },
    },
    caches: {
      keys: () => Promise.resolve([...cacheNames]),
      delete: (name) => {
        deleted.push(name);
        return Promise.resolve(true);
      },
      open: () => Promise.resolve(cache),
      match: () => Promise.resolve(undefined),
    },
    fetch: () => Promise.resolve({ ok: false }),
    Response: { error: () => ({}) },
    URL,
  };
  vm.runInNewContext(read('sw.js'), sandbox);
  return {
    listeners,
    deleted,
    activate: async () => {
      let work;
      listeners.activate({ waitUntil: (promise) => (work = promise) });
      await work;
    },
  };
}

describe('offline support', () => {
  test("activation removes only this app's old caches", async () => {
    const worker = loadServiceWorker(['static-chess-v1', 'static-chess-v0', 'another-app-cache']);
    await worker.activate();
    // Cache Storage is shared by the whole origin, so a cache under another name is not ours to delete.
    expect(worker.deleted).toEqual(['static-chess-v0']);
  });

  test('every file the service worker saves exists', () => {
    const files = appFiles().filter((file) => file !== './');
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      expect([file, exists(file)]).toEqual([file, true]);
    }
  });

  test('everything index.html loads is saved', () => {
    const files = appFiles();
    const references = [...read('index.html').matchAll(/(?:src|href)="([^"#]+)"/g)]
      .map((match) => match[1])
      .filter((url) => !/^(https?:|data:)/.test(url));
    expect(references).toContain('js/game.js');
    expect(references).toContain('manifest.webmanifest');
    for (const url of references) {
      expect(files).toContain(url);
    }
  });

  test('every piece image, script and stylesheet is saved', () => {
    const files = appFiles();
    const onDisk = [
      ...fs
        .readdirSync(path.join(root, 'assets'))
        .filter((name) => name.endsWith('.svg'))
        .map((name) => `assets/${name}`),
      ...fs.readdirSync(path.join(root, 'js')).map((name) => `js/${name}`),
      ...fs.readdirSync(path.join(root, 'css')).map((name) => `css/${name}`),
    ];
    for (const file of onDisk) {
      expect(files).toContain(file);
    }
  });

  test('the manifest is valid and its icons exist', () => {
    const manifest = JSON.parse(read('manifest.webmanifest'));
    expect(manifest.name).toBe('Static Chess');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('./'); // Relative, so it works under a sub-path
    const sizes = manifest.icons.map((icon) => icon.sizes);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
    for (const icon of manifest.icons) {
      expect([icon.src, exists(icon.src)]).toEqual([icon.src, true]);
    }
  });

  test('the PNG icons have the sizes the manifest states', () => {
    for (const size of [192, 512]) {
      const png = fs.readFileSync(path.join(root, `assets/icons/icon-${size}.png`));
      expect(png.toString('latin1', 1, 4)).toBe('PNG');
      expect(png.readUInt32BE(16)).toBe(size); // Width, from the IHDR chunk
      expect(png.readUInt32BE(20)).toBe(size); // Height
    }
  });
});
