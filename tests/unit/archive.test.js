const { loadGame } = require('../helpers/load-game');

const KEY = 'chessGameArchive';
const el = (g, id) => g.window.document.getElementById(id);
const notations = (g) => g.game.moveHistory.map((move) => move.notation);
const entries = (g) => Array.from(el(g, 'archive-list').querySelectorAll('button[data-index]'));
const deletes = (g) => Array.from(el(g, 'archive-list').querySelectorAll('button[data-delete]'));
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
    expect(g.store.readArchive()).toEqual([]);
    g.ui.openImportDialog();
    expect(el(g, 'archive-section').hidden).toBe(true);
  });

  test('a finished game is in the list after New Game', () => {
    const g = loadGame();
    playFoolsMate(g);
    expect(g.store.readArchive()).toEqual([]); // Still the live game
    g.game.resetGame();

    const archive = g.store.readArchive();
    expect(archive).toHaveLength(1);
    expect(archive[0]).toMatchObject({ result: '0-1', opponent: 'Two players', moves: 4 });
    expect(archive[0].pgn).toContain('1. f3 e5 2. g4 Qh4# 0-1');
    expect(Number.isNaN(Date.parse(archive[0].date))).toBe(false);

    g.ui.openImportDialog();
    expect(el(g, 'archive-section').hidden).toBe(false);
    expect(entries(g)).toHaveLength(1);
    expect(entries(g)[0].textContent).toMatch(/Two players · Black won · 2 moves$/);
  });

  test('a game in progress that is replaced is kept as not finished', () => {
    const g = loadGame();
    g.game.setOpponent('medium', 'b');
    g.game.makeMove(6, 4, 4, 4); // The computer's 1. e4, played by hand
    g.game.importPGN('1. d4 d5');

    expect(g.store.readArchive()[0]).toMatchObject({
      result: '*',
      opponent: 'Computer (medium)',
      moves: 1,
    });
    g.ui.openImportDialog();
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
    expect(again.store.readArchive()[0].opponent).toBe('Computer (easy)');
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

    g.ui.openImportDialog();
    entries(g)[0].click();
    expect(el(g, 'import-dialog').hidden).toBe(true);
    expect(notations(g)).toEqual(['e4', 'e5']);
    expect(g.game.isGameOver).toBe(true);
    expect(g.game.gameResult).toBe('0-1');
    expect(el(g, 'game-status').textContent).toBe('White resigned. Black wins.');

    // The game that was on the board went into the list instead of being lost
    expect(g.store.readArchive().map((entry) => entry.moves)).toEqual([1, 2]);
  });

  test('a game opened from the list and replaced again is listed once', () => {
    const g = loadGame();
    playFoolsMate(g);
    g.game.resetGame();
    const original = g.store.readArchive()[0];

    g.ui.openImportDialog();
    entries(g)[0].click();
    g.game.setOpponent('easy', 'w'); // Would label a new entry differently
    g.game.resetGame();
    expect(g.store.readArchive()).toEqual([original]);
  });

  test('separate games with the same moves are kept as separate entries', () => {
    jest.setSystemTime(new Date('2026-11-01T10:00:00Z'));
    const g = loadGame();
    g.play('e2e4');
    g.game.resetGame();
    jest.setSystemTime(new Date('2026-11-02T10:00:00Z'));
    g.game.setOpponent('easy', 'b'); // The computer plays White: 1. e4 is its move
    g.game.setOpponent(null);
    g.game.setOpponent('easy', 'b');
    g.play('e2e4');
    g.game.resetGame();

    const archive = g.store.readArchive();
    expect(archive).toHaveLength(2);
    expect(archive.map((entry) => entry.opponent)).toEqual(['Computer (easy)', 'Two players']);
    expect(archive.map((entry) => entry.date.slice(0, 10))).toEqual(['2026-11-02', '2026-11-01']);
  });

  test('an unfinished game opened from the list and finished replaces its own entry', () => {
    jest.setSystemTime(new Date('2026-11-01T10:00:00Z'));
    const g = loadGame();
    g.play('f2f3', 'e7e5');
    g.game.resetGame();
    jest.setSystemTime(new Date('2026-11-02T10:00:00Z'));
    g.play('d2d4'); // Another game, in between
    g.game.resetGame();
    const unfinished = g.store.readArchive()[1];
    expect(unfinished.result).toBe('*');

    jest.setSystemTime(new Date('2026-11-03T10:00:00Z'));
    g.ui.openImportDialog();
    entries(g)[1].click();
    g.play('g2g4', 'd8h4'); // Now it ends in mate
    g.game.resetGame();

    const archive = g.store.readArchive();
    expect(archive).toHaveLength(2);
    expect(archive[0]).toMatchObject({ result: '0-1', moves: 4, date: unfinished.date });
    expect(archive[1].pgn).toContain('1. d4');
  });

  test('a game opened from the list still replaces its own entry after a reload', () => {
    const first = loadGame();
    first.play('e2e4', 'e7e5');
    first.game.resetGame();
    first.ui.openImportDialog();
    entries(first)[0].click();
    const storage = {
      chessGameState: first.window.localStorage.getItem('chessGameState'),
      [KEY]: first.window.localStorage.getItem(KEY),
    };

    const g = loadGame({ storage });
    g.play('g1f3');
    g.game.resetGame();
    expect(g.store.readArchive()).toHaveLength(1);
    expect(g.store.readArchive()[0].moves).toBe(3);
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

    const archive = g.store.readArchive();
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
    expect(second.store.readArchive()).toEqual(first.store.readArchive());
    second.ui.openImportDialog();
    expect(entries(second)).toHaveLength(1);
  });

  test.each([
    ['text that is not JSON', '{not json'],
    ['a value that is not a list', '{"pgn":"1. e4"}'],
    ['a list of the wrong things', '[null, 3, "1. e4", {"pgn": 5}]'],
  ])('%s in storage is ignored', (_name, value) => {
    const g = loadGame({ storage: { [KEY]: value } });
    expect(g.store.readArchive()).toEqual([]);
    expect(() => g.ui.openImportDialog()).not.toThrow();
    expect(el(g, 'archive-section').hidden).toBe(true);

    g.play('e2e4');
    g.game.resetGame(); // A new entry replaces the damaged value
    expect(g.store.readArchive()).toHaveLength(1);
  });

  test('incomplete entries are dropped and the good ones kept', () => {
    const good = { pgn: '1. e4 e5 *', result: '*', opponent: 'Two players', moves: 2 };
    const value = JSON.stringify([
      { ...good, date: '2026-11-14T10:00:00.000Z' },
      { ...good, date: 'last Tuesday' },
      { ...good, date: '2026-11-13T10:00:00.000Z', moves: 'two' },
    ]);
    const g = loadGame({ storage: { [KEY]: value } });
    expect(g.store.readArchive()).toHaveLength(1);
  });

  describe('deleting', () => {
    /** Three past games, newest first: 1. c4, 1. d4, 1. e4. */
    const threeGames = () => {
      const g = loadGame();
      for (const move of ['e2e4', 'd2d4', 'c2c4']) {
        g.play(move);
        g.game.resetGame();
      }
      g.ui.openImportDialog();
      return g;
    };
    const firstMoves = (g) => g.store.readArchive().map((entry) => /1\. (\w+)/.exec(entry.pgn)[1]);
    const announced = (g) => el(g, 'announcer').textContent;

    test('a game is deleted on the second click, and the focus stays in the list', () => {
      const g = threeGames();
      expect(deletes(g)[1].getAttribute('aria-label')).toMatch(/^Delete .*Two players/);

      deletes(g)[1].click();
      expect(deletes(g)[1].textContent).toBe('Delete?');
      expect(firstMoves(g)).toEqual(['c4', 'd4', 'e4']); // Not yet

      deletes(g)[1].click();
      expect(firstMoves(g)).toEqual(['c4', 'e4']);
      expect(entries(g)).toHaveLength(2);
      expect(g.window.document.activeElement).toBe(deletes(g)[1]); // The entry that moved up
      expect(announced(g)).toBe('Game deleted.');
      expect(el(g, 'import-dialog').hidden).toBe(false);
      expect(g.game.moveHistory).toHaveLength(0); // The game on the board is untouched
    });

    test('deleting the last entry moves the focus to the one above, then out of the list', () => {
      const g = threeGames();
      deletes(g)[2].click();
      deletes(g)[2].click();
      expect(g.window.document.activeElement).toBe(deletes(g)[1]);

      for (let n = 0; n < 2; n++) {
        deletes(g)[0].click();
        deletes(g)[0].click();
      }
      expect(g.store.readArchive()).toEqual([]);
      expect(el(g, 'archive-section').hidden).toBe(true);
      expect(g.window.document.activeElement).toBe(el(g, 'import-text'));
    });

    test('the question is withdrawn after a while', () => {
      const g = threeGames();
      deletes(g)[0].click();
      jest.advanceTimersByTime(global.CONFIG.CONFIRM_MS);
      expect(deletes(g)[0].textContent).toBe('Delete');
      deletes(g)[0].click(); // Asks again
      expect(g.store.readArchive()).toHaveLength(3);
    });

    test('Clear all empties the list on the second click', () => {
      const g = threeGames();
      el(g, 'archive-clear').click();
      expect(el(g, 'archive-clear').textContent).toBe('Clear all?');
      expect(g.store.readArchive()).toHaveLength(3);
      el(g, 'archive-clear').click();
      expect(g.store.readArchive()).toEqual([]);
      expect(g.window.localStorage.getItem(KEY)).toBeNull();
      expect(el(g, 'archive-section').hidden).toBe(true);
      expect(announced(g)).toBe('Past games cleared.');
      expect(g.window.document.activeElement).toBe(el(g, 'import-text'));
    });

    test('removeFromArchive refuses a place that is not in the list', () => {
      const g = threeGames();
      for (const index of [-1, 3, 1.5, '1']) expect(global.removeFromArchive(index)).toBe(false);
      expect(g.store.readArchive()).toHaveLength(3);
    });

    test('a game that cannot be deleted says so', () => {
      const g = threeGames();
      const setItem = jest.spyOn(g.window.Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('full');
      });
      deletes(g)[0].click();
      deletes(g)[0].click();
      expect(el(g, 'import-error').textContent).toBe('That game could not be deleted.');
      setItem.mockRestore();
    });
  });

  test('the game goes on when storage is blocked', () => {
    const g = loadGame({ brokenStorage: true });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    g.play('e2e4');
    expect(() => g.game.resetGame()).not.toThrow();
    expect(g.store.readArchive()).toEqual([]);
    expect(g.game.moveHistory).toHaveLength(0);
    console.error.mockRestore();
  });
});
