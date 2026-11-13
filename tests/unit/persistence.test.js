const { loadGame } = require('../helpers/load-game');

const KEY = 'chessGameState';

/** Plays moves, then loads a second game from the same saved value. */
function reloadAfter(...moves) {
  const first = loadGame();
  first.play(...moves);
  const saved = first.window.localStorage.getItem(KEY);
  const before = first.snapshot();
  const second = loadGame({ storage: { [KEY]: saved } });
  return { before, second };
}

describe('saving and restoring', () => {
  test('a game in progress comes back exactly', () => {
    const { before, second } = reloadAfter('e2e4', 'e7e5', 'g1f3');
    expect(second.snapshot()).toEqual(before);
    expect(second.window.document.getElementById('game-status').textContent).toBe("Black's turn");
  });

  test('the en passant right survives a reload', () => {
    const { second } = reloadAfter('e2e4', 'a7a6', 'e4e5', 'd7d5');
    expect(second.movesFrom('e5')).toContain('d6');
  });

  test('king positions are right after a king move', () => {
    const { second } = reloadAfter('e2e4', 'e7e5', 'e1e2');
    expect(second.game.kingPositions.w).toEqual({ row: 6, col: 4 });
  });

  test('undo works after a reload', () => {
    const { second } = reloadAfter('e2e4', 'e7e5');
    expect(second.window.document.getElementById('undo-button').disabled).toBe(false);
    second.game.undoLastMove();
    expect(second.at('e5')).toBeNull();
    expect(second.at('e7').type).toBe('p');
    expect(second.game.moveHistory).toHaveLength(1);
    second.game.undoLastMove();
    expect(second.game.moveHistory).toHaveLength(0);
    expect(second.window.document.getElementById('undo-button').disabled).toBe(true);
  });

  test('a save without an undo stack still loads, with Undo disabled', () => {
    const first = loadGame();
    first.play('e2e4');
    const saved = JSON.parse(first.window.localStorage.getItem(KEY));
    delete saved.positionHistory;
    delete saved.version;
    const second = loadGame({ storage: { [KEY]: JSON.stringify(saved) } });
    expect(second.at('e4').type).toBe('p');
    expect(second.window.document.getElementById('undo-button').disabled).toBe(true);
  });

  test('New Game removes the saved game', () => {
    const g = loadGame();
    g.play('e2e4');
    expect(g.window.localStorage.getItem(KEY)).not.toBeNull();
    g.game.resetGame();
    expect(g.window.localStorage.getItem(KEY)).toBeNull();
  });
});

describe('bad saved values start a fresh game', () => {
  const bad = {
    'invalid JSON': 'not json',
    'a string for the board': '{"boardState":"x","currentPlayer":"w","moveHistory":[1]}',
    'an empty board': '{"boardState":[],"currentPlayer":"w","moveHistory":[{}]}',
    'a number': '42',
    'a newer version': '{"version":99}',
  };

  for (const [name, value] of Object.entries(bad)) {
    test(name, () => {
      const g = loadGame({ storage: { [KEY]: value } });
      expect(g.game.moveHistory).toHaveLength(0);
      expect(g.at('e2').type).toBe('p');
      expect(g.movesFrom('e2')).toEqual(['e3', 'e4']);
      expect(g.window.localStorage.getItem(KEY)).toBeNull();
    });
  }

  test('a board with a missing king', () => {
    const first = loadGame();
    first.play('e2e4');
    const saved = JSON.parse(first.window.localStorage.getItem(KEY));
    saved.boardState[0][4] = null;
    const g = loadGame({ storage: { [KEY]: JSON.stringify(saved) } });
    expect(g.game.moveHistory).toHaveLength(0);
    expect(g.at('e8').type).toBe('k');
  });
});

describe('storage that throws', () => {
  test('the game starts and moves still work', () => {
    const g = loadGame({ brokenStorage: true });
    g.play('e2e4', 'e7e5');
    expect(g.at('e4').type).toBe('p');
    g.game.resetGame();
    expect(g.at('e2').type).toBe('p');
  });
});

describe('undo snapshots', () => {
  test('do not grow with the number of moves played', () => {
    const g = loadGame();
    g.play('g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8');
    const sizes = g.game.positionHistory.map((s) => JSON.stringify(s).length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThan(50);
    expect(g.game.positionHistory[7].moveHistory).toBeUndefined();
  });
});
