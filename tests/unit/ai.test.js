const { loadGame } = require('../helpers/load-game');

const alg = (g, move) =>
  move && g.utils.coordsToAlgebraic(move.from.row, move.from.col) + g.utils.coordsToAlgebraic(move.to.row, move.to.col);
const first = () => 0; // A fixed "random" choice, so results do not vary between runs
const statusText = (g) => g.window.document.getElementById('game-status').textContent;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('choosing a move', () => {
  test.each(['easy', 'medium', 'hard'])('%s plays a legal move from the start position', (level) => {
    const g = loadGame();
    const move = g.ai.chooseAIMove(g.game.livePosition(), 'w', level, first);
    const legal = g.game.generateAllLegalMoves('w').map((m) => alg(g, m));
    expect(legal).toContain(alg(g, move));
    expect(move.promotion).toBe('q');
  });

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

  test('the board ignores the player while it is the computer\'s turn', () => {
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

  test('undo takes back the reply as well, so it is the player\'s turn', () => {
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
    const g = loadGame({ configure: (config) => { config.FEATURES.AI_OPPONENT = false; } });
    g.game.setOpponent('hard', 'w');
    expect(g.game.computerColor()).toBeNull();
    g.play('e2e4');
    jest.runAllTimers();
    expect(g.game.moveHistory).toHaveLength(1);
  });
});

describe('opponent settings', () => {
  function startApp(storage = {}) {
    const g = loadGame({ storage });
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
    return { ...g, doc, opponent, side, choose, stored: (key) => g.window.localStorage.getItem(key) };
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
});
