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

  test('every button with visible text is named with that text, so voice control can find it', () => {
    const { window } = openPage();
    const squash = (text) => text.replace(/\s+/g, ' ').trim().toLowerCase();
    const mismatched = Array.from(window.document.querySelectorAll('button[aria-label]'))
      .filter((button) => squash(button.textContent) !== '')
      .filter(
        (button) => !squash(button.getAttribute('aria-label')).includes(squash(button.textContent))
      )
      .map((button) => button.id || button.outerHTML);
    expect(mismatched).toEqual([]);
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

  test('a finished game offers Review and New game beside the result', () => {
    const { window, byId } = openPage();
    const square = (name) =>
      window.document.querySelector(
        `#chess-board .square[data-row="${8 - Number(name[1])}"][data-col="${name.charCodeAt(0) - 97}"]`
      );
    const play = (...moves) => {
      for (const move of moves) {
        square(move.slice(0, 2)).click();
        square(move.slice(2)).click();
      }
    };
    play('f2f3', 'e7e5', 'g2g4');
    expect(byId('result-actions').hidden).toBe(true);

    play('d8h4');
    expect(byId('game-status').textContent).toBe('Checkmate! Black wins.');
    expect(byId('status-bar').classList.contains('is-over')).toBe(true);
    expect(byId('result-actions').hidden).toBe(false);

    byId('review-button').click();
    expect(byId('game-status').textContent).toBe('Viewing the starting position');
    // It belongs to the final position: out of sight, but it keeps its room on a phone
    expect(byId('result-actions').classList.contains('holds-place')).toBe(true);
    expect(window.document.activeElement.dataset.ply).toBe('1'); // The arrow keys go on from here
    expect(square('e2').querySelector('.piece')).not.toBeNull();

    byId('live-button').click();
    expect(byId('result-actions').hidden).toBe(false);
    expect(byId('result-actions').classList.contains('holds-place')).toBe(false);
    byId('again-button').click(); // No question: the game is over
    expect(byId('game-status').textContent).toBe("White's turn");
    expect(byId('move-history').querySelectorAll('button')).toHaveLength(0);
    expect(byId('result-actions').hidden).toBe(true);
  });

  test('Left and Right step through the game from anywhere but the board; Esc returns', () => {
    const { window, byId } = openPage();
    const square = (name) =>
      window.document.querySelector(
        `#chess-board .square[data-row="${8 - Number(name[1])}"][data-col="${name.charCodeAt(0) - 97}"]`
      );
    const press = (target, key) =>
      target.dispatchEvent(
        new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      );
    const status = () => byId('game-status').textContent;
    for (const move of ['e2e4', 'e7e5', 'g1f3']) {
      square(move.slice(0, 2)).click();
      square(move.slice(2)).click();
    }

    press(window.document.body, 'ArrowLeft');
    expect(status()).toBe('Viewing 1... e5');
    press(byId('hint-button'), 'ArrowLeft');
    expect(status()).toBe('Viewing 1. e4');
    press(window.document.body, 'ArrowRight');
    expect(status()).toBe('Viewing 1... e5');

    square('e4').focus();
    press(square('e4'), 'ArrowLeft'); // On the board: to the next square, not the next move
    expect(status()).toBe('Viewing 1... e5');
    expect(window.document.activeElement).toBe(square('d4'));

    byId('move-history').querySelector('button[data-ply="2"]').focus();
    press(window.document.activeElement, 'ArrowLeft'); // In the move list: one step, not two
    expect(status()).toBe('Viewing 1. e4');

    // A square pressed with the mouse gives the focus up, so the arrows step again
    square('e4').focus();
    square('e4').dispatchEvent(new window.Event('pointerup', { bubbles: true }));
    expect(window.document.activeElement).toBe(window.document.body);
    press(window.document.body, 'ArrowRight');
    expect(status()).toBe('Viewing 1... e5');

    press(window.document.body, 'Escape');
    expect(status()).toBe("Black's turn");
    press(window.document.body, 'ArrowRight'); // Already at the latest move
    expect(status()).toBe("Black's turn");
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
