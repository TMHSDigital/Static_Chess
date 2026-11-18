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

  test('every position on the way back to the start is the one that was played', () => {
    const moves = ['e2e4', 'd7d5', 'e4d5', 'd8d5', 'b1c3', 'd5a5', 'g1f3', 'c8g4', 'f1e2', 'e7e6'];
    const first = loadGame();
    const played = [first.snapshot()];
    for (const move of moves) {
      first.play(move);
      played.push(first.snapshot());
    }

    const second = loadGame({ storage: { [KEY]: first.window.localStorage.getItem(KEY) } });
    for (let ply = moves.length; ply >= 0; ply--) {
      expect(second.snapshot()).toEqual(played[ply]);
      expect(second.game.isGameOver).toBe(false);
      second.game.undoLastMove();
    }
    expect(second.game.moveHistory).toHaveLength(0);
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

  test('a saved position is checked field by field, the same fields the game keeps', () => {
    const g = loadGame();
    g.play('e2e4');
    const live = g.game.currentSnapshot();
    const checked = global.cleanSnapshot(JSON.parse(JSON.stringify(live)), '');
    expect(Object.keys(checked).sort()).toEqual(Object.keys(live).sort());
  });

  test('a game reloaded near the fifty-move rule counts on as it was played', () => {
    const seed = loadGame();
    seed.setPosition({ a1: 'wk*', h8: 'bk*', b2: 'wr*', g7: 'br*' });
    seed.game.startGameFrom(seed.game.livePosition(), 'w', 96);
    seed.play('b2b3', 'g7g6'); // 98 half-moves without a pawn move or capture
    const g = loadGame({ storage: { [KEY]: seed.window.localStorage.getItem(KEY) } });
    expect(g.game.halfmoveClock).toBe(98);
    expect(g.game.positionHistory.map((past) => past.halfmoveClock)).toEqual([96, 97]);

    g.game.undoLastMove(); // The counter comes back from the rebuilt undo stack
    expect(g.game.halfmoveClock).toBe(97);
    g.play('g7g6', 'b3b4');
    expect(g.game.isGameOver).toBe(false);
    g.play('g6g5');
    expect(g.game.halfmoveClock).toBe(100);
    expect(g.game.currentStatus).toBe('Draw by the fifty-move rule.');
  });

  test('the undo stack is not saved, but played again from the moves', () => {
    const first = loadGame();
    first.play('e2e4', 'e7e5', 'g1f3');
    const saved = JSON.parse(first.window.localStorage.getItem(KEY));
    expect(saved).not.toHaveProperty('positionHistory');
    const second = loadGame({ storage: { [KEY]: JSON.stringify(saved) } });
    expect(second.game.positionHistory).toHaveLength(3);
    expect(second.game.positionHistory[1].currentStatus).toBe("Black's turn");
  });

  test('a game begun from FEN gets its undo stack back too', () => {
    const first = loadGame();
    first.game.importFEN('4k3/8/8/8/8/8/4P3/4K2R w K - 7 30');
    first.play('e1g1', 'e8d7', 'e2e4');
    const before = first.snapshot();
    const second = loadGame({ storage: { [KEY]: first.window.localStorage.getItem(KEY) } });
    expect(second.snapshot()).toEqual(before);
    second.game.undoLastMove();
    second.game.undoLastMove();
    second.game.undoLastMove();
    expect(second.game.buildFEN()).toBe('4k3/8/8/8/8/8/4P3/4K2R w K - 7 30');
  });

  test('moves that do not lead to the saved position give no undo stack', () => {
    const first = loadGame();
    first.play('e2e4');
    const saved = JSON.parse(first.window.localStorage.getItem(KEY));
    delete saved.version;
    saved.moveHistory[0].to = { row: 5, col: 4 }; // Says e3, but the pawn is on e4
    const second = loadGame({ storage: { [KEY]: JSON.stringify(saved) } });
    expect(second.at('e4').type).toBe('p');
    expect(second.window.document.getElementById('undo-button').disabled).toBe(true);
  });

  test('an older save that carries its own undo stack still uses it when the moves cannot be played', () => {
    const first = loadGame();
    first.play('e2e4');
    const saved = JSON.parse(first.window.localStorage.getItem(KEY));
    saved.positionHistory = [
      {
        boardState: first.rules.initialPosition().board,
        currentPlayer: 'w',
        enPassantTarget: null,
        currentStatus: "White's turn",
      },
    ];
    saved.moveHistory[0].from = { row: 6, col: 3 }; // A damaged move: d2 to e4
    const second = loadGame({ storage: { [KEY]: JSON.stringify(saved) } });
    second.game.undoLastMove();
    expect(second.at('e2').type).toBe('p');
    expect(second.game.moveHistory).toHaveLength(0);
  });

  test('a 200-ply game saves in well under 100 KB, and its undo stack comes back', () => {
    const g = loadGame();
    const moves = Array.from(
      { length: 50 },
      (_, n) => `${2 * n + 1}. Nf3 Nf6 ${2 * n + 2}. Ng1 Ng8`
    );
    expect(g.game.importPGN(moves.join(' ')).moves).toBe(200);
    const saved = g.window.localStorage.getItem(KEY);
    expect(saved.length).toBeLessThan(100 * 1024);

    const again = loadGame({ storage: { [KEY]: saved } });
    expect(again.game.positionHistory).toHaveLength(200);
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
