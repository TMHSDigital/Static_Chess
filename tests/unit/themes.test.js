const { loadGame } = require('../helpers/load-game');

/** Starts the app as main.js does, on the page with its two theme selectors. */
function startApp(options = {}) {
  const g = loadGame(options);
  const doc = g.window.document;
  // The test page is index.html's own markup, selectors included
  const boardSelect = doc.getElementById('board-theme-select');
  const pageSelect = doc.getElementById('page-theme-select');
  Object.assign(global, {
    initializeGame: g.game.initializeGame,
    setBoardFlipped: g.board.setBoardFlipped,
  });
  require('../../js/main');
  doc.dispatchEvent(new g.window.Event('DOMContentLoaded'));

  const choose = (select, value) => {
    select.value = value;
    select.dispatchEvent(new g.window.Event('change'));
  };
  const cssVar = (name) => doc.documentElement.style.getPropertyValue(name);
  const stored = (key) => g.window.localStorage.getItem(key);
  return { ...g, doc, boardSelect, pageSelect, choose, cssVar, stored };
}

describe('values that are written down twice', () => {
  const fs = require('fs');
  const path = require('path');
  const css = (file) => fs.readFileSync(path.join(__dirname, '..', '..', 'css', file), 'utf8');

  // The stylesheet has to hold the default colours itself, so the first paint is
  // right before any script has run. config.js holds them again for the theme
  // selector. These tests are what keeps the two copies from drifting apart.
  test('the classic board theme in config.js is the default in style.css', () => {
    const { CONFIG } = require('../../js/config');
    const root = css('style.css').match(/:root \{([\s\S]*?)\n\}/)[1];
    const colours = CONFIG.BOARD_THEMES[CONFIG.DEFAULT_SETTINGS.BOARD_THEME].colors;
    expect(Object.keys(colours).length).toBeGreaterThanOrEqual(5);
    for (const [property, value] of Object.entries(colours)) {
      const declared = root.match(new RegExp(`${property}:\\s*([^;]+);`));
      expect([property, declared && declared[1].trim()]).toEqual([property, value]);
    }
  });

  test('the move animation takes its length from config.js alone', () => {
    const rule = css('pieces.css').match(/\.piece\.moved \{([^}]*)\}/)[1];
    expect(rule).toContain('animation-name: move-piece');
    expect(rule).not.toMatch(/animation(-duration)?:[^;]*\d/); // No length of its own
    const g = loadGame();
    g.play('e2e4');
    const moved = g.board.getSquareElement(4, 4).querySelector('.piece');
    expect(moved.classList.contains('moved')).toBe(true);
    expect(moved.style.animationDuration).toBe(`${global.CONFIG.ANIMATIONS.PIECE_MOVE}ms`);
  });
});

describe('board themes', () => {
  test('every theme sets the same five colours', () => {
    const themes = require('../../js/config').CONFIG.BOARD_THEMES;
    const names = Object.keys(themes);
    expect(names.length).toBeGreaterThanOrEqual(4);
    const properties = Object.keys(themes.classic.colors).sort();
    expect(properties).toHaveLength(5);
    for (const name of names) {
      expect(Object.keys(themes[name].colors).sort()).toEqual(properties);
      expect(typeof themes[name].label).toBe('string');
    }
  });

  test('the classic theme is the default and every theme is offered', () => {
    const app = startApp();
    expect(app.boardSelect.value).toBe('classic');
    expect(app.boardSelect.options).toHaveLength(Object.keys(global.CONFIG.BOARD_THEMES).length);
    expect(app.cssVar('--dark-square')).toBe('#b58863');
  });

  test('choosing a theme applies and remembers it', () => {
    const app = startApp();
    app.choose(app.boardSelect, 'green');
    expect(app.cssVar('--light-square')).toBe('#eeeed2');
    expect(app.cssVar('--dark-square')).toBe('#769656');
    expect(app.stored('boardTheme')).toBe('green');
  });

  test('a saved theme is restored', () => {
    const app = startApp({ storage: { boardTheme: 'blue' } });
    expect(app.boardSelect.value).toBe('blue');
    expect(app.cssVar('--dark-square')).toBe('#8ca2ad');
  });

  test('an unknown saved theme falls back to the default', () => {
    const app = startApp({ storage: { boardTheme: 'toString' } });
    expect(app.boardSelect.value).toBe('classic');
    expect(app.cssVar('--dark-square')).toBe('#b58863');
  });
});

describe('page theme', () => {
  const theme = (app) => app.doc.documentElement.dataset.theme;

  test('is dark by default', () => {
    const app = startApp();
    expect(theme(app)).toBe('dark');
    expect(app.pageSelect.value).toBe('dark');
  });

  test('choosing one applies and remembers it', () => {
    const app = startApp();
    app.choose(app.pageSelect, 'light');
    expect(theme(app)).toBe('light');
    expect(app.stored('pageTheme')).toBe('light');
  });

  test('a saved choice is restored and an unknown one ignored', () => {
    expect(theme(startApp({ storage: { pageTheme: 'auto' } }))).toBe('auto');
    expect(theme(startApp({ storage: { pageTheme: 'neon' } }))).toBe('dark');
  });
});
