/**
 * The files below game.js hold no state of the page: they can be loaded and
 * used with no document at all. This file never creates one, which is the test.
 */

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Loads the scripts in page order, giving each the names the ones before it declare. */
function loadWithoutPage() {
  jest.resetModules();
  const loaded = {};
  for (const name of ['config', 'utils', 'pieces', 'rules', 'notation', 'saved-game', 'clock']) {
    loaded[name] = require(`../../js/${name}`);
    Object.assign(global, loaded[name]);
  }
  return loaded;
}

beforeEach(() => {
  delete global.document;
  delete global.window;
});

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
});
