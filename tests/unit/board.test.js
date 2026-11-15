const { loadGame } = require('../helpers/load-game');

const squareNames = (g) =>
  Array.from(g.window.document.querySelectorAll('#chess-board .square')).map((s) =>
    g.utils.coordsToAlgebraic(Number(s.dataset.row), Number(s.dataset.col))
  );

describe('coordinate labels', () => {
  const labels = (g, kind) =>
    Array.from(g.window.document.querySelectorAll(`#chess-board .${kind}`)).map((label) => {
      const square = label.closest('.square');
      return `${square.dataset.row},${square.dataset.col}:${label.textContent}`;
    });

  test('file letters are on the first and eighth ranks, rank numbers on the a- and h-files', () => {
    const g = loadGame();
    const files = 'abcdefgh'.split('');
    expect(labels(g, 'coord-file').sort()).toEqual(
      [...files.map((f, col) => `0,${col}:${f}`), ...files.map((f, col) => `7,${col}:${f}`)].sort()
    );
    const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
    expect(labels(g, 'coord-rank').sort()).toEqual(
      [...ranks.map((n, row) => `${row},0:${n}`), ...ranks.map((n, row) => `${row},7:${n}`)].sort()
    );
    for (const label of g.window.document.querySelectorAll('#chess-board .coord')) {
      expect(label.getAttribute('aria-hidden')).toBe('true');
    }
  });

  test('stay in place through moves, highlights and a flipped board', () => {
    const g = loadGame();
    const count = () => g.window.document.querySelectorAll('#chess-board .coord').length;
    expect(count()).toBe(32);
    g.play('e2e4', 'e7e5', 'e1e2', 'a7a5'); // A piece leaves and reaches labelled squares
    g.game.handleBoardClick(7, 6); // Select the g1 knight: move dots appear
    g.board.setBoardFlipped(true);
    g.board.setBoardFlipped(false);
    expect(count()).toBe(32);
    expect(labels(g, 'coord-file')).toContain('7,4:e');
    expect(g.board.getSquareElement(7, 4).querySelector('.piece')).toBeNull();
    expect(g.board.getSquareElement(6, 4).querySelector('.piece')).not.toBeNull();
  });
});

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

  test('the last move is highlighted from the argument, not from game state', () => {
    const g = loadGame();
    const lastMove = { from: { row: 6, col: 3 }, to: { row: 4, col: 3 } };
    g.board.updateBoardVisuals(g.game.boardState, null, lastMove);
    expect(g.board.getSquareElement(6, 3).classList.contains('last-move-from')).toBe(true);
    expect(g.board.getSquareElement(4, 3).classList.contains('last-move-to')).toBe(true);

    g.board.updateBoardVisuals(g.game.boardState, null, null);
    expect(g.window.document.querySelectorAll('.last-move-from, .last-move-to')).toHaveLength(0);
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
    expect(g.window.document.getElementById('chess-board').classList.contains('flipped')).toBe(
      true
    );
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
      g.window.document.activeElement.dispatchEvent(
        new g.window.KeyboardEvent('keydown', { key, bubbles: true })
      );
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
