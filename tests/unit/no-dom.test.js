/**
 * The files below game.js hold no state of the page: they can be loaded and
 * used with no document at all. This file never creates one, which is the test.
 * game-store.js needs the browser's storage, which a plain object stands in for.
 */

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Loads the scripts in page order, giving each the names the ones before it declare. */
function loadWithoutPage() {
  jest.resetModules();
  const loaded = {};
  for (const name of [
    'config',
    'utils',
    'pieces',
    'rules',
    'notation',
    'saved-game',
    'game-store',
    'clock',
    'review',
  ]) {
    loaded[name] = require(`../../js/${name}`);
    Object.assign(global, loaded[name]);
  }
  return loaded;
}

beforeEach(() => {
  delete global.document;
  delete global.window;
  delete global.localStorage;
});

afterEach(() => {
  delete global.localStorage;
});

/** Stands in for the browser's storage, which needs no document either. */
function fakeStorage() {
  const values = new Map();
  global.localStorage = {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  return values;
}

test('there is no document while these tests run', () => {
  loadWithoutPage();
  expect(typeof document).toBe('undefined');
  expect(typeof window).toBe('undefined');
});

describe('notation.js', () => {
  test('takes the moves and the result out of PGN text', () => {
    const { notation } = loadWithoutPage();
    const pgn = '[Event "Test"]\n[Result "0-1"]\n\n1. e4 {best} e5 (1... c5) 2. Nf3 $1 0-1';
    expect(notation.pgnMoveTokens(pgn)).toEqual(['e4', 'e5', 'Nf3']);
    expect(notation.pgnTag(pgn, 'Event')).toBe('Test');
    expect(notation.pgnResult(pgn)).toEqual({
      result: '0-1',
      status: 'Black won (result from the loaded game).',
    });
    expect(notation.looksLikeFEN(START_FEN)).toBe(true);
    expect(notation.looksLikeFEN(pgn)).toBe(false);
  });

  test('writes a move from the positions before and after it', () => {
    const { notation, rules } = loadWithoutPage();
    const play = (position, from, to) => {
      const { position: after, move } = rules.applyMove(position, from, to);
      return { after, san: notation.writeSAN(move, position, after) };
    };
    const square = (name) => global.algebraicToCoords(name);

    let position = rules.initialPosition();
    const sans = [];
    // 1. f3 e5 2. g4 Qh4#
    for (const [from, to] of [
      ['f2', 'f3'],
      ['e7', 'e5'],
      ['g2', 'g4'],
      ['d8', 'h4'],
    ]) {
      const played = play(position, square(from), square(to));
      sans.push(played.san);
      position = played.after;
    }
    expect(sans).toEqual(['f3', 'e5', 'g4', 'Qh4#']);

    const check = rules.positionFromFEN('4k3/8/8/8/8/8/8/R3K3 w - - 0 1').position;
    expect(play(check, square('a1'), square('a8')).san).toBe('Ra8+');
    const twoRooks = rules.positionFromFEN('4k3/8/8/8/8/8/4K3/R6R w - - 0 1').position;
    expect(play(twoRooks, square('a1'), square('d1')).san).toBe('Rad1');
  });
});

describe('notation.js, whole games', () => {
  const STANDARD = { player: 'w', halfmoveClock: 0, fullmove: 1, fen: null };
  const game = (changes = {}) => ({
    moves: ['e4', 'e5', 'Nf3'],
    start: STANDARD,
    result: '*',
    white: 'White',
    black: 'Computer (hard)',
    timeControl: null,
    comment: null,
    date: new Date(2026, 0, 5),
    ...changes,
  });

  test('numbers moves from where the game began', () => {
    const { notation } = loadWithoutPage();
    expect(notation.moveNumber(0, STANDARD)).toEqual({ number: 1, white: true });
    expect(notation.moveNumber(3, STANDARD)).toEqual({ number: 2, white: false });
    const blackFirst = { player: 'b', fullmove: 12 };
    expect(notation.moveNumber(0, blackFirst)).toEqual({ number: 12, white: false });
    expect(notation.moveNumberPrefix(0, blackFirst)).toBe('12...');
    expect(notation.moveNumberPrefix(1, blackFirst)).toBe('13.');
  });

  test('writes a game as PGN', () => {
    const { notation } = loadWithoutPage();
    expect(notation.writePGN(game())).toBe(
      [
        '[Event "Static Chess game"]',
        '[Site "?"]',
        '[Date "2026.01.05"]',
        '[Round "-"]',
        '[White "White"]',
        '[Black "Computer (hard)"]',
        '[Result "*"]',
        '',
        '1. e4 e5 2. Nf3 *',
        '',
      ].join('\n')
    );
  });

  test('adds the clock, the starting position and how the game ended where they apply', () => {
    const { notation } = loadWithoutPage();
    const fen = '4k3/8/8/8/8/8/4P3/4K3 b - - 0 30';
    const pgn = notation.writePGN(
      game({
        moves: ['Kd7', 'exd6 e.p.'],
        start: { player: 'b', halfmoveClock: 0, fullmove: 30, fen },
        result: '1-0',
        timeControl: '300+2',
        comment: 'Black resigned. {White} wins.',
      })
    );
    expect(pgn).toContain('[TimeControl "300+2"]');
    expect(pgn).toContain(`[SetUp "1"]\n[FEN "${fen}"]`);
    // Black's first move carries its number; "e.p." and braces inside the comment are dropped
    expect(pgn.trim().split('\n').pop()).toBe(
      '30... Kd7 31. exd6 {Black resigned. White wins.} 1-0'
    );
  });

  test('reads a game back into checked moves, from the position it names', () => {
    const { notation, rules } = loadWithoutPage();
    const read = notation.readPGN(notation.writePGN(game()));
    expect(read.ok).toBe(true);
    expect(read.moves).toHaveLength(3);
    expect(read.start.player).toBe('w');
    expect(read.start.position).toEqual(rules.initialPosition());

    const fen = '4k3/8/8/8/8/8/8/R3K3 w Q - 0 9';
    const fromFen = notation.readPGN(`[FEN "${fen}"]\n\n9. O-O-O Ke7 *`);
    expect(fromFen.ok).toBe(true);
    expect(fromFen.start.fullmove).toBe(9);
    expect(fromFen.moves.map((move) => move.to.col)).toEqual([2, 4]);
  });

  test('says what is wrong with a game it cannot read', () => {
    const { notation } = loadWithoutPage();
    expect(notation.readPGN('')).toEqual({
      ok: false,
      error: 'No moves found in the text.',
      empty: true,
    });
    expect(notation.readPGN('1. e4 e5 2. Ke3')).toEqual({
      ok: false,
      error: 'Move 2. Ke3 cannot be played.',
    });
    expect(notation.readPGN('[FEN "nonsense"]\n\n1. e4').error).toMatch(
      /^The FEN tag cannot be used\. /
    );
    const long = 'x'.repeat(global.CONFIG.IMPORT_MAX_LENGTH + 1);
    expect(notation.readPGN(long).error).toBe(notation.importSizeError(long.length));
    expect(notation.importSizeError(long.length)).toMatch(/^That text is too long to be a game/);
    expect(notation.importSizeError(10)).toBeNull();
  });

  test('reads a position from FEN, or says why it cannot', () => {
    const { notation } = loadWithoutPage();
    const read = notation.readFEN(START_FEN);
    expect(read.ok).toBe(true);
    expect(read.start.player).toBe('w');
    expect(notation.readFEN('8/8/8/8/8/8/8/8 w - - 0 1').ok).toBe(false);
    expect(notation.readFEN('x'.repeat(global.CONFIG.IMPORT_MAX_LENGTH + 1)).ok).toBe(false);
  });
});

describe('game-store.js', () => {
  const entry = (pgn, changes = {}) => ({
    pgn,
    result: '1-0',
    opponent: 'Two players',
    date: '2026-01-05T10:00:00.000Z',
    moves: 2,
    ...changes,
  });

  test('a stored game comes back checked, and an unusable one is removed', () => {
    const values = fakeStorage();
    const { rules } = loadWithoutPage();
    expect(global.readStoredGame()).toBeNull(); // Nothing stored

    global.storeGame({
      version: global.SAVED_GAME_VERSION,
      boardState: rules.initialPosition().board,
      currentPlayer: 'b',
      moveHistory: [],
    });
    expect(global.readStoredGame().currentPlayer).toBe('b');

    const key = global.CONFIG.STORAGE_KEYS.GAME_STATE;
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    for (const damaged of ['{not json', '{"boardState": []}']) {
      values.set(key, damaged);
      expect(global.readStoredGame()).toBeNull();
      expect(values.has(key)).toBe(false);
    }
    error.mockRestore();

    global.storeGame({ version: global.SAVED_GAME_VERSION });
    global.clearStoredGame();
    expect(values.has(key)).toBe(false);
  });

  test('past games are kept newest first, once each, up to the limit', () => {
    fakeStorage();
    loadWithoutPage();
    expect(global.readArchive()).toEqual([]);

    global.addToArchive(entry('1. e4 e5 *'));
    global.addToArchive(entry('1. d4 d5 *'));
    expect(global.readArchive().map((game) => game.pgn)).toEqual(['1. d4 d5 *', '1. e4 e5 *']);

    // The same moves again: the entry moves to the top and keeps its first date
    global.addToArchive(entry('1. e4 e5 *', { date: '2026-02-01T10:00:00.000Z' }));
    const archive = global.readArchive();
    expect(archive.map((game) => game.pgn)).toEqual(['1. e4 e5 *', '1. d4 d5 *']);
    expect(archive[0].date).toBe('2026-01-05T10:00:00.000Z');

    for (let n = 0; n < global.CONFIG.ARCHIVE_LIMIT + 3; n++) {
      global.addToArchive(entry(`1. a3 a6 2. h${3 + (n % 2)} ${'Kf8 Ke8 '.repeat(n)}*`));
    }
    expect(global.readArchive()).toHaveLength(global.CONFIG.ARCHIVE_LIMIT);
  });

  test('entries that are not complete, and a damaged list, are left out', () => {
    const values = fakeStorage();
    loadWithoutPage();
    const key = global.CONFIG.STORAGE_KEYS.GAME_ARCHIVE;
    values.set(
      key,
      JSON.stringify([entry('1. e4 *'), { pgn: 5 }, entry('1. d4 *', { date: 'when' })])
    );
    expect(global.readArchive().map((game) => game.pgn)).toEqual(['1. e4 *']);
    values.set(key, '{"not": "a list"}');
    expect(global.readArchive()).toEqual([]);
    values.set(key, 'not json');
    expect(global.readArchive()).toEqual([]);
  });
});

describe('review.js', () => {
  const at = (score, flags = {}) => ({ score, mate: false, over: false, ...flags });

  test('puts a score into words', () => {
    const { review } = loadWithoutPage();
    expect(review.scoreText(at(12))).toBe('Engine thinks the position is about equal.');
    expect(review.scoreText(at(130))).toBe('Engine thinks White is ahead by 1.3.');
    expect(review.scoreText(at(-905))).toBe('Engine thinks Black is ahead by 9.1.');
    expect(review.scoreText(at(-99000, { mate: true }))).toBe(
      'Engine thinks Black can force mate.'
    );
    expect(review.scoreText(at(-99000, { mate: true, over: true }))).toBe('Checkmate.');
    expect(review.scoreText(at(0, { over: true }))).toBe('Stalemate.');
  });

  test('counts what a move cost from the side that played it', () => {
    const { review } = loadWithoutPage();
    const drop = global.CONFIG.REVIEW_MISTAKE_DROP;
    expect(review.scoreDrop(at(50), at(50 - drop + 1), 'w')).toBeNull(); // Just under the mark
    expect(review.scoreDrop(at(50), at(50 - drop), 'w')).toEqual({
      lost: drop,
      allowedMate: false,
      missedMate: false,
    });
    expect(review.scoreDrop(at(-50), at(250), 'b').lost).toBe(300); // Black's loss is White's gain
    expect(review.scoreDrop(at(-50), at(250), 'w')).toBeNull(); // For White that was a gain

    expect(review.scoreDrop(at(0), at(-99000, { mate: true }), 'w')).toMatchObject({
      allowedMate: true,
      missedMate: false,
    });
    expect(review.scoreDrop(at(99000, { mate: true }), at(100), 'w')).toMatchObject({
      allowedMate: false,
      missedMate: true,
    });
  });

  test('says what a move cost', () => {
    const { review } = loadWithoutPage();
    const cost = (changes) => ({ lost: 320, allowedMate: false, missedMate: false, ...changes });
    expect(review.scoreDropText('12. Nf3', cost())).toBe('Engine thinks 12. Nf3 lost about 3.2.');
    expect(review.scoreDropText('2. g4', cost({ allowedMate: true }))).toBe(
      'Engine thinks 2. g4 allowed a forced mate.'
    );
    expect(review.scoreDropText('7... Qd8', cost({ missedMate: true }))).toBe(
      'Engine thinks 7... Qd8 missed a forced mate.'
    );
  });
});

describe('saved-game.js', () => {
  test('accepts a sound save and gives back a clean copy', () => {
    const { rules } = loadWithoutPage();
    const start = rules.initialPosition();
    const clean = global.validateSavedGame({
      version: global.SAVED_GAME_VERSION,
      boardState: start.board,
      currentPlayer: 'w',
      moveHistory: [],
      unknownField: 'ignored',
    });
    expect(clean.currentPlayer).toBe('w');
    expect(clean.kingPositions).toEqual(start.kingPositions);
    expect(clean.gameStart).toEqual(global.STANDARD_START);
    expect(clean.positionHistory).toEqual([]);
    expect(clean.clock).toBeNull();
    expect(clean).not.toHaveProperty('unknownField');
  });

  test('refuses what cannot be a game', () => {
    const { rules } = loadWithoutPage();
    const board = rules.initialPosition().board;
    expect(global.validateSavedGame(null)).toBeNull();
    expect(global.validateSavedGame({ boardState: board })).toBeNull(); // No side to move
    expect(global.validateSavedGame({ boardState: [], currentPlayer: 'w' })).toBeNull();
    expect(
      global.validateSavedGame({ version: 99, boardState: board, currentPlayer: 'w' })
    ).toBeNull();
    const noKing = board.map((row) =>
      row.map((piece) => (piece && piece.type === 'k' ? null : piece))
    );
    expect(global.validateSavedGame({ boardState: noKing, currentPlayer: 'w' })).toBeNull();
  });

  describe('validateSavedGame', () => {
    const E2E4 = { from: { row: 6, col: 4 }, to: { row: 4, col: 4 }, notation: 'e4' };
    /** A sound save with one field changed (or removed, when the value is undefined). */
    const saveWith = (changes) => {
      const { rules } = loadWithoutPage();
      const save = {
        boardState: rules.initialPosition().board,
        currentPlayer: 'w',
        moveHistory: [],
        ...changes,
      };
      for (const key of Object.keys(changes)) if (changes[key] === undefined) delete save[key];
      return save;
    };
    const board = () => saveWith({}).boardState;

    test.each([
      ['a move history that is not a list', { moveHistory: 'x' }],
      ['a move that is null', { moveHistory: [null] }],
      ['a move with nothing in it', { moveHistory: [{}] }],
      ['a move to a square off the board', { moveHistory: [{ ...E2E4, to: { row: 8, col: 4 } }] }],
      ['a move whose notation is not text', { moveHistory: [{ ...E2E4, notation: 5 }] }],
      [
        'a board row of seven squares',
        { boardState: board().map((row, r) => (r === 3 ? row.slice(1) : row)) },
      ],
      [
        'a piece of an unknown type',
        {
          boardState: board().map((row, r) =>
            r === 3 ? [{ type: 'x', color: 'w' }, ...row.slice(1)] : row
          ),
        },
      ],
      [
        'a cell that is not a piece',
        { boardState: board().map((row, r) => (r === 3 ? ['p', ...row.slice(1)] : row)) },
      ],
      ['an en passant square off the board', { enPassantTarget: { row: 9, col: 0 } }],
    ])('refuses %s', (_, changes) => {
      expect(global.validateSavedGame(saveWith(changes))).toBeNull();
    });

    test('a save without a move history loads with none', () => {
      expect(global.validateSavedGame(saveWith({ moveHistory: undefined })).moveHistory).toEqual(
        []
      );
    });

    test('a damaged undo stack is dropped and the game still loads', () => {
      const clean = global.validateSavedGame(
        saveWith({ moveHistory: [E2E4], positionHistory: [null] })
      );
      expect(clean.moveHistory).toEqual([E2E4]);
      expect(clean.positionHistory).toEqual([]);
    });

    test('a sound undo stack is kept', () => {
      const entry = { boardState: board(), currentPlayer: 'w', enPassantTarget: null };
      const clean = global.validateSavedGame(
        saveWith({ moveHistory: [E2E4], positionHistory: [entry] })
      );
      expect(clean.positionHistory).toHaveLength(1);
      expect(clean.positionHistory[0].currentStatus).toBe('');
    });

    test('cleanSnapshot refuses what is not a record', () => {
      loadWithoutPage();
      expect(global.cleanSnapshot(null, '')).toBeNull();
      expect(global.cleanSnapshot(5, '')).toBeNull();
    });

    test('a finished game saved without a result gets one from its last move', () => {
      const drawn = global.validateSavedGame(saveWith({ isGameOver: true, moveHistory: [E2E4] }));
      expect(drawn.gameResult).toBe('1/2-1/2');
      const mated = global.validateSavedGame(
        saveWith({
          isGameOver: true,
          currentPlayer: 'b',
          moveHistory: [{ ...E2E4, isCheckmate: true }],
        })
      );
      expect(mated.gameResult).toBe('1-0');
    });

    test('a clock is stopped in a finished game, and a control that is not text is dropped', () => {
      const clock = {
        base: 300000,
        increment: 0,
        remaining: { w: 1000, b: 2000 },
        running: true,
        control: 5,
      };
      const clean = global.validateSavedGame(
        saveWith({ isGameOver: true, gameResult: '1-0', clock })
      );
      expect(clean.clock.turnStartedAt).toBeNull();
      expect(clean.clock.control).toBe('');
      expect(clean.clock.remaining).toEqual({ w: 1000, b: 2000 });
    });

    test.each([
      ['a computer that plays no side', { computer: 'x', level: 'hard' }],
      ['a level that is not a word', { computer: 'w', level: 'HARD!' }],
    ])('drops the players for %s', (_, players) => {
      expect(global.validateSavedGame(saveWith({ players })).players).toBeNull();
    });

    test('keeps players that are two people or a computer at a level', () => {
      const two = { level: null, computer: null };
      expect(global.validateSavedGame(saveWith({ players: two })).players).toEqual(two);
      const computer = { level: 'hard', computer: 'b' };
      expect(global.validateSavedGame(saveWith({ players: computer })).players).toEqual(computer);
    });

    test.each([
      ['no remaining times', { base: 300000, increment: 0 }],
      ['a negative time', { base: 300000, increment: 0, remaining: { w: -1, b: 2000 } }],
      ['a time that is not a number', { base: '5', increment: 0, remaining: { w: 1, b: 2 } }],
    ])('drops a clock with %s', (_, clock) => {
      expect(global.validateSavedGame(saveWith({ clock })).clock).toBeNull();
    });

    test('a running clock in a game going on is restarted from now', () => {
      const clock = {
        base: 1,
        increment: 0,
        remaining: { w: 1, b: 1 },
        running: true,
        control: '1+0',
      };
      const clean = global.validateSavedGame(saveWith({ clock }));
      expect(typeof clean.clock.turnStartedAt).toBe('number');
      expect(clean.clock.control).toBe('1+0');
    });

    test('keeps a sound start and falls back to the usual one otherwise', () => {
      const fen = '8/8/8/8/8/8/8/K6k b - - 3 12';
      const begun = { player: 'b', fullmove: 12, halfmoveClock: 3, fen };
      expect(global.validateSavedGame(saveWith({ gameStart: begun })).gameStart).toEqual(begun);
      const noFen = { player: 'w', fullmove: 2, halfmoveClock: -1, fen: 7 };
      expect(global.validateSavedGame(saveWith({ gameStart: noFen })).gameStart).toEqual({
        player: 'w',
        fullmove: 2,
        halfmoveClock: 0,
        fen: null,
      });
      for (const bad of [{ player: 'x', fullmove: 1 }, { player: 'w', fullmove: 0 }, 'start']) {
        expect(global.validateSavedGame(saveWith({ gameStart: bad })).gameStart).toEqual(
          global.STANDARD_START
        );
      }
    });
  });
});

describe('clock.js', () => {
  test('makes a clock for a time control and none for "No clock"', () => {
    const { clock } = loadWithoutPage();
    expect(clock.makeClock('3+2')).toEqual({
      control: '3+2',
      base: 180000,
      increment: 2000,
      remaining: { w: 180000, b: 180000 },
      turnStartedAt: null,
    });
    expect(clock.makeClock('off')).toBeNull();
    expect(clock.makeClock(null)).toBeNull();
    expect(clock.makeClock('no such control')).toBeNull();
  });

  test('works out the time left from when the turn began', () => {
    const { clock } = loadWithoutPage();
    const running = { ...clock.makeClock('1+0'), turnStartedAt: 1000 };
    expect(clock.timeLeft(running, 'w', 'w', 11000)).toBe(50000); // Ten seconds into White's turn
    expect(clock.timeLeft(running, 'b', 'w', 11000)).toBe(60000); // Black's clock is not running
    expect(clock.timeLeft(running, 'w', 'w', 999000)).toBe(0); // Never below zero
    expect(clock.timeLeft({ ...running, turnStartedAt: null }, 'w', 'w', 11000)).toBe(60000);
    expect(clock.timeLeft(null, 'w', 'w')).toBe(0);
    expect(clock.formatClock(65000)).toBe('1:05');
    expect(clock.formatClock(9400)).toBe('0:09.4');
  });

  test('knows which low-time warning a clock has reached', () => {
    const { clock } = loadWithoutPage();
    expect(global.CONFIG.LOW_TIME_WARNINGS).toEqual([20000, 10000]);
    expect(clock.lowTimeLevel(20001)).toBeNull();
    expect(clock.lowTimeLevel(20000)).toBe(20000);
    expect(clock.lowTimeLevel(10001)).toBe(20000);
    expect(clock.lowTimeLevel(900)).toBe(10000);
  });

  test('time running out loses, or draws when the other side cannot checkmate', () => {
    const { clock } = loadWithoutPage();
    expect(clock.timeoutResult('w', true)).toEqual({
      result: '0-1',
      status: 'White ran out of time. Black wins.',
    });
    expect(clock.timeoutResult('b', true)).toEqual({
      result: '1-0',
      status: 'Black ran out of time. White wins.',
    });
    expect(clock.timeoutResult('b', false)).toEqual({
      result: '1/2-1/2',
      status: 'Black ran out of time, but White cannot checkmate. Draw.',
    });
  });
});
