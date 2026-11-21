const { loadGame } = require('../helpers/load-game');

const el = (g, id) => g.window.document.getElementById(id);
const notations = (g) => g.game.moveHistory.map((move) => move.notation);

// Pretends the page is in its stacked layout (or not), for the board reveal
// after a load. jsdom does not lay the page out, so matchMedia is stubbed.
const setStackedLayout = (g, stacked, reducedMotion = false) => {
  g.window.matchMedia = (query) => ({
    matches:
      query === '(max-width: 900px)'
        ? stacked
        : query === '(prefers-reduced-motion: reduce)'
          ? reducedMotion
          : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
};
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('reading PGN', () => {
  test('drops tags, comments, variations, annotation codes, numbers and the result', () => {
    const g = loadGame();
    const pgn = `[Event "Test"]
[White "A"]

1. e4 {best by test} e5 2. Nf3 $1 (2. f4 exf4 (2... d5)) 2... Nc6 ; a comment to the end of the line
3.Bb5 a6 1/2-1/2`;
    expect(g.notation.pgnMoveTokens(pgn)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
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

  test.each([
    ['gives check', '5k2/8/8/8/8/8/8/4K2R w K - 0 1', 'e1g1', 'O-O+', false],
    ['gives check, queenside', '3k4/8/8/8/8/8/8/R3K3 w Q - 0 1', 'e1c1', 'O-O-O+', false],
    ['mates', '4rkr1/4p1p1/8/8/8/8/8/4K2R w K - 0 1', 'e1g1', 'O-O#', true],
  ])('castling that %s is written with its mark and loads back', (_, fen, move, san, mate) => {
    const first = loadGame();
    first.game.importFEN(fen);
    first.play(move);
    expect(notations(first)).toEqual([san]);
    expect(first.game.isGameOver).toBe(mate);
    const pgn = first.game.buildPGN();
    expect(pgn).toContain(`1. ${san}`);

    const g = loadGame();
    expect(g.game.importPGN(pgn)).toEqual({ ok: true, moves: 1 });
    expect(g.snapshot()).toEqual(first.snapshot());
  });

  test('tag values may hold escaped quotes and brackets', () => {
    const g = loadGame();
    const pgn =
      '[Event "Blitz [rated]"]\n[White "Dan \\"The Man\\" Smith"]\n[Black "Ann"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 *\n';
    expect(g.game.importPGN(pgn)).toEqual({ ok: true, moves: 3 });
    expect(global.pgnTag(pgn, 'White')).toBe('Dan "The Man" Smith');
    expect(global.pgnTag(pgn, 'Event')).toBe('Blitz [rated]');
    expect(global.pgnTag('[Path "C:\\\\games"]', 'Path')).toBe('C:\\games');
  });

  test('"e.p." after an en passant capture is read past', () => {
    const g = loadGame();
    expect(g.game.importPGN('1. e4 a6 2. e5 d5 3. exd6 e.p. *', true)).toEqual({
      ok: true,
      moves: 5,
    });
    g.game.importPGN('1. e4 a6 2. e5 d5 3. exd6 e.p. *');
    expect(notations(g)).toEqual(['e4', 'a6', 'e5', 'd5', 'exd6 e.p.']);
  });

  test('a game copied from the move list, with "e.p.", loads back', () => {
    const first = loadGame();
    first.play('e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6');
    const listed = notations(first)
      .map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san))
      .join(' ');
    expect(listed).toContain('exd6 e.p.');
    const g = loadGame();
    expect(g.game.importPGN(listed)).toEqual({ ok: true, moves: 5 });
    expect(g.snapshot()).toEqual(first.snapshot());
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

    test('a closing comment that contradicts the result is not taken as the status', () => {
      for (const [pgn, expected] of [
        ['1. e4 e5 {White resigned. Black wins.} 1-0', 'White won (result from the loaded game).'],
        ['1. e4 e5 {Draw by agreement.} 0-1', 'Black won (result from the loaded game).'],
        [
          '1. e4 e5 {White ran out of time, whatever.} 1-0',
          'White won (result from the loaded game).',
        ],
        [
          '1. e4 e5 {White ran out of time. Black wins.} 1-0',
          'White won (result from the loaded game).',
        ],
        [
          '1. e4 e5 {Black ran out of time, but White cannot checkmate. Draw.} 1/2-1/2',
          'Black ran out of time, but White cannot checkmate. Draw.',
        ],
        ['1. e4 e5 {Black resigned. White wins.} 1-0', 'Black resigned. White wins.'],
      ]) {
        const g = loadGame();
        g.game.importPGN(pgn);
        expect(status(g)).toBe(expected);
      }
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
      expect(loadGame().notation.pgnResult('[Result "1-0"]\n\n1. e4 e5 *')).toBeNull();
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

describe('damaged or oversized text', () => {
  const N = 100000;
  /** Runs fn and fails if it takes three seconds or more, which only runaway backtracking does: a real game takes about a millisecond, and a busy runner under coverage some hundred times that. */
  const quickly = (fn) => {
    const started = Date.now();
    const result = fn();
    expect(Date.now() - started).toBeLessThan(3000);
    return result;
  };

  test.each([
    ['braces that are never closed', `${'{'.repeat(N)} 1. e4 e5`],
    ['blank lines', `${'\n'.repeat(N)}1. e4 e5`],
    ['spaces and blank lines', `${' \n'.repeat(N / 2)}1. e4 e5`],
    ['deeply nested variations', `1. e4 ${'('.repeat(N / 2)}1. d4${')'.repeat(N / 2)} e5`],
    ['parentheses that are never closed', `1. e4 e5 ${'('.repeat(N)}`],
    ['closing parentheses on their own', `${')'.repeat(N)} 1. e4 e5`],
    ['a long run of tag-like lines', `${'[\n'.repeat(N / 2)}1. e4 e5`],
  ])('%s are read without a long wait', (_name, text) => {
    const g = loadGame();
    quickly(() => g.notation.pgnMoveTokens(text));
    quickly(() => g.notation.pgnResult(text));
    quickly(() => g.game.importPGN(text, true));
  });

  test('the same text gives the same moves as before', () => {
    const { game, notation } = loadGame();
    // Nested variations go, with the comments inside them
    expect(notation.pgnMoveTokens('1. e4 (1. d4 d5 (1... Nf6 {Indian}) 2. c4) e5 2. Nf3')).toEqual([
      'e4',
      'e5',
      'Nf3',
    ]);
    // A parenthesis inside a comment does not open a variation
    expect(notation.pgnMoveTokens('1. e4 {best (by test} e5 ) 2. Nf3')).toEqual([
      'e4',
      'e5',
      ')',
      'Nf3',
    ]);
    // What is never closed stays in the text, so the move after it is named in the error
    expect(game.importPGN('1. e4 {a comment e5 2. Nf3', true).error).toBe(
      'Move 1... {a cannot be played.'
    );
    expect(game.importPGN('1. e4 (1. d4 e5', true).error).toBe('Move 1... ( cannot be played.');
    expect(notation.pgnMoveTokens(`${'\n'.repeat(1000)}1. e4 e5`)).toEqual(['e4', 'e5']);
  });

  test('the result is still found at the end of long text', () => {
    const { notation } = loadGame();
    const padding = '\n'.repeat(N);
    expect(notation.pgnResult(`1. e4 e5 {White resigned. Black wins.} 0-1${padding}`)).toEqual({
      result: '0-1',
      status: 'White resigned. Black wins.',
    });
    expect(notation.pgnResult(`${padding}[Result "1/2-1/2"]\n\n1. e4 e5`).result).toBe('1/2-1/2');
  });

  test('text over the size limit is refused with a message', () => {
    const g = loadGame();
    const limit = global.CONFIG.IMPORT_MAX_LENGTH;
    expect(limit).toBe(200000);
    const tooLong = `1. e4 e5 ${' '.repeat(limit)}`;
    const message = 'That text is too long to be a game (over 200,000 characters).';
    expect(g.game.importPGN(tooLong)).toEqual({ ok: false, error: message });
    expect(g.game.importFEN(`${START_FEN}${' '.repeat(limit)}`)).toEqual({
      ok: false,
      error: message,
    });
    expect(g.game.importPGN(`1. e4 e5${' '.repeat(limit - 8)}`).ok).toBe(true); // Exactly at the limit

    g.game.resetGame();
    g.play('d2d4');
    el(g, 'import-button').click();
    el(g, 'import-text').value = tooLong;
    el(g, 'import-load').click();
    expect(el(g, 'import-error').textContent).toBe(`${message} The current game was not changed.`);
    expect(notations(g)).toEqual(['d4']);
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

  test('asks before replacing a game in progress', () => {
    const g = loadGame();
    g.play('d2d4');
    el(g, 'import-button').click();
    el(g, 'import-text').value = '1. e4 e5';
    el(g, 'import-load').click();
    expect(el(g, 'import-load').textContent).toBe('Replace current game?');
    expect(notations(g)).toEqual(['d4']);
    el(g, 'import-load').click();
    expect(notations(g)).toEqual(['e4', 'e5']);
  });

  test('brings the board into view after loading on a narrow screen', () => {
    const g = loadGame();
    setStackedLayout(g, true);
    const board = g.window.document.querySelector('.board-container');
    board.scrollIntoView = jest.fn();
    el(g, 'import-button').click();
    el(g, 'import-text').value = '1. e4 e5';
    el(g, 'import-load').click();
    expect(board.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(board.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  test('scrolls without animation when reduced motion is set', () => {
    const g = loadGame();
    setStackedLayout(g, true, true);
    const board = g.window.document.querySelector('.board-container');
    board.scrollIntoView = jest.fn();
    el(g, 'import-button').click();
    el(g, 'import-text').value = '1. e4 e5';
    el(g, 'import-load').click();
    expect(board.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  test('leaves the page alone after loading beside the board', () => {
    const g = loadGame();
    setStackedLayout(g, false);
    const board = g.window.document.querySelector('.board-container');
    board.scrollIntoView = jest.fn();
    el(g, 'import-button').click();
    el(g, 'import-text').value = '1. e4 e5';
    el(g, 'import-load').click();
    expect(board.scrollIntoView).not.toHaveBeenCalled();
  });

  test('validates an invalid PGN before asking to replace a game', () => {
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
    expect(el(g, 'import-load').textContent).toBe('Replace current game?');
    expect(notations(g)).toEqual(['d4']);
    el(g, 'import-load').click();
    expect(notations(g)).toEqual(['e4', 'e5']);
  });

  test('shows the error and stays open', () => {
    const g = loadGame();
    el(g, 'import-button').click();
    el(g, 'import-load').click();
    expect(el(g, 'import-error').textContent).toBe(
      'Paste a game in PGN format, or a position in FEN, first.'
    );
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
    el(g, 'import-text').dispatchEvent(
      new g.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
    expect(el(g, 'import-dialog').hidden).toBe(true);
    expect(g.game.moveHistory).toHaveLength(0);
  });

  describe('with the focus outside it, as after a click on the backdrop', () => {
    const press = (g, key, init = {}) => {
      const event = new g.window.KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...init,
      });
      g.window.document.body.dispatchEvent(event);
      return event;
    };
    const openWithFocusLost = (g) => {
      el(g, 'import-button').click();
      g.window.document.activeElement.blur();
      expect(g.window.document.activeElement).toBe(g.window.document.body);
    };

    test('Escape closes it', () => {
      const g = loadGame();
      g.play('e2e4', 'e7e5');
      openWithFocusLost(g);
      press(g, 'Escape');
      expect(el(g, 'import-dialog').hidden).toBe(true);
      expect(g.game.viewPly).toBe(null);
    });

    test('the arrow keys leave the game behind it alone', () => {
      const g = loadGame();
      g.play('e2e4', 'e7e5');
      openWithFocusLost(g);
      press(g, 'ArrowLeft');
      press(g, 'ArrowLeft');
      expect(g.game.viewPly).toBe(null);
      expect(el(g, 'import-dialog').hidden).toBe(false);
    });

    test('Tab and Shift+Tab stay inside it', () => {
      const g = loadGame();
      const doc = g.window.document;
      openWithFocusLost(g);
      expect(press(g, 'Tab').defaultPrevented).toBe(true);
      expect(doc.activeElement).toBe(el(g, 'import-text'));
      // From the first control, Shift+Tab goes round to the last
      el(g, 'import-text').dispatchEvent(
        new g.window.KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
      expect(doc.activeElement).toBe(el(g, 'import-load'));
      // And from the last, Tab goes back to the first
      el(g, 'import-load').dispatchEvent(
        new g.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
      );
      expect(doc.activeElement).toBe(el(g, 'import-text'));
      // Between the two, Tab is left to the browser
      const middle = new g.window.KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      el(g, 'import-cancel').focus();
      el(g, 'import-cancel').dispatchEvent(middle);
      expect(middle.defaultPrevented).toBe(false);
    });
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

describe('SAN edge cases', () => {
  test('a move two rivals can match needs both file and rank: Qa1b2', () => {
    const first = loadGame();
    first.game.importFEN('4k3/8/8/8/8/Q7/8/Q1Q1K3 w - - 0 1');
    first.play('a1b2');
    expect(notations(first)).toEqual(['Qa1b2']);

    const g = loadGame();
    expect(g.game.importPGN(first.game.buildPGN())).toEqual({ ok: true, moves: 1 });
    expect(g.snapshot()).toEqual(first.snapshot());
  });

  test('a rank tells two rooks on one file apart', () => {
    const fen = '4k3/8/8/R7/8/8/8/R3K3 w - - 0 1';
    const low = loadGame();
    low.game.importFEN(fen);
    low.play('a1a3');
    expect(notations(low)).toEqual(['R1a3']);

    const high = loadGame();
    high.game.importFEN(fen);
    high.play('a5a3');
    expect(notations(high)).toEqual(['R5a3']);

    for (const [san, from] of [
      ['R1a3', 'a1'],
      ['R5a3', 'a5'],
    ]) {
      const g = loadGame();
      expect(g.game.importPGN(`[SetUp "1"]\n[FEN "${fen}"]\n\n1. ${san} *`).ok).toBe(true);
      expect(g.at(from)).toBeNull();
      expect(g.at('a3').type).toBe('r');
    }
  });

  test('a promotion on a square that is not the last rank is refused', () => {
    const g = loadGame();
    const before = g.snapshot();
    expect(g.game.importPGN('1. e4=Q')).toMatchObject({ ok: false });
    expect(g.snapshot()).toEqual(before);
  });
});
