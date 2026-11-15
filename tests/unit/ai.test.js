const { loadGame } = require('../helpers/load-game');

const alg = (g, move) =>
  move &&
  g.utils.coordsToAlgebraic(move.from.row, move.from.col) +
    g.utils.coordsToAlgebraic(move.to.row, move.to.col);
const first = () => 0; // A fixed "random" choice, so results do not vary between runs
const last = () => 0.99; // Another one; for the easy level it means "no blunder this move"
const statusText = (g) => g.window.document.getElementById('game-status').textContent;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('choosing a move', () => {
  test.each(['easy', 'medium', 'hard'])(
    '%s plays a legal move from the start position',
    (level) => {
      const g = loadGame();
      const move = g.ai.chooseAIMove(g.game.livePosition(), 'w', level, first);
      const legal = g.game.generateAllLegalMoves('w').map((m) => alg(g, m));
      expect(legal).toContain(alg(g, move));
      expect(move.promotion).toBe('q');
    }
  );

  test('an unknown level plays like easy instead of failing', () => {
    const g = loadGame();
    expect(g.ai.chooseAIMove(g.game.livePosition(), 'w', 'grandmaster', first)).not.toBeNull();
  });

  test.each(['medium', 'hard'])('%s finds mate in one', (level) => {
    const g = loadGame();
    g.setPosition({ g6: 'wk*', a1: 'wr*', h8: 'bk*' });
    expect(alg(g, g.ai.chooseAIMove(g.game.livePosition(), 'w', level, first))).toBe('a1a8');
  });

  test.each(['medium', 'hard'])('%s takes a queen that is left hanging', (level) => {
    const g = loadGame();
    g.setPosition({ e1: 'wk*', c3: 'wn*', h8: 'bk*', d5: 'bq*' });
    expect(alg(g, g.ai.chooseAIMove(g.game.livePosition(), 'w', level, first))).toBe('c3d5');
  });

  describe('easy', () => {
    test('finds mate in one and takes a hanging queen when it does not blunder', () => {
      const mate = loadGame();
      mate.setPosition({ g6: 'wk*', a1: 'wr*', h8: 'bk*' });
      expect(alg(mate, mate.ai.chooseAIMove(mate.game.livePosition(), 'w', 'easy', last))).toBe(
        'a1a8'
      );

      const queen = loadGame();
      queen.setPosition({ e1: 'wk*', c3: 'wn*', h8: 'bk*', d5: 'bq*' });
      expect(alg(queen, queen.ai.chooseAIMove(queen.game.livePosition(), 'w', 'easy', last))).toBe(
        'c3d5'
      );
    });

    test('plays any legal move when it blunders', () => {
      const g = loadGame();
      g.setPosition({ e1: 'wk*', c3: 'wn*', h8: 'bk*', d5: 'bq*' });
      const position = g.game.livePosition();
      const legal = g.game.generateAllLegalMoves('w').map((m) => alg(g, m));
      // The first number decides on the blunder, the second picks the move
      const picks =
        (...numbers) =>
        () =>
          numbers.shift();
      expect(alg(g, g.ai.chooseAIMove(position, 'w', 'easy', picks(0.29, 0)))).toBe(legal[0]);
      expect(alg(g, g.ai.chooseAIMove(position, 'w', 'easy', picks(0.29, 0.99)))).toBe(
        legal[legal.length - 1]
      );
      expect(legal[0]).not.toBe('c3d5');
      expect(alg(g, g.ai.chooseAIMove(position, 'w', 'easy', picks(0.3, 0)))).toBe('c3d5');
    });

    test('blunders about three moves in ten', () => {
      expect(loadGame().ai.AI_LEVELS.easy).toEqual({ depth: 1, blunder: 0.3, tolerance: 150 });
    });
  });

  test('medium and hard are searched in full, without blunders', () => {
    const levels = loadGame().ai.AI_LEVELS;
    expect(levels.medium).toEqual({ depth: 2 });
    expect(levels.hard).toEqual({ depth: 3, timeMs: 1000, maxDepth: 8 });
  });

  test.each(['medium', 'hard'])('%s does not give its queen away for a defended pawn', (level) => {
    const g = loadGame();
    g.setPosition({ e1: 'wk*', d1: 'wq*', g8: 'bk*', d5: 'bp*', e6: 'bp*' });
    expect(alg(g, g.ai.chooseAIMove(g.game.livePosition(), 'w', level, first))).not.toBe('d1d5');
  });

  test('returns null when there is no legal move', () => {
    const g = loadGame();
    g.setPosition({ a8: 'bk*', c7: 'wk*', b6: 'wq*' });
    expect(g.ai.chooseAIMove(g.game.livePosition(), 'b', 'hard', first)).toBeNull();
  });

  test('evaluation is symmetric and counts material', () => {
    const g = loadGame();
    const start = g.game.livePosition();
    expect(g.ai.evaluatePosition(start, 'w')).toBe(0);
    g.setPosition({ e1: 'wk*', e8: 'bk*', a1: 'wr*' });
    const up = g.game.livePosition();
    expect(g.ai.evaluatePosition(up, 'w')).toBeGreaterThan(400);
    expect(g.ai.evaluatePosition(up, 'b')).toBe(-g.ai.evaluatePosition(up, 'w'));
  });
});

describe('playing against the computer', () => {
  test('it replies to the player and hands the turn back', () => {
    const g = loadGame();
    g.game.setOpponent('easy', 'w');
    expect(g.game.computerColor()).toBe('b');
    g.play('e2e4');
    expect(statusText(g)).toBe("Black's turn (computer is thinking)");
    expect(g.game.isBoardLocked()).toBe(true);

    jest.runAllTimers();
    expect(g.game.moveHistory).toHaveLength(2);
    expect(g.game.currentPlayer).toBe('w');
    expect(statusText(g)).toBe("White's turn");
    expect(g.game.isBoardLocked()).toBe(false);
  });

  test("the board ignores the player while it is the computer's turn", () => {
    const g = loadGame();
    g.game.setOpponent('easy', 'w');
    g.play('e2e4');
    g.game.handleBoardClick(1, 4); // A black pawn: the computer's piece
    expect(g.board.selectedSquare).toBeNull();
  });

  test('it moves first when the player takes Black, and again after New Game', () => {
    const g = loadGame();
    g.game.setOpponent('medium', 'b');
    expect(g.game.computerColor()).toBe('w');
    jest.runAllTimers();
    expect(g.game.moveHistory).toHaveLength(1);
    expect(g.game.currentPlayer).toBe('b');

    g.game.resetGame();
    expect(g.game.moveHistory).toHaveLength(0);
    jest.runAllTimers();
    expect(g.game.moveHistory).toHaveLength(1);
  });

  test("undo takes back the reply as well, so it is the player's turn", () => {
    const g = loadGame();
    g.game.setOpponent('easy', 'w');
    g.play('e2e4');
    jest.runAllTimers();
    g.play('d2d4');
    jest.runAllTimers();
    expect(g.game.moveHistory).toHaveLength(4);

    g.game.undoLastMove();
    expect(g.game.moveHistory).toHaveLength(2);
    expect(g.game.currentPlayer).toBe('w');
    expect(g.at('d2').type).toBe('p');
  });

  test('undo while the computer is thinking drops its move', () => {
    const g = loadGame();
    g.game.setOpponent('easy', 'w');
    g.play('e2e4');
    g.game.undoLastMove();
    jest.runAllTimers();
    expect(g.game.moveHistory).toHaveLength(0);
    expect(statusText(g)).toBe("White's turn");
  });

  test('switching to two players drops a move that was on its way', () => {
    const g = loadGame();
    g.game.setOpponent('easy', 'w');
    g.play('e2e4');
    g.game.setOpponent(null);
    jest.runAllTimers();
    expect(g.game.moveHistory).toHaveLength(1);
    expect(g.game.computerColor()).toBeNull();
    expect(statusText(g)).toBe("Black's turn");
  });

  test('switching the computer on in the middle of a game makes it move if it is its turn', () => {
    const g = loadGame();
    g.play('e2e4');
    g.game.setOpponent('easy', 'w');
    jest.runAllTimers();
    expect(g.game.moveHistory).toHaveLength(2);
  });

  test('it can end the game, and then stays quiet', () => {
    const g = loadGame();
    g.setPosition({ g6: 'wk*', a1: 'wr*', h8: 'bk*' });
    g.game.setOpponent('medium', 'b');
    jest.runAllTimers();
    expect(g.game.isGameOver).toBe(true);
    expect(statusText(g)).toBe('Checkmate! White wins.');
    expect(g.game.moveHistory).toHaveLength(1);
    expect(g.game.buildPGN()).toContain('[White "Computer (medium)"]');
  });

  test('with the feature off there is no computer opponent', () => {
    const g = loadGame({
      configure: (config) => {
        config.FEATURES.AI_OPPONENT = false;
      },
    });
    g.game.setOpponent('hard', 'w');
    expect(g.game.computerColor()).toBeNull();
    g.play('e2e4');
    jest.runAllTimers();
    expect(g.game.moveHistory).toHaveLength(1);
  });
});

describe('opponent settings', () => {
  function startApp(storage = {}, options = {}) {
    const g = loadGame({ storage, ...options });
    const doc = g.window.document;
    const select = (id, values) => {
      const wrapper = doc.createElement('div');
      wrapper.id = id.replace('-select', '-setting');
      const element = doc.createElement('select');
      element.id = id;
      for (const value of values) {
        const option = doc.createElement('option');
        option.value = value;
        element.appendChild(option);
      }
      wrapper.appendChild(element);
      doc.body.appendChild(wrapper);
      return element;
    };
    const opponent = select('opponent-select', ['human', 'easy', 'medium', 'hard']);
    const side = select('side-select', ['w', 'b']);
    const flip = doc.createElement('input');
    flip.type = 'checkbox';
    flip.id = 'flip-toggle';
    doc.body.appendChild(flip);
    Object.assign(global, {
      initializeGame: g.game.initializeGame,
      setBoardFlipped: g.board.setBoardFlipped,
      setOpponent: g.game.setOpponent,
    });
    require('../../js/main');
    doc.dispatchEvent(new g.window.Event('DOMContentLoaded'));
    const choose = (element, value) => {
      element.value = value;
      element.dispatchEvent(new g.window.Event('change'));
    };
    return {
      ...g,
      doc,
      opponent,
      side,
      flip,
      boardIsFlipped: () => doc.getElementById('chess-board').classList.contains('flipped'),
      choose,
      stored: (key) => g.window.localStorage.getItem(key),
    };
  }

  test('two players by default, with the side selector hidden', () => {
    const app = startApp();
    expect(app.opponent.value).toBe('human');
    expect(app.game.computerColor()).toBeNull();
    expect(app.doc.getElementById('side-setting').hidden).toBe(true);
  });

  test('are restored from storage', () => {
    const app = startApp({ opponent: 'easy', playerSide: 'b' });
    expect(app.opponent.value).toBe('easy');
    expect(app.side.value).toBe('b');
    expect(app.game.computerColor()).toBe('w');
    expect(app.doc.getElementById('side-setting').hidden).toBe(false);
  });

  test('a value that is not a level falls back to two players', () => {
    const app = startApp({ opponent: 'impossible', playerSide: 'x' });
    expect(app.opponent.value).toBe('human');
    expect(app.side.value).toBe('w');
    expect(app.game.computerColor()).toBeNull();
  });

  test('changing them applies at once and is saved', () => {
    const app = startApp();
    app.choose(app.opponent, 'hard');
    expect(app.game.computerColor()).toBe('b');
    expect(app.stored('opponent')).toBe('hard');
    expect(app.doc.getElementById('side-setting').hidden).toBe(false);

    app.choose(app.side, 'b');
    expect(app.game.computerColor()).toBe('w');
    expect(app.stored('playerSide')).toBe('b');

    app.choose(app.opponent, 'human');
    expect(app.game.computerColor()).toBeNull();
    expect(app.stored('opponent')).toBe('human');
  });

  test('choosing a side turns the board to it, and Flip board still overrides', () => {
    const app = startApp({ opponent: 'easy' });
    app.choose(app.side, 'b');
    expect(app.boardIsFlipped()).toBe(true);
    expect(app.flip.checked).toBe(true);
    expect(app.stored('flipBoard')).toBe('true');

    app.flip.checked = false;
    app.flip.dispatchEvent(new app.window.Event('change'));
    expect(app.boardIsFlipped()).toBe(false);
    expect(app.stored('flipBoard')).toBe('false');

    app.choose(app.side, 'w');
    expect(app.boardIsFlipped()).toBe(false);
    app.choose(app.side, 'b');
    app.choose(app.side, 'w');
    expect(app.boardIsFlipped()).toBe(false);
    expect(app.flip.checked).toBe(false);
    expect(app.stored('flipBoard')).toBe('false');
  });

  test('starting with Black saved does not turn a board the player had turned back', () => {
    const app = startApp({ opponent: 'easy', playerSide: 'b', flipBoard: 'false' });
    expect(app.boardIsFlipped()).toBe(false);
    expect(app.flip.checked).toBe(false);
  });

  /** Starts the page as a browser does: settings and a saved game in storage, then main.js. */
  function reopen(moves) {
    const earlier = loadGame();
    earlier.play(...moves);
    const key = global.CONFIG.STORAGE_KEYS.GAME_STATE;
    const saved = earlier.window.localStorage.getItem(key);
    return startApp({ opponent: 'easy', playerSide: 'b', [key]: saved }, { deferStart: true });
  }

  test("reopening a game on the player's turn as Black plays no computer move", () => {
    const app = reopen(['e2e4', 'e7e5', 'g1f3']);
    jest.runAllTimers();
    expect(app.game.moveHistory.map((m) => m.notation)).toEqual(['e4', 'e5', 'Nf3']);
    expect(app.game.currentPlayer).toBe('b');
    expect(statusText(app)).toBe("Black's turn");
  });

  test('reopening a finished game adds no move', () => {
    const app = reopen(['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    jest.runAllTimers();
    expect(app.game.isGameOver).toBe(true);
    expect(app.game.moveHistory).toHaveLength(4);
  });

  test("reopening a game on the computer's turn still gets its move", () => {
    const app = reopen(['e2e4', 'e7e5']);
    jest.runAllTimers();
    expect(app.game.moveHistory).toHaveLength(3);
    expect(app.game.currentPlayer).toBe('b');
  });
});
