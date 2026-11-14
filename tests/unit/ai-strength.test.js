const { loadGame } = require('../helpers/load-game');

const first = () => 0; // A fixed "random" choice, so results do not vary between runs
const alg = (g, move) =>
  g.utils.coordsToAlgebraic(move.from.row, move.from.col) +
  g.utils.coordsToAlgebraic(move.to.row, move.to.col);

/** A position for the rules and the engine, from a placement like setPosition takes. */
function positionOf(g, placement) {
  g.setPosition(placement);
  return g.game.livePosition();
}

describe('underpromotion', () => {
  // f8=N is mate; f8=Q is not even check, and fxg8=Q+ loses the queen
  const placement = { g5: 'wk*', f7: 'wp*', h7: 'bk*', g8: 'bn*', h8: 'bb*', g7: 'bp' };

  test.each(['medium', 'hard'])('%s promotes to a knight when that is mate', (level) => {
    const g = loadGame();
    const move = g.ai.chooseAIMove(positionOf(g, placement), 'w', level, first);
    expect(alg(g, move)).toBe('f7f8');
    expect(move.promotion).toBe('n');
  });

  test('the knight promotion really is mate, and the game plays it', () => {
    const g = loadGame();
    const position = positionOf(g, placement);
    const move = g.ai.chooseAIMove(position, 'w', 'hard', first);
    g.game.makeMove(move.from.row, move.from.col, move.to.row, move.to.col, move.promotion);
    expect(g.game.isGameOver).toBe(true);
    expect(g.game.gameResult).toBe('1-0');
    expect(g.at('f8')).toMatchObject({ type: 'n', color: 'w' });
  });

  test('a queen is still the choice when nothing better is on offer', () => {
    const g = loadGame();
    const move = g.ai.chooseAIMove(
      positionOf(g, { e1: 'wk*', a7: 'wp*', h5: 'bk*' }),
      'w',
      'hard',
      first
    );
    expect(alg(g, move)).toBe('a7a8');
    expect(move.promotion).toBe('q');
  });

  test('easy still promotes to a queen', () => {
    const g = loadGame();
    const position = positionOf(g, { e1: 'wk*', a7: 'wp*', h5: 'bk*' });
    for (const pick of [0, 0.3, 0.6, 0.99]) {
      expect(g.ai.chooseAIMove(position, 'w', 'easy', () => pick).promotion).toBe('q');
    }
  });
});

describe('evaluation', () => {
  test('stays symmetric with the endgame terms', () => {
    const g = loadGame();
    const position = positionOf(g, { c3: 'wk*', a1: 'wr*', g7: 'bk*', h7: 'bp' });
    const white = g.ai.evaluatePosition(position, 'w');
    expect(g.ai.evaluatePosition(position, 'b')).toBe(-white);
    expect(white).toBeGreaterThan(300);
  });

  test('in the endgame the king is better in the centre', () => {
    const centre = loadGame();
    const rim = loadGame();
    const inCentre = centre.ai.evaluatePosition(
      positionOf(centre, { d4: 'wk*', a2: 'wp', h8: 'bk*', h7: 'bp' }),
      'w'
    );
    const onRim = rim.ai.evaluatePosition(
      positionOf(rim, { a1: 'wk*', a2: 'wp', h8: 'bk*', h7: 'bp' }),
      'w'
    );
    expect(inCentre).toBeGreaterThan(onRim);
  });

  test('the winning side wants the other king on the edge and its own king close', () => {
    const score = (placement) => {
      const g = loadGame();
      return g.ai.evaluatePosition(positionOf(g, placement), 'w');
    };
    const kingInCentre = score({ c3: 'wk*', a1: 'wr*', e5: 'bk*' });
    const kingOnEdge = score({ c3: 'wk*', a1: 'wr*', e8: 'bk*' });
    const kingsClose = score({ e6: 'wk*', a1: 'wr*', e8: 'bk*' });
    expect(kingOnEdge).toBeGreaterThan(kingInCentre);
    expect(kingsClose).toBeGreaterThan(kingOnEdge);
  });

  test('a rook on the seventh rank is worth a little more', () => {
    const score = (rook) => {
      const g = loadGame();
      const placement = {
        g1: 'wk*',
        g8: 'bk*',
        a8: 'br*',
        d1: 'wq*',
        d8: 'bq*',
        f2: 'wp',
        f7: 'bp',
      };
      placement[rook] = 'wr*';
      return g.ai.evaluatePosition(positionOf(g, placement), 'w');
    };
    expect(score('b7')).toBeGreaterThan(score('b3'));
  });
});

describe('hard level in a won ending', () => {
  test('mates with king and rook against king', () => {
    const g = loadGame();
    let position = positionOf(g, { e1: 'wk*', a1: 'wr*', e5: 'bk*' });
    let color = 'w';
    let plies = 0;
    let mated = false;
    const seen = []; // The positions so far, as the game hands them to the engine
    while (plies < 100) {
      const options = color === 'w' ? { seen } : {};
      const level = color === 'w' ? 'hard' : 'medium';
      const move = g.ai.chooseAIMove(position, color, level, first, options);
      if (!move) {
        mated = color === 'b' && g.rules.isInCheck(position, 'b');
        break;
      }
      seen.push(g.rules.positionKey(position.board, color, position.enPassantTarget));
      position = g.rules.applyMove(position, move.from, move.to, move.promotion).position;
      color = color === 'w' ? 'b' : 'w';
      plies++;
    }
    expect(mated).toBe(true);
    expect(plies).toBeLessThan(100); // Well inside the fifty-move rule
  });
});

describe('search options', () => {
  test('a depth can be given in place of the level’s own', () => {
    const g = loadGame();
    // Mate in two: 1. Ra8+ is not it; the engine needs three half-moves to see 1. Kg6 and 2. Ra8#
    const position = positionOf(g, { f6: 'wk*', a1: 'wr*', h8: 'bk*' });
    const deep = g.ai.chooseAIMove(position, 'w', 'medium', first, { depth: 3 });
    expect(['f6g6', 'f6f7']).toContain(alg(g, deep)); // Kf7 and 2. Rh1# works as well
  });

  test('when better, it does not go back to a position the game has been through', () => {
    const g = loadGame();
    const position = positionOf(g, { c3: 'wk*', a1: 'wr*', e5: 'bk*' });
    const free = g.ai.chooseAIMove(position, 'w', 'hard', first);
    const after = g.rules.applyMove(position, free.from, free.to).position;
    const seen = [g.rules.positionKey(after.board, 'b', after.enPassantTarget)];
    const again = g.ai.chooseAIMove(position, 'w', 'hard', first, { seen });
    expect(alg(g, again)).not.toBe(alg(g, free));
  });

  test('the game tells the engine which positions have occurred', () => {
    jest.useFakeTimers();
    try {
      const g = loadGame();
      const spy = jest.spyOn(global, 'chooseAIMove');
      g.game.setOpponent('medium', 'w');
      g.play('e2e4');
      jest.runAllTimers();
      const options = spy.mock.calls[spy.mock.calls.length - 1][4];
      expect(options.seen).toHaveLength(1); // The starting position, before 1. e4
      spy.mockRestore();
    } finally {
      jest.useRealTimers();
    }
  });

  test('a timed search returns a legal move within its allowance', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5', 'g1f3', 'b8c6');
    const position = g.game.livePosition();
    const legal = g.game.generateAllLegalMoves('w').map((move) => alg(g, move));
    const started = Date.now();
    const move = g.ai.chooseAIMove(position, 'w', 'hard', first, { timed: true });
    const elapsed = Date.now() - started;
    expect(legal).toContain(alg(g, move));
    expect(elapsed).toBeLessThan(g.ai.AI_LEVELS.hard.timeMs * 4);
  });

  test('a timed search still finds a mate at once', () => {
    const g = loadGame();
    const position = positionOf(g, { g6: 'wk*', a1: 'wr*', h8: 'bk*' });
    const started = Date.now();
    const move = g.ai.chooseAIMove(position, 'w', 'hard', first, { timed: true });
    expect(alg(g, move)).toBe('a1a8');
    expect(Date.now() - started).toBeLessThan(500);
  });

  test('levels without a time allowance ignore the timed option', () => {
    const g = loadGame();
    const position = g.game.livePosition();
    const plain = g.ai.chooseAIMove(position, 'w', 'medium', first);
    const timed = g.ai.chooseAIMove(position, 'w', 'medium', first, { timed: true });
    expect(alg(g, timed)).toBe(alg(g, plain));
  });
});
