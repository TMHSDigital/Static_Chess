const { loadGame } = require('../helpers/load-game');

describe('game core', () => {
  test('can make a legal opening move', () => {
    const g = loadGame();
    g.game.handleBoardClick(6, 4);
    expect(g.movesFrom('e2')).toContain('e4');
  });

  test('each load is independent of the one before', () => {
    const first = loadGame();
    first.play('e2e4');
    const second = loadGame({ storage: {} });
    second.window.localStorage.clear();
    expect(second.game).not.toBe(first.game);
    expect(second.window).not.toBe(first.window);
    expect(first.game.moveHistory).toHaveLength(1);
  });

  test('a fresh load starts from the opening position', () => {
    loadGame().play('e2e4', 'e7e5');
    const g = loadGame();
    expect(g.game.moveHistory).toHaveLength(0);
    expect(g.game.currentPlayer).toBe('w');
    expect(g.at('e2').type).toBe('p');
    expect(g.window.document.querySelectorAll('.piece')).toHaveLength(32);
  });
});

describe('legal move generation', () => {
  test('20 legal moves for each side from the opening position', () => {
    const g = loadGame();
    expect(g.game.generateAllLegalMoves('w')).toHaveLength(20);
    g.play('e2e4');
    expect(g.game.generateAllLegalMoves('b')).toHaveLength(20);
  });

  test('sliding pieces are blocked by their own pieces', () => {
    const g = loadGame();
    expect(g.movesFrom('a1')).toEqual([]);
    expect(g.movesFrom('c1')).toEqual([]);
    expect(g.movesFrom('d1')).toEqual([]);
  });

  test('a sliding piece can capture the first enemy piece but not pass it', () => {
    const g = loadGame();
    g.setPosition({ e1: 'wk*', a1: 'wr*', a5: 'bp*', a7: 'bp*', h8: 'bk*' });
    expect(g.movesFrom('a1')).toEqual(['a2', 'a3', 'a4', 'a5', 'b1', 'c1', 'd1']);
  });

  test('a pinned piece may only move along the pin', () => {
    const g = loadGame();
    g.setPosition({ e1: 'wk*', e2: 'wr*', e8: 'br*', a8: 'bk*' });
    expect(g.movesFrom('e2')).toEqual(['e3', 'e4', 'e5', 'e6', 'e7', 'e8']);
  });

  test('in check, only moves that resolve it are legal', () => {
    const g = loadGame();
    g.setPosition({ e1: 'wk*', c3: 'wn*', h2: 'wp', e8: 'br*', a8: 'bk*' });
    expect(g.movesFrom('c3')).toEqual(['e2', 'e4']);
    expect(g.movesFrom('h2')).toEqual([]);
  });

  test('a pawn cannot push onto or through an occupied square', () => {
    const g = loadGame();
    g.setPosition({ e1: 'wk*', a2: 'wp', a3: 'bn*', b2: 'wp', b4: 'bn*', h8: 'bk*' });
    expect(g.movesFrom('a2')).toEqual([]);
    expect(g.movesFrom('b2')).toEqual(['a3', 'b3']);
  });

  test('en passant is only available on the move right after the double push', () => {
    const g = loadGame();
    g.play('e2e4', 'a7a6', 'e4e5', 'd7d5', 'h2h3', 'a6a5');
    expect(g.movesFrom('e5')).toEqual(['e6']);
  });

  test('en passant is not offered when it would expose the king', () => {
    const g = loadGame();
    // White king and pawn share the fifth rank with a black rook behind the black pawn
    g.setPosition({ a5: 'wk*', d5: 'wp*', e7: 'bp', h5: 'br*', h8: 'bk*', g2: 'wp' });
    g.play('g2g3', 'e7e5');
    expect(g.game.enPassantTarget).toEqual({ row: 2, col: 4 });
    expect(g.movesFrom('d5')).toEqual(['d6']);
  });
});

describe('game end', () => {
  test("fool's mate is checkmate", () => {
    const g = loadGame();
    g.play('f2f3', 'e7e5', 'g2g4', 'd8h4');
    expect(g.game.isGameOver).toBe(true);
    expect(g.game.moveHistory.at(-1).notation).toBe('Qh4#');
    expect(g.window.document.getElementById('game-status').textContent).toBe(
      'Checkmate! Black wins.'
    );
  });

  test('clicks are ignored after the game is over', () => {
    const g = loadGame();
    g.play('f2f3', 'e7e5', 'g2g4', 'd8h4');
    g.game.handleBoardClick(6, 4);
    expect(g.board.selectedSquare).toBeNull();
  });

  test('no legal moves without check is stalemate', () => {
    const g = loadGame();
    g.setPosition({ f7: 'wk*', g5: 'wq*', h8: 'bk*' });
    g.play('g5g6');
    expect(g.game.isGameOver).toBe(true);
    expect(g.game.moveHistory.at(-1).isStalemate).toBe(true);
    expect(g.window.document.getElementById('game-status').textContent).toBe(
      'Stalemate! Game is a draw.'
    );
  });

  test('a check that can be answered is not the end of the game', () => {
    const g = loadGame();
    g.play('e2e4', 'f7f6', 'd1h5');
    expect(g.game.isGameOver).toBe(false);
    expect(g.game.moveHistory.at(-1).notation).toBe('Qh5+');
    expect(g.movesFrom('g7')).toEqual(['g6']);
  });
});

describe('promotion and notation', () => {
  test('a pawn reaching the last rank becomes a queen', () => {
    const g = loadGame();
    g.setPosition({ e1: 'wk*', h7: 'wp*', a7: 'bk*' });
    g.play('h7h8');
    expect(g.at('h8').type).toBe('q');
    expect(g.game.moveHistory.at(-1).notation).toBe('h8=Q');
  });

  test('captures, and pawn captures with the file', () => {
    const g = loadGame();
    g.play('e2e4', 'd7d5', 'e4d5', 'd8d5');
    expect(g.game.moveHistory.map((m) => m.notation)).toEqual(['e4', 'd5', 'exd5', 'Qxd5']);
  });

  test('two knights that reach the same square are told apart by file', () => {
    const g = loadGame();
    g.play('g1f3', 'a7a6', 'd2d4', 'a6a5', 'b1d2');
    expect(g.game.moveHistory.at(-1).notation).toBe('Nbd2');
  });

  test('two rooks on one file are told apart by rank', () => {
    const g = loadGame();
    g.setPosition({ e1: 'wk*', a1: 'wr*', a5: 'wr*', h8: 'bk*' });
    g.play('a1a3');
    expect(g.game.moveHistory.at(-1).notation).toBe('R1a3');
  });

  test('disambiguation considers every other piece, not only the last one found', () => {
    const g = loadGame();
    g.setPosition({ e1: 'wk*', a1: 'wr*', a5: 'wr*', h3: 'wr*', g8: 'bk*' });
    g.play('a1a3');
    expect(g.game.moveHistory.at(-1).notation).toBe('R1a3');
  });

  test('a piece on a different file and rank needs only the file', () => {
    const g = loadGame();
    g.setPosition({ e1: 'wk*', a1: 'wr*', h3: 'wr*', g8: 'bk*' });
    g.play('a1a3');
    expect(g.game.moveHistory.at(-1).notation).toBe('Raa3');
  });
});

describe('clicking', () => {
  test("the opponent's pieces cannot be selected", () => {
    const g = loadGame();
    g.game.handleBoardClick(1, 4);
    expect(g.board.selectedSquare).toBeNull();
  });
});
