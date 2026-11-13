const { loadGame } = require('../helpers/load-game');

const TOGGLES = ['coords-toggle', 'possible-moves-toggle', 'last-move-toggle', 'sound-toggle', 'flip-toggle'];

/**
 * Starts the app the way the page does: the game modules are loaded, the
 * settings toggles are on the page, and main.js runs on DOMContentLoaded.
 */
function startApp(options = {}) {
  const g = loadGame(options);
  const doc = g.window.document;
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

  test('the click that follows a drag is ignored', () => {
    const g = loadGame();
    g.window.dragJustEnded = true;
    clickOn(g, g.board.getSquareElement(6, 4).querySelector('.piece'));
    expect(g.board.selectedSquare).toBeNull();

    g.window.dragJustEnded = false;
    clickOn(g, g.board.getSquareElement(6, 4).querySelector('.piece'));
    expect(g.board.selectedSquare).toEqual({ row: 6, col: 4 });
  });
});
