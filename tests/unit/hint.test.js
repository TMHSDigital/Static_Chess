const { loadGame } = require('../helpers/load-game');

describe('Hint', () => {
  const button = (g) => g.window.document.getElementById('hint-button');
  const marked = (g) => ({
    from: g.window.document.querySelectorAll('.square.hint-from').length,
    to: g.window.document.querySelectorAll('.square.hint-to').length,
  });

  // What is marked and when it is removed does not depend on how good the hint is,
  // so those tests ask the quick level. "finds a mate in one" keeps the real one.
  const quickHints = {
    configure: (config) => {
      config.HINT_LEVEL = 'easy';
    },
  };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('marks a legal move for the side to move without playing it', () => {
    const g = loadGame(quickHints);
    g.play('e2e4');
    button(g).click();
    expect(button(g).disabled).toBe(true);
    jest.runOnlyPendingTimers();

    const hint = g.game.hintMove;
    const legal = g.game.generateLegalMovesForPiece(hint.from.row, hint.from.col);
    expect(legal.some((m) => m.row === hint.to.row && m.col === hint.to.col)).toBe(true);
    expect(g.at(g.utils.coordsToAlgebraic(hint.from.row, hint.from.col)).color).toBe('b');
    expect(marked(g)).toEqual({ from: 1, to: 1 });
    expect(g.game.moveHistory).toHaveLength(1);
    expect(button(g).disabled).toBe(false);
  });

  test('finds a mate in one', () => {
    const g = loadGame();
    expect(global.CONFIG.HINT_LEVEL).toBe('hard');
    g.play('f2f3', 'e7e5', 'g2g4');
    g.game.requestHint();
    jest.runOnlyPendingTimers();
    const { from, to } = g.game.hintMove;
    expect(g.utils.coordsToAlgebraic(from.row, from.col)).toBe('d8');
    expect(g.utils.coordsToAlgebraic(to.row, to.col)).toBe('h4');
  });

  test('is cleared by a move, by undo and by New Game', () => {
    const g = loadGame(quickHints);
    const hint = () => {
      g.game.requestHint();
      jest.runOnlyPendingTimers();
      expect(marked(g).from).toBe(1);
    };
    hint();
    g.play('e2e4');
    expect(marked(g)).toEqual({ from: 0, to: 0 });
    hint();
    g.game.undoLastMove();
    expect(marked(g)).toEqual({ from: 0, to: 0 });
    hint();
    g.game.resetGame();
    expect(g.game.hintMove).toBeNull();
  });

  test('a hint still being worked out is dropped when a move is played', () => {
    const g = loadGame(quickHints);
    g.game.requestHint();
    g.play('e2e4');
    jest.runOnlyPendingTimers();
    expect(g.game.hintMove).toBeNull();
    expect(marked(g)).toEqual({ from: 0, to: 0 });
    expect(button(g).disabled).toBe(false);
  });

  test('is hidden while another position is viewed and not offered when the game is over', () => {
    const g = loadGame(quickHints);
    g.play('e2e4', 'e7e5');
    g.game.requestHint();
    jest.runOnlyPendingTimers();
    g.game.viewMove(1);
    expect(marked(g)).toEqual({ from: 0, to: 0 }); // It was for the live position
    expect(button(g).disabled).toBe(false); // A hint for this position can be asked
    g.game.returnToLiveGame();
    expect(marked(g)).toEqual({ from: 1, to: 1 });

    g.game.resign();
    expect(button(g).disabled).toBe(true);
    g.game.requestHint();
    jest.runOnlyPendingTimers();
    expect(g.game.hintMove).toBeNull();
  });

  describe('while looking back', () => {
    const announcer = (g) => g.window.document.getElementById('announcer').textContent;
    const square = (g, move) => [
      g.utils.coordsToAlgebraic(move.from.row, move.from.col),
      g.utils.coordsToAlgebraic(move.to.row, move.to.col),
    ];

    test('suggests a move for the position on screen and says the score with it', () => {
      const g = loadGame();
      g.play('f2f3', 'e7e5', 'g2g4', 'd8h4'); // Checkmate: no hint in the live position
      expect(button(g).disabled).toBe(true);

      g.game.viewMove(3); // Black to move, with a mate in one
      expect(button(g).disabled).toBe(false);
      button(g).click();
      expect(button(g).textContent).toBe('Thinking');
      jest.runOnlyPendingTimers();

      expect(square(g, g.game.hintMove)).toEqual(['d8', 'h4']);
      expect(marked(g)).toEqual({ from: 1, to: 1 });
      expect(announcer(g)).toBe(
        'Engine thinks Black can force mate. Best move here: queen from d8 to h4.'
      );
      expect(g.game.moveHistory).toHaveLength(4); // Nothing was played
      expect(g.game.isGameOver).toBe(true);
    });

    test('the marks show only on the position they were asked for', () => {
      const g = loadGame(quickHints);
      g.play('e2e4', 'e7e5', 'g1f3');
      g.game.viewMove(1);
      g.game.requestHint();
      jest.runOnlyPendingTimers();
      expect(marked(g)).toEqual({ from: 1, to: 1 });
      // The move is for the side to move in that position, Black after 1. e4
      const { row, col } = g.game.hintMove.from;
      expect(g.game.positionHistory[1].boardState[row][col].color).toBe('b');

      g.game.viewMove(2);
      expect(marked(g)).toEqual({ from: 0, to: 0 });
      g.game.returnToLiveGame();
      expect(marked(g)).toEqual({ from: 0, to: 0 });
      g.game.viewMove(1);
      expect(marked(g)).toEqual({ from: 1, to: 1 });
    });

    test('a move played in the game clears it', () => {
      const g = loadGame(quickHints);
      g.play('e2e4', 'e7e5');
      g.game.viewMove(1);
      g.game.requestHint();
      jest.runOnlyPendingTimers();
      expect(g.game.hintMove).not.toBeNull();
      g.play('g1f3');
      expect(g.game.hintMove).toBeNull();
      g.game.viewMove(1);
      expect(marked(g)).toEqual({ from: 0, to: 0 });
    });

    test('one still being worked out is dropped when the game moves on', () => {
      const g = loadGame(quickHints);
      g.play('e2e4', 'e7e5');
      g.game.viewMove(1);
      g.game.requestHint();
      g.play('g1f3');
      jest.runOnlyPendingTimers();
      expect(g.game.hintMove).toBeNull();
      expect(button(g).textContent).toBe('Hint');
    });
  });

  test('does not disturb the computer opponent', () => {
    const g = loadGame(quickHints);
    g.game.setOpponent('easy', 'w');
    g.game.requestHint();
    jest.runOnlyPendingTimers();
    expect(g.game.hintMove).not.toBeNull();
    g.play('e2e4');
    jest.runAllTimers();
    expect(g.game.moveHistory).toHaveLength(2); // The computer replied
    expect(g.game.hintMove).toBeNull();
  });
});
