const { loadGame } = require('../helpers/load-game');

const squareNames = (g) =>
  Array.from(g.window.document.querySelectorAll('#chess-board .square')).map((s) =>
    g.utils.coordsToAlgebraic(Number(s.dataset.row), Number(s.dataset.col))
  );

describe('board rendering', () => {
  test('64 squares, a8 first and h1 last, with 32 pieces', () => {
    const g = loadGame();
    const names = squareNames(g);
    expect(names).toHaveLength(64);
    expect(names[0]).toBe('a8');
    expect(names[63]).toBe('h1');
    expect(g.window.document.querySelectorAll('.piece')).toHaveLength(32);
  });

  test('selection, possible moves and check are marked on the squares', () => {
    const g = loadGame();
    g.game.handleBoardClick(6, 4);
    expect(g.board.getSquareElement(6, 4).classList.contains('selected')).toBe(true);
    expect(g.board.getSquareElement(5, 4).classList.contains('possible-move')).toBe(true);
    expect(g.board.getSquareElement(4, 4).classList.contains('possible-move')).toBe(true);
    g.game.handleBoardClick(4, 4);
    g.play('f7f6', 'd1h5');
    expect(g.board.getSquareElement(0, 4).classList.contains('in-check')).toBe(true);
  });

  test('squares are labelled for screen readers', () => {
    const g = loadGame();
    expect(g.board.getSquareElement(7, 4).getAttribute('aria-label')).toBe('white king on e1');
    expect(g.board.getSquareElement(4, 4).getAttribute('aria-label')).toBe('e4');
  });
});

describe('flipping the board', () => {
  test('puts h1 first and a8 last, and keeps the pieces', () => {
    const g = loadGame();
    g.board.setBoardFlipped(true);
    const names = squareNames(g);
    expect(names[0]).toBe('h1');
    expect(names[63]).toBe('a8');
    expect(g.window.document.getElementById('chess-board').classList.contains('flipped')).toBe(true);
    expect(g.board.getSquareElement(7, 4).querySelector('.piece.w.k')).not.toBeNull();
  });

  test('flipping back restores the normal order', () => {
    const g = loadGame();
    g.board.setBoardFlipped(true);
    g.board.setBoardFlipped(false);
    expect(squareNames(g)[0]).toBe('a8');
  });

  test('moves still work on a flipped board', () => {
    const g = loadGame();
    g.board.setBoardFlipped(true);
    g.game.handleBoardClick(6, 4);
    g.game.handleBoardClick(4, 4);
    expect(g.at('e4').type).toBe('p');
    expect(g.board.getSquareElement(4, 4).querySelector('.piece')).not.toBeNull();
  });

  test('arrow keys follow the screen: up from e2 goes to e3 normally and e1 when flipped', () => {
    const g = loadGame();
    const press = (key) =>
      g.window.document.activeElement.dispatchEvent(new g.window.KeyboardEvent('keydown', { key, bubbles: true }));
    const focused = () => {
      const el = g.window.document.activeElement;
      return g.utils.coordsToAlgebraic(Number(el.dataset.row), Number(el.dataset.col));
    };

    g.board.getSquareElement(6, 4).focus();
    press('ArrowUp');
    expect(focused()).toBe('e3');

    g.board.setBoardFlipped(true);
    g.board.getSquareElement(6, 4).focus();
    press('ArrowUp');
    expect(focused()).toBe('e1');
    press('ArrowLeft');
    expect(focused()).toBe('f1');
  });
});
