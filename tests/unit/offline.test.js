const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

/** The APP_FILES list in sw.js, read from its source. */
function appFiles() {
  const list = read('sw.js').match(/const APP_FILES = \[([\s\S]*?)\];/)[1];
  return [...list.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

describe('offline support', () => {
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

  test('the 404 page links to the game and its files with paths from the site root', () => {
    const page = read('404.html');
    const site = '/Static_Chess/'; // Where GitHub Pages serves the repository
    const references = [...page.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
    expect(references).toContain(site); // The way back to the game
    expect(references.length).toBeGreaterThanOrEqual(3);
    for (const url of references) {
      // A relative path would break for an unknown address in a sub-folder
      expect([url, url.startsWith(site)]).toEqual([url, true]);
      const file = url.slice(site.length);
      if (file) expect([file, exists(file)]).toEqual([file, true]);
    }
    expect(page).toContain(`localStorage.getItem('${'pageTheme'}')`);
    expect(page).toContain('<meta name="robots" content="noindex" />');
  });

  test('the page has what a link preview needs, and the preview image is 1200x630', () => {
    const page = read('index.html');
    const site = 'https://tmhsdigital.github.io/Static_Chess/';
    const meta = (property) => {
      const tag = new RegExp(`<meta\\s+(?:property|name)="${property}"\\s+content="([^"]*)"`);
      return (page.match(tag) || [])[1];
    };
    expect(page).toContain(`<link rel="canonical" href="${site}" />`);
    expect(meta('og:type')).toBe('website');
    expect(meta('og:title')).toBe('Static Chess');
    expect(meta('og:description')).toBe(meta('description'));
    expect(meta('og:url')).toBe(site);
    expect(meta('twitter:card')).toBe('summary_large_image');

    const image = meta('og:image');
    expect(image.startsWith(site)).toBe(true); // Open Graph images need an absolute URL
    const png = fs.readFileSync(path.join(root, image.slice(site.length)));
    expect(png.toString('latin1', 1, 4)).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
    expect([meta('og:image:width'), meta('og:image:height')]).toEqual(['1200', '630']);
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
