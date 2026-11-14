const { loadGame } = require('../helpers/load-game');

const el = (g, id) => g.window.document.getElementById(id);
const notations = (g) => g.game.moveHistory.map((move) => move.notation);
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('reading PGN', () => {
  test('drops tags, comments, variations, annotation codes, numbers and the result', () => {
    const g = loadGame();
    const pgn = `[Event "Test"]
[White "A"]

1. e4 {best by test} e5 2. Nf3 $1 (2. f4 exf4 (2... d5)) 2... Nc6 ; a comment to the end of the line
3.Bb5 a6 1/2-1/2`;
    expect(g.game.pgnMoveTokens(pgn)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
  });

  test('an exported game loads back to the same moves and position', () => {
    const first = loadGame();
    first.play('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'e1g1', 'f8c5', 'd2d3', 'e8g8');
    const pgn = first.game.buildPGN();
    const expected = first.snapshot();

    const g = loadGame();
    expect(g.game.importPGN(pgn)).toEqual({ ok: true, moves: 10 });
    expect(g.snapshot()).toEqual(expected);
    expect(notations(g)).toContain('O-O');
  });

  test('en passant, promotion and mate survive the round trip', () => {
    const first = loadGame();
    first.play('e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6', 'a6a5', 'd6c7', 'a5a4');
    first.game.makeMove(1, 2, 0, 1, 'n'); // cxb8=N
    const g = loadGame();
    expect(g.game.importPGN(first.game.buildPGN()).ok).toBe(true);
    expect(notations(g)).toEqual(notations(first));
    expect(g.at('b8')).toMatchObject({ type: 'n', color: 'w' });

    const mate = loadGame();
    expect(mate.game.importPGN('1. f3 e5 2. g4 Qh4# 0-1').ok).toBe(true);
    expect(mate.game.isGameOver).toBe(true);
    expect(mate.game.gameResult).toBe('0-1');
  });

  test('reads moves as other sites write them', () => {
    const g = loadGame();
    const result = g.game.importPGN(
      '1.d4 d5 2.Nf3 Nf6 3.Nbd2 e6 4.e3 Be7 5.Bd3 0-0 6.0-0 c5!? 7.c3 Nc6+'
    );
    expect(result).toEqual({ ok: true, moves: 14 });
    expect(notations(g)[4]).toBe('Nbd2');
    expect(notations(g)[9]).toBe('O-O');
    expect(g.at('g8').type).toBe('k');
    expect(g.at('g1').type).toBe('k');
  });

  test('a promotion without a piece becomes a queen', () => {
    const g = loadGame();
    expect(
      g.rules.findSANMove(
        {
          board: boardWith(g, { e1: 'wk', a7: 'wp', h8: 'bk' }),
          kingPositions: kings(g, 'e1', 'h8'),
          enPassantTarget: null,
        },
        'w',
        'a8'
      ).promotion
    ).toBe('q');
  });

  test('a move that cannot be played is named and the game is kept', () => {
    const g = loadGame();
    g.play('d2d4', 'd7d5');
    const before = g.snapshot();
    const result = g.game.importPGN('1. e4 e5 2. Nf3 Nc6 3. Bb5 Bb4 4. Ke3');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('Move 4. Ke3 cannot be played.');
    expect(g.snapshot()).toEqual(before);

    expect(g.game.importPGN('1. e4 Ke7').error).toBe('Move 1... Ke7 cannot be played.');
    expect(g.game.importPGN('[Event "Empty"]\n\n*').error).toBe('No moves found in the text.');
    expect(g.snapshot()).toEqual(before);
  });

  test('an ambiguous move is refused', () => {
    const g = loadGame();
    // Both knights can go to d2 after these moves
    expect(g.game.importPGN('1. d4 d5 2. Nf3 Nf6 3. Nd2').ok).toBe(false);
  });

  test('undo, the saved game and the move list work after loading', () => {
    const g = loadGame();
    g.game.importPGN('1. e4 e5 2. Nf3');
    expect(g.window.document.querySelectorAll('#move-history button')).toHaveLength(3);
    expect(JSON.parse(g.window.localStorage.getItem('chessGameState')).moveHistory).toHaveLength(3);
    g.game.undoLastMove();
    expect(notations(g)).toEqual(['e4', 'e5']);
    expect(g.at('g1').type).toBe('n');
    g.game.viewMove(1);
    expect(g.game.viewPly).toBe(1);
  });

  test('the computer answers once, after the whole game is in', () => {
    jest.useFakeTimers();
    try {
      const g = loadGame();
      g.game.setOpponent('easy', 'w');
      g.game.importPGN('1. e4 e5 2. Nf3');
      expect(g.game.moveHistory).toHaveLength(3);
      jest.runAllTimers();
      expect(g.game.moveHistory).toHaveLength(4);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('the Load PGN dialog', () => {
  test('opens, loads a game and closes', () => {
    const g = loadGame();
    el(g, 'import-button').click();
    expect(el(g, 'import-dialog').hidden).toBe(false);
    el(g, 'import-text').value = '1. e4 e5';
    el(g, 'import-load').click();
    expect(el(g, 'import-dialog').hidden).toBe(true);
    expect(notations(g)).toEqual(['e4', 'e5']);
    expect(el(g, 'import-text').value).toBe('');
  });

  test('asks before discarding a game in progress', () => {
    const g = loadGame();
    g.play('d2d4');
    el(g, 'import-button').click();
    el(g, 'import-text').value = '1. e4 e5';
    el(g, 'import-load').click();
    expect(el(g, 'import-load').textContent).toBe('Discard current game?');
    expect(notations(g)).toEqual(['d4']);
    el(g, 'import-load').click();
    expect(notations(g)).toEqual(['e4', 'e5']);
  });

  test('shows the error and stays open', () => {
    const g = loadGame();
    el(g, 'import-button').click();
    el(g, 'import-load').click();
    expect(el(g, 'import-error').textContent).toBe('Paste a game in PGN format first.');
    el(g, 'import-text').value = '1. e4 e5 2. Qh7';
    el(g, 'import-load').click();
    expect(el(g, 'import-error').textContent).toBe(
      'Move 2. Qh7 cannot be played. The current game was not changed.'
    );
    expect(el(g, 'import-dialog').hidden).toBe(false);
    expect(g.game.moveHistory).toHaveLength(0);
  });

  test('Cancel and Escape close it without loading', () => {
    const g = loadGame();
    el(g, 'import-button').click();
    el(g, 'import-text').value = '1. e4';
    el(g, 'import-cancel').click();
    expect(el(g, 'import-dialog').hidden).toBe(true);
    el(g, 'import-button').click();
    el(g, 'import-dialog').dispatchEvent(
      new g.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
    expect(el(g, 'import-dialog').hidden).toBe(true);
    expect(g.game.moveHistory).toHaveLength(0);
  });
});

describe('FEN', () => {
  test('the starting position', () => {
    expect(loadGame().game.buildFEN()).toBe(START_FEN);
  });

  test('side to move, en passant square and move number', () => {
    const g = loadGame();
    g.play('e2e4');
    expect(g.game.buildFEN()).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
    g.play('c7c5', 'g1f3');
    expect(g.game.buildFEN()).toBe(
      'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'
    );
  });

  test('castling rights go when the king or a rook moves', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5', 'e1e2', 'h7h5', 'e2e1', 'h8h6');
    expect(g.game.buildFEN().split(' ')[2]).toBe('q');
    const none = loadGame();
    none.play('e2e4', 'e7e5', 'e1e2', 'e8e7');
    expect(none.game.buildFEN().split(' ')[2]).toBe('-');
  });

  test('is the viewed position while looking back', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5');
    g.game.viewMove(0);
    expect(g.game.buildFEN()).toBe(START_FEN);
    g.game.viewMove(1);
    expect(g.game.buildFEN()).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');
  });
});

/** A board with the given pieces, for calling the rules directly. */
function boardWith(g, placement) {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (const [square, code] of Object.entries(placement)) {
    const { row, col } = g.utils.algebraicToCoords(square);
    const piece = new g.pieces.Piece(code[1], code[0]);
    piece.hasMoved = true;
    board[row][col] = piece;
  }
  return board;
}

function kings(g, white, black) {
  return { w: g.utils.algebraicToCoords(white), b: g.utils.algebraicToCoords(black) };
}
