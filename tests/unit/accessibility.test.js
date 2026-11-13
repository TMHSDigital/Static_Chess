const { loadGame } = require('../helpers/load-game');

const doc = (g) => g.window.document;
const label = (g, square) => {
  const { row, col } = g.utils.algebraicToCoords(square);
  return g.board.getSquareElement(row, col).getAttribute('aria-label');
};
const click = (g, square) => {
  const { row, col } = g.utils.algebraicToCoords(square);
  g.game.handleBoardClick(row, col);
};
const announced = (g) => doc(g).getElementById('announcer').textContent;

describe('board structure', () => {
  test('eight rows of eight cells', () => {
    const g = loadGame();
    const rows = Array.from(doc(g).querySelectorAll('#chess-board > [role="row"]'));
    expect(rows).toHaveLength(8);
    for (const row of rows) {
      expect(row.querySelectorAll(':scope > [role="gridcell"]')).toHaveLength(8);
    }
  });

  test('rows and cells are both reversed on a flipped board', () => {
    const g = loadGame();
    g.board.setBoardFlipped(true);
    const rows = Array.from(doc(g).querySelectorAll('#chess-board > [role="row"]'));
    expect(rows.map((r) => r.dataset.row)).toEqual(['7', '6', '5', '4', '3', '2', '1', '0']);
    expect(Array.from(rows[0].children).map((s) => s.dataset.col)).toEqual([
      '7',
      '6',
      '5',
      '4',
      '3',
      '2',
      '1',
      '0',
    ]);
  });
});

describe('tab order', () => {
  const tabStops = (g) => Array.from(doc(g).querySelectorAll('#chess-board .square[tabindex="0"]'));

  test('exactly one square is a tab stop', () => {
    const g = loadGame();
    expect(tabStops(g)).toHaveLength(1);
    expect(doc(g).querySelectorAll('#chess-board .square[tabindex="-1"]')).toHaveLength(63);
  });

  test('the tab stop follows the focused square', () => {
    const g = loadGame();
    const e2 = g.board.getSquareElement(6, 4);
    e2.focus();
    expect(tabStops(g)).toEqual([e2]);

    e2.dispatchEvent(new g.window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(tabStops(g)).toEqual([g.board.getSquareElement(5, 4)]);
    expect(doc(g).activeElement).toBe(g.board.getSquareElement(5, 4));
  });

  test('there is still one tab stop after the board is flipped and after a new game', () => {
    const g = loadGame();
    g.board.setBoardFlipped(true);
    g.play('e2e4');
    g.game.resetGame();
    expect(tabStops(g)).toHaveLength(1);
  });
});

describe('square labels', () => {
  test('name the piece in words', () => {
    const g = loadGame();
    expect(label(g, 'd8')).toBe('black queen on d8');
    expect(label(g, 'g1')).toBe('white knight on g1');
  });

  test('say which square is selected and where it can go', () => {
    const g = loadGame();
    click(g, 'e2');
    expect(label(g, 'e2')).toBe('white pawn on e2, selected');
    expect(g.board.getSquareElement(6, 4).getAttribute('aria-selected')).toBe('true');
    expect(label(g, 'e3')).toBe('e3, legal move');
    expect(label(g, 'e4')).toBe('e4, legal move');
    expect(label(g, 'e5')).toBe('e5');

    click(g, 'e4');
    expect(label(g, 'e2')).toBe('e2');
    expect(label(g, 'e3')).toBe('e3');
    expect(label(g, 'e4')).toBe('white pawn on e4');
    expect(g.board.getSquareElement(6, 4).hasAttribute('aria-selected')).toBe(false);
  });

  test('mark a king that is in check', () => {
    const g = loadGame();
    g.play('e2e4', 'f7f6', 'd1h5');
    expect(label(g, 'e8')).toBe('black king on e8, in check');
  });
});

describe('announcements', () => {
  test('a quiet move, then a capture', () => {
    const g = loadGame();
    g.play('e2e4');
    expect(announced(g)).toBe("White pawn to e4. Black's turn");
    g.play('d7d5', 'e4d5');
    expect(announced(g)).toBe("White pawn takes on d5. Black's turn");
  });

  test('check and checkmate', () => {
    const g = loadGame();
    g.play('e2e4', 'f7f6', 'd1h5');
    expect(announced(g)).toBe("White queen to h5. Check. Black's turn");

    const mate = loadGame();
    mate.play('f2f3', 'e7e5', 'g2g4', 'd8h4');
    expect(announced(mate)).toBe('Black queen to h4. Checkmate! Black wins.');
  });

  test('castling, en passant and promotion', () => {
    const castle = loadGame();
    castle.play('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'e1g1');
    expect(announced(castle)).toBe("White castles kingside. Black's turn");

    const ep = loadGame();
    ep.play('e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6');
    expect(announced(ep)).toBe("White pawn takes on d6 en passant. Black's turn");

    const promo = loadGame();
    promo.setPosition({ e1: 'wk*', h6: 'bk*', b7: 'wp*', a8: 'br*' });
    promo.game.makeMove(1, 1, 0, 1, 'n');
    expect(announced(promo)).toBe("White pawn to b8, promotes to knight. Black's turn");
  });

  test('undo and New Game', () => {
    const g = loadGame();
    g.play('e2e4');
    g.game.undoLastMove();
    expect(announced(g)).toBe("Move taken back. White's turn");
    g.game.handleResetClick();
    expect(announced(g)).toBe("New game. White's turn");
  });

  test('the visible status line is unchanged', () => {
    const g = loadGame();
    g.play('e2e4');
    expect(doc(g).getElementById('game-status').textContent).toBe("Black's turn");
  });
});
