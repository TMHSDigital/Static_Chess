const { loadGame } = require('../helpers/load-game');

/** Starts the app with the two theme selectors on the page, as index.html has them. */
function startApp(options = {}) {
  const g = loadGame(options);
  const doc = g.window.document;
  const boardSelect = doc.createElement('select');
  boardSelect.id = 'board-theme-select';
  const pageSelect = doc.createElement('select');
  pageSelect.id = 'page-theme-select';
  for (const value of ['dark', 'light', 'auto']) {
    const option = doc.createElement('option');
    option.value = value;
    pageSelect.appendChild(option);
  }
  doc.body.append(boardSelect, pageSelect);
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
