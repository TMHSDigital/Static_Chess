const { loadGame } = require('../helpers/load-game');

describe('castling', () => {
  test('an unmoved king is not offered a two-square move over its own piece', () => {
    const g = loadGame();
    g.play('g1f3', 'a7a6');
    expect(g.game.canCastle('w', 'kingside')).toBe(false);
    expect(g.movesFrom('e1')).toEqual([]);
  });

  test('castling is offered once when legal, and moves the rook', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5');
    expect(g.movesFrom('e1')).toEqual(['e2', 'f1', 'g1']);
    g.play('e1g1');
    expect(g.at('g1').type).toBe('k');
    expect(g.at('f1').type).toBe('r');
    expect(g.at('h1')).toBeNull();
    expect(g.game.moveHistory.at(-1).notation).toBe('O-O');
  });

  test('no castling out of check', () => {
    const g = loadGame();
    g.setPosition({ e1: 'wk', h1: 'wr', a1: 'wr', e8: 'br*', a8: 'bk*' });
    expect(g.movesFrom('e1')).not.toContain('g1');
    expect(g.movesFrom('e1')).not.toContain('c1');
  });

  test('no castling through an attacked square', () => {
    const g = loadGame();
    g.setPosition({ e1: 'wk', h1: 'wr', f8: 'br*', a8: 'bk*' });
    expect(g.movesFrom('e1')).not.toContain('g1');
  });

  test('no castling without a rook, or with a rook that has moved', () => {
    const g = loadGame();
    g.setPosition({ e1: 'wk', a1: 'wr*', e8: 'bk*' });
    expect(g.movesFrom('e1')).toEqual(['d1', 'd2', 'e2', 'f1', 'f2']);
  });

  test('a king cannot capture two files away', () => {
    const g = loadGame();
    g.setPosition({ e1: 'wk', g1: 'bn*', e8: 'bk*' });
    expect(g.movesFrom('e1')).not.toContain('g1');
  });

  test('queenside castling is allowed when only the b-file square is attacked', () => {
    const g = loadGame();
    g.setPosition({ e1: 'wk', a1: 'wr', b8: 'br*', e8: 'bk*' });
    expect(g.game.canCastle('w', 'queenside')).toBe(true);
    expect(g.movesFrom('e1')).toContain('c1');
  });

  test('queenside castling is refused when the d-file square is attacked', () => {
    const g = loadGame();
    g.setPosition({ e1: 'wk', a1: 'wr', d8: 'br*', e8: 'bk*' });
    expect(g.game.canCastle('w', 'queenside')).toBe(false);
  });

  test('an unmoved king does not attack squares two files away', () => {
    const g = loadGame();
    // Black king on e8 has never moved; the white king may step to g8.
    g.setPosition({ g7: 'wk*', e8: 'bk' });
    expect(g.movesFrom('g7')).toContain('g8');
  });
});

describe('undo', () => {
  const undoRestores = (setup, lastMove) => {
    const g = loadGame();
    g.play(...setup);
    const before = g.snapshot();
    g.play(lastMove);
    g.game.undoLastMove();
    expect(g.snapshot()).toEqual(before);
    return g;
  };

  test('after a plain move', () => {
    undoRestores(['e2e4', 'e7e5'], 'g1f3');
  });

  test('after a double pawn push, with no stale en passant target', () => {
    const g = undoRestores([], 'e2e4');
    expect(g.game.enPassantTarget).toBeNull();
    expect(g.movesFrom('d2')).toEqual(['d3', 'd4']);
  });

  test('after castling, the rook returns and castling is still available', () => {
    const g = undoRestores(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5'], 'e1g1');
    expect(g.at('h1').type).toBe('r');
    expect(g.at('h1').hasMoved).toBe(false);
    expect(g.at('f1')).toBeNull();
    expect(g.game.canCastle('w', 'kingside')).toBe(true);
  });

  test('after en passant, the captured pawn returns and the capture is still available', () => {
    const g = undoRestores(['e2e4', 'a7a6', 'e4e5', 'd7d5'], 'e5d6');
    expect(g.at('d5').type).toBe('p');
    expect(g.movesFrom('e5')).toContain('d6');
  });

  test('a move that gives up an en passant right gets it back on undo', () => {
    const g = undoRestores(['e2e4', 'a7a6', 'e4e5', 'd7d5'], 'g1f3');
    expect(g.movesFrom('e5')).toContain('d6');
  });

  test('en passant removes the captured pawn', () => {
    const g = loadGame();
    g.play('e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6');
    expect(g.at('d5')).toBeNull();
    expect(g.at('d6').type).toBe('p');
  });
});

describe('selecting by click', () => {
  test('clicking another own piece switches the selection', () => {
    const g = loadGame();
    g.game.handleBoardClick(6, 4);
    g.game.handleBoardClick(6, 3);
    expect(g.board.selectedSquare).toEqual({ row: 6, col: 3 });
    expect(g.board.possibleMoves).toHaveLength(2);
  });

  test('clicking the selected piece again clears the selection', () => {
    const g = loadGame();
    g.game.handleBoardClick(6, 4);
    g.game.handleBoardClick(6, 4);
    expect(g.board.selectedSquare).toBeNull();
  });
});

describe('mouse and touch input with drag and drop enabled', () => {
  const pieceAt = (g, row, col) => g.board.getSquareElement(row, col).querySelector('.piece');
  const mouse = (g, type, target, x = 0, y = 0) =>
    target.dispatchEvent(new g.window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }));
  const clickOn = (g, target) => {
    mouse(g, 'mousedown', target);
    mouse(g, 'mouseup', target);
    mouse(g, 'click', target);
  };

  test('click a piece, then click a highlighted square, moves the piece', () => {
    const g = loadGame({ drag: true });
    clickOn(g, pieceAt(g, 6, 4));
    expect(g.board.selectedSquare).toEqual({ row: 6, col: 4 });
    expect(g.board.getSquareElement(4, 4).classList.contains('possible-move')).toBe(true);

    clickOn(g, g.board.getSquareElement(4, 4));
    expect(g.at('e4').type).toBe('p');
    expect(g.at('e2')).toBeNull();
    expect(g.board.selectedSquare).toBeNull();
  });

  test('a press does not select until the pointer moves', () => {
    const g = loadGame({ drag: true });
    const pawn = pieceAt(g, 6, 4);
    mouse(g, 'mousedown', pawn, 100, 100);
    expect(g.board.selectedSquare).toBeNull();
    expect(pawn.classList.contains('dragging')).toBe(false);

    mouse(g, 'mousemove', g.window.document, 100, 80);
    expect(g.board.selectedSquare).toEqual({ row: 6, col: 4 });
    expect(pawn.classList.contains('dragging')).toBe(true);
  });

  test('dragging onto a legal square moves the piece and leaves nothing selected', () => {
    const g = loadGame({ drag: true });
    const pawn = pieceAt(g, 6, 4);
    g.window.document.elementsFromPoint = () => [g.board.getSquareElement(4, 4)];
    mouse(g, 'mousedown', pawn, 100, 100);
    mouse(g, 'mousemove', g.window.document, 100, 60);
    mouse(g, 'mouseup', g.window.document, 100, 60);

    expect(g.at('e4').type).toBe('p');
    expect(g.board.selectedSquare).toBeNull();
    expect(g.board.possibleMoves).toEqual([]);
    expect(g.window.document.querySelectorAll('.possible-move, .selected')).toHaveLength(0);
  });

  test('dragging onto an illegal square changes nothing and clears the selection', () => {
    const g = loadGame({ drag: true });
    const pawn = pieceAt(g, 6, 4);
    g.window.document.elementsFromPoint = () => [g.board.getSquareElement(2, 4)];
    mouse(g, 'mousedown', pawn, 100, 100);
    mouse(g, 'mousemove', g.window.document, 100, 20);
    mouse(g, 'mouseup', g.window.document, 100, 20);

    expect(g.at('e2').type).toBe('p');
    expect(g.game.moveHistory).toHaveLength(0);
    expect(g.board.selectedSquare).toBeNull();
    expect(pawn.classList.contains('dragging')).toBe(false);
  });

  test('touchstart on the board is not cancelled, so taps still produce clicks', () => {
    const g = loadGame({ drag: true });
    const touchstart = new g.window.Event('touchstart', { bubbles: true, cancelable: true });
    touchstart.touches = [{ clientX: 10, clientY: 10 }];
    pieceAt(g, 6, 4).dispatchEvent(touchstart);
    expect(touchstart.defaultPrevented).toBe(false);

    const onEmpty = new g.window.Event('touchstart', { bubbles: true, cancelable: true });
    onEmpty.touches = [{ clientX: 10, clientY: 10 }];
    g.board.getSquareElement(4, 4).dispatchEvent(onEmpty);
    expect(onEmpty.defaultPrevented).toBe(false);
  });
});
