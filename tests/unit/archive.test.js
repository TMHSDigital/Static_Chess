const { loadGame } = require('../helpers/load-game');

const KEY = 'chessGameArchive';
const el = (g, id) => g.window.document.getElementById(id);
const notations = (g) => g.game.moveHistory.map((move) => move.notation);
const entries = (g) => Array.from(el(g, 'archive-list').querySelectorAll('button'));
const stored = (g) => JSON.parse(g.window.localStorage.getItem(KEY));

/** Plays the shortest checkmate: Black wins in two moves. */
const playFoolsMate = (g) => g.play('f2f3', 'e7e5', 'g2g4', 'd8h4');

describe('past games', () => {
  // The computer opponent thinks on a timer; none of these tests waits for it
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('nothing is kept for a game without moves', () => {
    const g = loadGame();
    g.game.resetGame();
    expect(g.game.readArchive()).toEqual([]);
    g.game.openImportDialog();
    expect(el(g, 'archive-section').hidden).toBe(true);
  });

  test('a finished game is in the list after New Game', () => {
    const g = loadGame();
    playFoolsMate(g);
    expect(g.game.readArchive()).toEqual([]); // Still the live game
    g.game.resetGame();

    const archive = g.game.readArchive();
    expect(archive).toHaveLength(1);
    expect(archive[0]).toMatchObject({ result: '0-1', opponent: 'Two players', moves: 4 });
    expect(archive[0].pgn).toContain('1. f3 e5 2. g4 Qh4# 0-1');
    expect(Number.isNaN(Date.parse(archive[0].date))).toBe(false);

    g.game.openImportDialog();
    expect(el(g, 'archive-section').hidden).toBe(false);
    expect(entries(g)).toHaveLength(1);
    expect(entries(g)[0].textContent).toMatch(/Two players · Black won · 2 moves$/);
  });

  test('a game in progress that is replaced is kept as not finished', () => {
    const g = loadGame();
    g.game.setOpponent('medium', 'b');
    g.game.makeMove(6, 4, 4, 4); // The computer's 1. e4, played by hand
    g.game.importPGN('1. d4 d5');

    expect(g.game.readArchive()[0]).toMatchObject({
      result: '*',
      opponent: 'Computer (medium)',
      moves: 1,
    });
    g.game.openImportDialog();
    expect(entries(g)[0].textContent).toMatch(/Computer \(medium\) · Not finished · 1 move$/);
  });

  test('a finished game keeps its players when the settings change afterwards', () => {
    const g = loadGame();
    g.game.setOpponent('easy', 'w');
    g.game.makeMove(6, 4, 4, 4); // 1. e4, then Black's reply played by hand
    g.game.makeMove(1, 4, 3, 4);
    g.game.resign();
    g.game.setOpponent('hard', 'b');

    expect(g.game.buildPGN()).toContain('[White "White"]');
    expect(g.game.buildPGN()).toContain('[Black "Computer (easy)"]');

    // A reload keeps who played, although the settings now say otherwise
    const saved = g.window.localStorage.getItem('chessGameState');
    const again = loadGame({ storage: { chessGameState: saved } });
    again.game.setOpponent('hard', 'b');
    expect(again.game.buildPGN()).toContain('[Black "Computer (easy)"]');

    again.game.resetGame();
    expect(again.game.readArchive()[0].opponent).toBe('Computer (easy)');
  });

  test('Undo of a finished game lets the players follow the settings again', () => {
    const g = loadGame();
    g.game.setOpponent('easy', 'w');
    g.game.makeMove(6, 4, 4, 4);
    g.game.resign();
    g.game.setOpponent(null);
    expect(g.game.buildPGN()).toContain('[Black "Computer (easy)"]');
    g.game.undoLastMove(); // Takes back the resignation
    expect(g.game.buildPGN()).toContain('[Black "Black"]');
  });

  test('opening an entry loads that game with its result', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5');
    g.game.resign();
    g.game.resetGame();
    g.play('d2d4');

    g.game.openImportDialog();
    entries(g)[0].click();
    expect(el(g, 'import-dialog').hidden).toBe(true);
    expect(notations(g)).toEqual(['e4', 'e5']);
    expect(g.game.isGameOver).toBe(true);
    expect(g.game.gameResult).toBe('0-1');
    expect(el(g, 'game-status').textContent).toBe('White resigned. Black wins.');

    // The game that was on the board went into the list instead of being lost
    expect(g.game.readArchive().map((entry) => entry.moves)).toEqual([1, 2]);
  });

  test('a game opened from the list and replaced again is listed once', () => {
    const g = loadGame();
    playFoolsMate(g);
    g.game.resetGame();
    const original = g.game.readArchive()[0];

    g.game.openImportDialog();
    entries(g)[0].click();
    g.game.setOpponent('easy', 'w'); // Would label a new entry differently
    g.game.resetGame();
    expect(g.game.readArchive()).toEqual([original]);
  });

  test('only the newest games are kept, newest first', () => {
    const g = loadGame();
    const limit = global.CONFIG.ARCHIVE_LIMIT;
    expect(limit).toBe(20);
    const first = ['a2a3', 'b2b3', 'c2c3', 'd2d3', 'e2e3', 'f2f3', 'g2g3', 'h2h3'];
    const replies = ['a7a6', 'b7b6', 'c7c6'];
    for (let n = 0; n < limit + 4; n++) {
      g.play(first[n % 8], replies[Math.floor(n / 8)]);
      g.game.resetGame();
    }

    const archive = g.game.readArchive();
    expect(archive).toHaveLength(limit);
    expect(stored(g)).toHaveLength(limit);
    expect(archive[0].pgn).toContain('1. h3 c6'); // The 24th game
    expect(archive[limit - 1].pgn).toContain('1. e3 a6'); // The 5th: four older ones are gone
  });

  test('the list survives a reload', () => {
    const first = loadGame();
    playFoolsMate(first);
    first.game.resetGame();
    const saved = first.window.localStorage.getItem(KEY);

    const second = loadGame({ storage: { [KEY]: saved } });
    expect(second.game.readArchive()).toEqual(first.game.readArchive());
    second.game.openImportDialog();
    expect(entries(second)).toHaveLength(1);
  });

  test.each([
    ['text that is not JSON', '{not json'],
    ['a value that is not a list', '{"pgn":"1. e4"}'],
    ['a list of the wrong things', '[null, 3, "1. e4", {"pgn": 5}]'],
  ])('%s in storage is ignored', (_name, value) => {
    const g = loadGame({ storage: { [KEY]: value } });
    expect(g.game.readArchive()).toEqual([]);
    expect(() => g.game.openImportDialog()).not.toThrow();
    expect(el(g, 'archive-section').hidden).toBe(true);

    g.play('e2e4');
    g.game.resetGame(); // A new entry replaces the damaged value
    expect(g.game.readArchive()).toHaveLength(1);
  });

  test('incomplete entries are dropped and the good ones kept', () => {
    const good = { pgn: '1. e4 e5 *', result: '*', opponent: 'Two players', moves: 2 };
    const value = JSON.stringify([
      { ...good, date: '2026-11-14T10:00:00.000Z' },
      { ...good, date: 'last Tuesday' },
      { ...good, date: '2026-11-13T10:00:00.000Z', moves: 'two' },
    ]);
    const g = loadGame({ storage: { [KEY]: value } });
    expect(g.game.readArchive()).toHaveLength(1);
  });

  test('the game goes on when storage is blocked', () => {
    const g = loadGame({ brokenStorage: true });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    g.play('e2e4');
    expect(() => g.game.resetGame()).not.toThrow();
    expect(g.game.readArchive()).toEqual([]);
    expect(g.game.moveHistory).toHaveLength(0);
    console.error.mockRestore();
  });
});
