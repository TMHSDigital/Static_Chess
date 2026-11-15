const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { JSDOM } = globalThis; // Provided by tests/helpers/jsdom-environment.js

const root = path.join(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const INDEX = read('index.html');
const SCRIPTS = [...INDEX.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);

const openPages = [];

/**
 * Opens the real index.html and runs its scripts in the order of its script
 * tags, in one shared global scope as a browser does, then fires
 * DOMContentLoaded.
 * @param {{storage?: Object<string, string>, configure?: string}} [options]
 *   storage: values to put in localStorage first. configure: code to run right
 *   after config.js, for example to switch a feature off.
 */
function openPage(options = {}) {
  const dom = new JSDOM(INDEX, { url: 'http://localhost/', runScripts: 'outside-only' });
  openPages.push(dom);
  const { window } = dom;
  for (const [key, value] of Object.entries(options.storage || {})) {
    window.localStorage.setItem(key, value);
  }
  const context = dom.getInternalVMContext();
  const run = (code, filename = 'test') => vm.runInContext(code, context, { filename });
  for (const script of SCRIPTS) {
    run(read(script), script);
    if (script === 'js/config.js' && options.configure) run(options.configure);
  }
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

  const byId = (id) => window.document.getElementById(id);
  const values = (id) => Array.from(byId(id).options).map((option) => option.value);
  return { window, run, byId, values };
}

afterEach(() => {
  while (openPages.length) openPages.pop().window.close(); // Stops the page's timers
});

describe('the real page', () => {
  test('has every element the scripts look up by id', () => {
    const { byId } = openPage();
    const ids = new Set();
    for (const file of fs.readdirSync(path.join(root, 'js'))) {
      for (const match of read(`js/${file}`).matchAll(/getElementById\('([^']+)'\)/g)) {
        ids.add(match[1]);
      }
    }
    ids.delete('promotion-dialog'); // Created when a pawn promotes
    expect(ids.size).toBeGreaterThan(25);
    const missing = [...ids].filter((id) => !byId(id));
    expect(missing).toEqual([]);
  });

  test('loads every script, in dependency order', () => {
    expect(SCRIPTS).toEqual(
      [
        'config',
        'utils',
        'pieces',
        'rules',
        'ai',
        'board',
        'drag',
        'promotion',
        'notation',
        'saved-game',
        'game-store',
        'clock',
        'review',
        'engine-bridge',
        'game-ui',
        'game',
        'main',
      ].map((name) => `js/${name}.js`)
    );
    const onDisk = fs
      .readdirSync(path.join(root, 'js'))
      .filter((name) => name !== 'ai-worker.js') // Loaded by the worker, not the page
      .map((name) => `js/${name}`);
    expect([...SCRIPTS].sort()).toEqual(onDisk.sort());
  });

  test('offers two players and exactly the levels the engine has', () => {
    const { run, values } = openPage();
    expect(values('opponent-select')).toEqual(['human', ...run('Object.keys(AI_LEVELS)')]);
    expect(values('side-select')).toEqual(['w', 'b']);
  });

  test('the player bars follow the opponent setting and the side to move', () => {
    const { window, byId } = openPage();
    const name = (id) => byId(id).textContent;
    expect([name('side-name-white'), name('side-name-black')]).toEqual(['White', 'Black']);
    expect(byId('side-white').classList.contains('to-move')).toBe(true);
    expect(byId('side-black').classList.contains('to-move')).toBe(false);

    byId('opponent-select').value = 'easy';
    byId('opponent-select').dispatchEvent(new window.Event('change', { bubbles: true }));
    expect([name('side-name-white'), name('side-name-black')]).toEqual(['You', 'Computer (easy)']);
    expect(byId('side-black').querySelector('.thinking').hidden).toBe(true); // Not its move
  });

  describe('clock setting', () => {
    test('lists every time control and starts on the default', () => {
      const { run, byId, values } = openPage();
      expect(values('clock-select')).toEqual(run('Object.keys(CONFIG.TIME_CONTROLS)'));
      expect(byId('clock-select').value).toBe(run('CONFIG.DEFAULT_SETTINGS.TIME_CONTROL'));
      expect(byId('clock-setting').hidden).toBe(false);
    });

    test('a saved choice is restored, and one that is not a time control is not', () => {
      const first = openPage();
      const key = first.run('CONFIG.STORAGE_KEYS.TIME_CONTROL');
      const controls = first.run('Object.keys(CONFIG.TIME_CONTROLS)');
      const fallback = first.run('CONFIG.DEFAULT_SETTINGS.TIME_CONTROL');
      const other = controls.find((control) => control !== fallback);

      expect(openPage({ storage: { [key]: other } }).byId('clock-select').value).toBe(other);
      expect(openPage({ storage: { [key]: 'an hour each' } }).byId('clock-select').value).toBe(
        fallback
      );
    });

    test('a change is saved and the next new game is played on that clock', () => {
      const { window, run, byId } = openPage();
      const key = run('CONFIG.STORAGE_KEYS.TIME_CONTROL');
      const timed = '5+0';
      expect(run('CONFIG.TIME_CONTROLS')[timed].minutes).toBe(5);
      expect(byId('clock-white').hidden).toBe(true);
      byId('clock-select').value = timed;
      byId('clock-select').dispatchEvent(new window.Event('change'));
      expect(window.localStorage.getItem(key)).toBe(timed);

      run('resetGame()');
      expect(byId('clock-white').hidden).toBe(false);
      expect(byId('clock-white').textContent).toBe('5:00');
    });
  });

  test('a feature that is switched off hides its settings', () => {
    const noClock = openPage({ configure: 'CONFIG.FEATURES.GAME_TIMER = false' });
    expect(noClock.byId('clock-setting').hidden).toBe(true);
    expect(noClock.byId('opponent-setting').hidden).toBe(false);

    const noComputer = openPage({ configure: 'CONFIG.FEATURES.AI_OPPONENT = false' });
    expect(noComputer.byId('opponent-setting').hidden).toBe(true);
    expect(noComputer.byId('side-setting').hidden).toBe(true);
    expect(noComputer.byId('clock-setting').hidden).toBe(false);
  });

  test('links to the source repository and the issue tracker', () => {
    const page = new JSDOM(INDEX).window;
    const links = Array.from(page.document.querySelectorAll('.game-info .about a'));
    expect(links.map((link) => [link.textContent.trim(), link.getAttribute('href')])).toEqual([
      ['Source on GitHub', 'https://github.com/TMHSDigital/Static_Chess'],
      ['Report a problem', 'https://github.com/TMHSDigital/Static_Chess/issues'],
    ]);
    page.close();
  });

  test('a move made with two clicks shows in the status and the move list', () => {
    const { window, byId } = openPage();
    const square = (row, col) =>
      window.document.querySelector(`#chess-board .square[data-row="${row}"][data-col="${col}"]`);
    expect(window.document.querySelectorAll('#chess-board .square')).toHaveLength(64);
    expect(byId('game-status').textContent).toBe("White's turn");

    square(6, 4).click(); // e2
    square(4, 4).click(); // e4
    expect(byId('game-status').textContent).toBe("Black's turn");
    expect(byId('move-history').textContent).toContain('e4');
    expect(square(4, 4).querySelector('.piece')).not.toBeNull();
    expect(byId('announcer').textContent).not.toBe('');
  });
});
