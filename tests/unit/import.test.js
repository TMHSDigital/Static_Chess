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

  test('a game with a pinned twin piece survives the round trip', () => {
    const first = loadGame();
    first.play('d2d4', 'e7e6', 'b1c3', 'f8b4', 'g1h3', 'd7d6', 'h3g5', 'h7h6', 'g5e4');
    const pgn = first.game.buildPGN();
    expect(pgn).toContain('5. Ne4');

    const g = loadGame();
    expect(g.game.importPGN(pgn)).toEqual({ ok: true, moves: 9 });
    expect(notations(g)).toEqual(notations(first));
    expect(g.game.moveHistory.at(-1).notation).toBe('Ne4');
  });

  test('a loaded game has no clock, whatever time control is selected', () => {
    jest.useFakeTimers(); // A clock would otherwise tick on after the test
    try {
      const g = loadGame();
      g.game.setTimeControl('15+10');
      g.game.resetGame();
      expect(g.game.clock).not.toBeNull();

      const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7';
      expect(g.game.importPGN(pgn)).toEqual({ ok: true, moves: 10 });
      expect(g.game.clock).toBeNull();
      expect(el(g, 'clock-white').hidden).toBe(true);
      expect(el(g, 'undo-button').disabled).toBe(false);

      g.game.resetGame(); // The next new game is timed again
      expect(g.game.clock.remaining).toEqual({ w: 900000, b: 900000 });
    } finally {
      jest.useRealTimers();
    }
  });

  test('a game that played on through a threefold repetition loads in full and is still running', () => {
    const g = loadGame();
    const repeated = '1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8';
    expect(g.game.importPGN(`${repeated} 5. e4 e5`)).toEqual({ ok: true, moves: 10 });
    expect(g.game.isGameOver).toBe(false);
    expect(g.game.gameResult).toBeNull();
    expect(el(g, 'game-status').textContent).toBe("White's turn");
    expect(g.at('e4').type).toBe('p');
    g.play('g1f3');
    expect(notations(g)).toHaveLength(11);

    const drawn = loadGame(); // The same game stopped at the repetition is a draw
    expect(drawn.game.importPGN(repeated)).toEqual({ ok: true, moves: 8 });
    expect(drawn.game.isGameOver).toBe(true);
    expect(drawn.game.gameResult).toBe('1/2-1/2');
    expect(el(drawn, 'game-status').textContent).toBe('Draw by threefold repetition.');
  });

  test('no move is added to a finished game', () => {
    const g = loadGame();
    g.play('f2f3', 'e7e5', 'g2g4', 'd8h4');
    expect(g.game.isGameOver).toBe(true);
    g.game.makeMove(6, 0, 5, 0); // a3
    expect(notations(g)).toHaveLength(4);
    expect(g.at('a2').type).toBe('p');
  });

  describe('the result of a loaded game', () => {
    const status = (g) => el(g, 'game-status').textContent;

    test('a resigned game comes back resigned, and Undo reopens it', () => {
      const first = loadGame();
      first.play('e2e4', 'e7e5');
      first.game.resign();
      const pgn = first.game.buildPGN();
      expect(pgn).toContain('{White resigned. Black wins.} 0-1');

      const g = loadGame();
      expect(g.game.importPGN(pgn)).toEqual({ ok: true, moves: 2 });
      expect(g.game.isGameOver).toBe(true);
      expect(g.game.gameResult).toBe('0-1');
      expect(status(g)).toBe('White resigned. Black wins.');
      expect(g.game.isBoardLocked()).toBe(true);
      expect(g.game.buildPGN()).toContain('{White resigned. Black wins.} 0-1');

      g.game.undoLastMove();
      expect(g.game.isGameOver).toBe(false);
      expect(notations(g)).toEqual(['e4', 'e5']);
      expect(status(g)).toBe("White's turn");
    });

    test('a draw by agreement and a loss on time keep their wording', () => {
      const first = loadGame();
      first.play('e2e4', 'e7e5');
      first.game.handleDrawClick(); // Offer
      first.game.handleDrawClick(); // Accept
      expect(first.game.currentStatus).toBe('Draw by agreement.');

      const drawn = loadGame();
      drawn.game.importPGN(first.game.buildPGN());
      expect(drawn.game.gameResult).toBe('1/2-1/2');
      expect(status(drawn)).toBe('Draw by agreement.');

      const timed = loadGame();
      timed.game.importPGN(`[TimeControl "300+0"]

1. e4 e5 {White ran out of time. Black wins.} 0-1`);
      expect(timed.game.gameResult).toBe('0-1');
      expect(status(timed)).toBe('White ran out of time. Black wins.');
    });

    test('a result from elsewhere is stated plainly, from the moves or the Result tag', () => {
      const g = loadGame();
      g.game.importPGN('1. e4 e5 2. Nf3 {Black lost on time} 1-0');
      expect(g.game.gameResult).toBe('1-0');
      expect(status(g)).toBe('White won (result from the loaded game).');

      const tagged = loadGame();
      tagged.game.importPGN('[Result "1/2-1/2"]\n\n1. e4 e5');
      expect(tagged.game.gameResult).toBe('1/2-1/2');
      expect(status(tagged)).toBe('Draw (result from the loaded game).');
    });

    test('a game marked * or without a result is still in progress', () => {
      for (const pgn of ['1. e4 e5 *', '1. e4 e5', '[Result "*"]\n\n1. e4 e5']) {
        const g = loadGame();
        expect(g.game.importPGN(pgn).ok).toBe(true);
        expect(g.game.isGameOver).toBe(false);
        expect(g.game.gameResult).toBeNull();
        expect(status(g)).toBe("White's turn");
      }
      // The movetext wins over a tag that disagrees
      expect(loadGame().game.pgnResult('[Result "1-0"]\n\n1. e4 e5 *')).toBeNull();
    });

    test('a result the moves already show is left alone', () => {
      const g = loadGame();
      g.game.importPGN('1. f3 e5 2. g4 Qh4# 0-1');
      expect(status(g)).toBe('Checkmate! Black wins.');
      g.game.undoLastMove(); // Takes back the mating move, not a result on its own
      expect(notations(g)).toEqual(['f3', 'e5', 'g4']);
    });

    test('the computer does not move after a finished game is loaded', () => {
      jest.useFakeTimers();
      try {
        const g = loadGame();
        g.game.setOpponent('easy', 'w');
        g.game.importPGN('1. e4 {White resigned. Black wins.} 0-1');
        jest.runAllTimers();
        expect(notations(g)).toEqual(['e4']);
        expect(g.game.isGameOver).toBe(true);
      } finally {
        jest.useRealTimers();
      }
    });

    test('of several games in the text, the first is loaded', () => {
      const g = loadGame();
      const pgn = `[Event "One"]
[Result "1-0"]

1. e4 e5 2. Nf3 1-0

[Event "Two"]
[Result "0-1"]

1. d4 d5 0-1`;
      expect(g.game.importPGN(pgn)).toEqual({ ok: true, moves: 3 });
      expect(notations(g)).toEqual(['e4', 'e5', 'Nf3']);
      expect(g.game.gameResult).toBe('1-0');
    });
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

  test('validates an invalid PGN before asking to discard a game', () => {
    const g = loadGame();
    g.play('d2d4');
    el(g, 'import-button').click();
    el(g, 'import-text').value = '1. e4 e5 2. Qh7';
    el(g, 'import-load').click();
    expect(el(g, 'import-error').textContent).toContain('Move 2. Qh7 cannot be played.');
    expect(el(g, 'import-load').textContent).toBe('Load game');
    expect(notations(g)).toEqual(['d4']);
    expect(el(g, 'import-dialog').hidden).toBe(false);
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

describe('move numbers', () => {
  const movetext = (g) => g.game.buildPGN().trim().split('\n').pop();
  const rows = (g) =>
    Array.from(g.window.document.querySelectorAll('#move-history li')).map((row) =>
      Array.from(row.children)
        .map((child) => child.textContent)
        .join(' ')
    );

  test('FEN and PGN after 0, 1 and 2 moves, and while looking back', () => {
    const g = loadGame();
    expect(g.game.buildFEN()).toBe(START_FEN);
    expect(movetext(g)).toBe('*');

    g.play('e2e4');
    const afterOne = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    expect(g.game.buildFEN()).toBe(afterOne);
    expect(movetext(g)).toBe('1. e4 *');
    expect(rows(g)).toEqual(['1. e4']);

    g.play('g8f6');
    const afterTwo = 'rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2';
    expect(g.game.buildFEN()).toBe(afterTwo);
    expect(movetext(g)).toBe('1. e4 Nf6 *');
    expect(rows(g)).toEqual(['1. e4 Nf6']);

    g.game.viewMove(0);
    expect(g.game.buildFEN()).toBe(START_FEN);
    g.game.viewMove(1);
    expect(g.game.buildFEN()).toBe(afterOne);
    expect(el(g, 'game-status').textContent).toBe('Viewing 1. e4');
    expect(movetext(g)).toBe('1. e4 Nf6 *'); // The export is the whole game, whatever is on screen
    g.game.viewMove(2);
    expect(g.game.buildFEN()).toBe(afterTwo);

    g.play('e4e5');
    g.game.viewMove(2);
    expect(el(g, 'game-status').textContent).toBe('Viewing 1... Nf6');
    expect(rows(g)).toEqual(['1. e4 Nf6', '2. e5']);
    expect(g.game.buildPGN()).not.toContain('[FEN');
    expect(g.game.importPGN('1. e4 e5 2. Ke3', true).error).toBe('Move 2. Ke3 cannot be played.');
    expect(g.game.importPGN('1. e4 Ke7', true).error).toBe('Move 1... Ke7 cannot be played.');
  });

  test('a game that starts with Black to move is numbered from its first move', () => {
    const g = loadGame();
    g.setPosition({ e1: 'wk*', e8: 'bk*', a7: 'bp', h2: 'wp' }, 'b');
    expect(g.game.currentPlayer).toBe('b');
    expect(g.game.currentStatus).toBe("Black's turn");
    expect(g.game.buildFEN()).toBe('4k3/p7/8/8/8/8/7P/4K3 b - - 0 1');

    g.play('a7a5', 'h2h4', 'a5a4');
    expect(g.game.buildFEN()).toBe('4k3/8/8/8/p6P/8/8/4K3 w - - 0 3');
    expect(rows(g)).toEqual(['1. ... a5', '2. h4 a4']);
    expect(movetext(g)).toBe('1... a5 2. h4 a4 *');
    expect(g.game.buildPGN()).toContain('[SetUp "1"]\n[FEN "4k3/p7/8/8/8/8/7P/4K3 b - - 0 1"]');
    g.game.viewMove(1);
    expect(el(g, 'game-status').textContent).toBe('Viewing 1... a5');
    g.game.viewMove(2);
    expect(el(g, 'game-status').textContent).toBe('Viewing 2. h4');
  });

  test('the half-move clock and move number of the start carry through', () => {
    const g = loadGame();
    const position = g.rules.initialPosition();
    g.game.startGameFrom(position, 'w', 12, 30);
    expect(g.game.buildFEN()).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 12 30');
    g.play('g1f3');
    expect(g.game.buildFEN().split(' ').slice(4)).toEqual(['13', '30']);
    expect(movetext(g)).toBe('30. Nf3 *');
    g.play('g8f6');
    expect(g.game.buildFEN().split(' ').slice(4)).toEqual(['14', '31']);
  });

  test('how the game began is saved with it', () => {
    const first = loadGame();
    first.setPosition({ e1: 'wk*', e8: 'bk*', a7: 'bp', h2: 'wp' }, 'b');
    first.play('a7a5', 'h2h4');
    const key = 'chessGameState';
    const saved = first.window.localStorage.getItem(key);

    const second = loadGame({ storage: { [key]: saved } });
    expect(rows(second)).toEqual(['1. ... a5', '2. h4']);
    expect(second.game.buildPGN()).toBe(first.game.buildPGN());

    // A save from before this was stored began in the usual way
    const older = JSON.parse(saved);
    delete older.gameStart;
    const third = loadGame({ storage: { [key]: JSON.stringify(older) } });
    expect(third.game.gameStart).toEqual({ player: 'w', halfmoveClock: 0, fullmove: 1, fen: null });
  });

  test('a new game goes back to the usual start', () => {
    const g = loadGame();
    g.setPosition({ e1: 'wk*', e8: 'bk*', a7: 'bp' }, 'b');
    g.game.resetGame();
    expect(g.game.buildFEN()).toBe(START_FEN);
    g.play('e2e4');
    expect(movetext(g)).toBe('1. e4 *');
  });
});
