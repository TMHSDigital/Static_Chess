const { loadGame } = require('../helpers/load-game');

const TOGGLES = [
  'coords-toggle',
  'possible-moves-toggle',
  'last-move-toggle',
  'sound-toggle',
  'flip-toggle',
];

/**
 * Starts the app the way the page does: the game modules are loaded, the
 * settings toggles are on the page, and main.js runs on DOMContentLoaded.
 */
function startApp(options = {}) {
  const g = loadGame(options);
  const doc = g.window.document;
  if (options.hash) g.window.location.hash = options.hash;
  for (const id of TOGGLES) {
    const input = doc.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    doc.body.appendChild(input);
  }
  Object.assign(global, {
    initializeGame: g.game.initializeGame,
    setBoardFlipped: g.board.setBoardFlipped,
  });
  require('../../js/main');
  doc.dispatchEvent(new g.window.Event('DOMContentLoaded'));

  const toggle = (id) => doc.getElementById(id);
  const flip = (id) => {
    const input = toggle(id);
    input.checked = !input.checked;
    input.dispatchEvent(new g.window.Event('change'));
  };
  const cssVar = (name) => doc.documentElement.style.getPropertyValue(name);
  const stored = (key) => g.window.localStorage.getItem(key);
  const boardIsFlipped = () => doc.getElementById('chess-board').classList.contains('flipped');
  return { ...g, doc, toggle, flip, cssVar, stored, boardIsFlipped };
}

describe('settings', () => {
  test('start from the documented defaults when nothing is saved', () => {
    const app = startApp();
    expect(app.toggle('coords-toggle').checked).toBe(false);
    expect(app.toggle('possible-moves-toggle').checked).toBe(true);
    expect(app.toggle('last-move-toggle').checked).toBe(true);
    expect(app.toggle('sound-toggle').checked).toBe(false);
    expect(app.toggle('flip-toggle').checked).toBe(false);

    expect(app.doc.body.classList.contains('coords-visible')).toBe(false);
    expect(app.cssVar('--show-possible-moves')).toBe('block');
    expect(app.cssVar('--show-last-move')).toBe('block');
    expect(global.CONFIG.FEATURES.SOUND_EFFECTS).toBe(false);
    expect(app.boardIsFlipped()).toBe(false);
  });

  test('are restored from storage', () => {
    const app = startApp({
      storage: {
        showCoords: 'true',
        showPossibleMoves: 'false',
        showLastMove: 'false',
        enableSounds: 'true',
        flipBoard: 'true',
      },
    });
    expect(app.toggle('coords-toggle').checked).toBe(true);
    expect(app.doc.body.classList.contains('coords-visible')).toBe(true);
    expect(app.toggle('possible-moves-toggle').checked).toBe(false);
    expect(app.cssVar('--show-possible-moves')).toBe('none');
    expect(app.toggle('last-move-toggle').checked).toBe(false);
    expect(app.cssVar('--show-last-move')).toBe('none');
    expect(app.toggle('sound-toggle').checked).toBe(true);
    expect(global.CONFIG.FEATURES.SOUND_EFFECTS).toBe(true);
    expect(app.toggle('flip-toggle').checked).toBe(true);
    expect(app.boardIsFlipped()).toBe(true);
  });

  test('each toggle applies its setting and saves it under its key', () => {
    const app = startApp();

    app.flip('coords-toggle');
    expect(app.doc.body.classList.contains('coords-visible')).toBe(true);
    expect(app.stored('showCoords')).toBe('true');
    app.flip('coords-toggle');
    expect(app.doc.body.classList.contains('coords-visible')).toBe(false);
    expect(app.stored('showCoords')).toBe('false');

    app.flip('possible-moves-toggle');
    expect(app.cssVar('--show-possible-moves')).toBe('none');
    expect(app.stored('showPossibleMoves')).toBe('false');

    app.flip('last-move-toggle');
    expect(app.cssVar('--show-last-move')).toBe('none');
    expect(app.stored('showLastMove')).toBe('false');

    app.flip('sound-toggle');
    expect(global.CONFIG.FEATURES.SOUND_EFFECTS).toBe(true);
    expect(app.stored('enableSounds')).toBe('true');

    app.flip('flip-toggle');
    expect(app.boardIsFlipped()).toBe(true);
    expect(app.stored('flipBoard')).toBe('true');
  });

  test('still work for the visit when storage is blocked', () => {
    const app = startApp({ brokenStorage: true });
    expect(app.toggle('possible-moves-toggle').checked).toBe(true);
    expect(() => app.flip('coords-toggle')).not.toThrow();
    expect(app.doc.body.classList.contains('coords-visible')).toBe(true);
    expect(() => app.flip('flip-toggle')).not.toThrow();
    expect(app.boardIsFlipped()).toBe(true);
  });
});

describe('the start of the page', () => {
  test('the clock setting is hidden when the clock is switched off', () => {
    const app = startApp({ configure: (config) => (config.FEATURES.GAME_TIMER = false) });
    expect(app.toggle('clock-setting').hidden).toBe(true);
    expect(app.toggle('clock-select').options).toHaveLength(0);
  });

  test('a clock chosen is saved and used from the next game', () => {
    const app = startApp();
    const select = app.toggle('clock-select');
    select.value = '5+0';
    select.dispatchEvent(new app.window.Event('change'));
    expect(app.stored('timeControl')).toBe('5+0');
    app.game.resetGame();
    expect(app.game.clock.base).toBe(300000);
  });

  test('the opponent settings are hidden when the computer opponent is switched off', () => {
    const app = startApp({ configure: (config) => (config.FEATURES.AI_OPPONENT = false) });
    expect(app.toggle('opponent-setting').hidden).toBe(true);
    expect(app.toggle('side-setting').hidden).toBe(true);
  });

  test('a shared link is loaded, and the address forgets it', () => {
    const app = startApp({ hash: '#pgn=1.%20e4%20e5%20*' });
    expect(app.game.moveHistory.map((move) => move.notation)).toEqual(['e4', 'e5']);
    expect(app.window.location.hash).toBe('');
  });

  describe('offline support', () => {
    const saved = {};
    beforeEach(() => {
      for (const name of ['navigator', 'location']) {
        saved[name] = Object.getOwnPropertyDescriptor(global, name);
      }
    });
    afterEach(() => {
      for (const [name, descriptor] of Object.entries(saved)) {
        if (descriptor) Object.defineProperty(global, name, descriptor);
        else delete global[name];
      }
    });
    /** Starts the page as if served from protocol, with a service worker register() that does what it is told. */
    const startServed = (protocol, register) => {
      Object.defineProperty(global, 'navigator', {
        value: { serviceWorker: { register } },
        configurable: true,
        writable: true,
      });
      Object.defineProperty(global, 'location', {
        value: { protocol },
        configurable: true,
        writable: true,
      });
      return startApp();
    };

    test('the service worker is registered on a page served over http(s)', () => {
      const register = jest.fn(() => Promise.resolve());
      startServed('https:', register);
      expect(register).toHaveBeenCalledWith('sw.js');
    });

    test('a page opened from a file registers none', () => {
      const register = jest.fn(() => Promise.resolve());
      startServed('file:', register);
      expect(register).not.toHaveBeenCalled();
    });

    test('a refused registration does not stop the page', async () => {
      const register = jest.fn(() => Promise.reject(new Error('refused')));
      const app = startServed('http:', register);
      await Promise.resolve();
      await Promise.resolve();
      expect(register).toHaveBeenCalled();
      expect(app.game.moveHistory).toEqual([]);
    });
  });
});

describe('clicks on the board', () => {
  const clickOn = (g, element) =>
    element.dispatchEvent(new g.window.MouseEvent('click', { bubbles: true }));

  test('a click on a piece selects the square it stands on', () => {
    const g = loadGame();
    clickOn(g, g.board.getSquareElement(6, 4).querySelector('.piece'));
    expect(g.board.selectedSquare).toEqual({ row: 6, col: 4 });
    expect(g.board.getSquareElement(6, 4).classList.contains('selected')).toBe(true);

    clickOn(g, g.board.getSquareElement(4, 4));
    expect(g.at('e4').type).toBe('p');
    expect(g.board.selectedSquare).toBeNull();
  });

  test('the click that follows a drop is ignored, and a plain tap still selects', () => {
    jest.useFakeTimers();
    try {
      const g = loadGame({ drag: true });
      const mouse = (type, target, y) =>
        target.dispatchEvent(
          new g.window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientY: y })
        );
      g.window.document.elementsFromPoint = () => [g.board.getSquareElement(4, 4)];
      mouse('mousedown', g.board.getSquareElement(6, 4).querySelector('.piece'), 100);
      mouse('mousemove', g.window.document, 60);
      mouse('mouseup', g.window.document, 60);
      expect(g.game.moveHistory).toHaveLength(1); // The drop made the move
      clickOn(g, g.board.getSquareElement(4, 4).querySelector('.piece'));
      expect(g.board.selectedSquare).toBeNull(); // It did not also make a click

      jest.advanceTimersByTime(global.CONFIG.DRAG_CLICK_GUARD_MS);
      clickOn(g, g.board.getSquareElement(1, 3).querySelector('.piece'));
      expect(g.board.selectedSquare).toEqual({ row: 1, col: 3 });
    } finally {
      jest.useRealTimers();
    }
  });
});
