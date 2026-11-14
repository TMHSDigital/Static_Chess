const { loadGame } = require('../helpers/load-game');

describe('Hint', () => {
  const button = (g) => g.window.document.getElementById('hint-button');
  const marked = (g) => ({
    from: g.window.document.querySelectorAll('.square.hint-from').length,
    to: g.window.document.querySelectorAll('.square.hint-to').length,
  });

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('marks a legal move for the side to move without playing it', () => {
    const g = loadGame();
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
    g.play('f2f3', 'e7e5', 'g2g4');
    g.game.requestHint();
    jest.runOnlyPendingTimers();
    const { from, to } = g.game.hintMove;
    expect(g.utils.coordsToAlgebraic(from.row, from.col)).toBe('d8');
    expect(g.utils.coordsToAlgebraic(to.row, to.col)).toBe('h4');
  });

  test('is cleared by a move, by undo and by New Game', () => {
    const g = loadGame();
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
    const g = loadGame();
    g.game.requestHint();
    g.play('e2e4');
    jest.runOnlyPendingTimers();
    expect(g.game.hintMove).toBeNull();
    expect(marked(g)).toEqual({ from: 0, to: 0 });
    expect(button(g).disabled).toBe(false);
  });

  test('is hidden while an earlier position is viewed and not offered when the board is locked', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5');
    g.game.requestHint();
    jest.runOnlyPendingTimers();
    g.game.viewMove(1);
    expect(marked(g)).toEqual({ from: 0, to: 0 });
    expect(button(g).disabled).toBe(true);
    g.game.returnToLiveGame();
    expect(marked(g)).toEqual({ from: 1, to: 1 });

    g.game.resign();
    expect(button(g).disabled).toBe(true);
    g.game.requestHint();
    jest.runOnlyPendingTimers();
    expect(g.game.hintMove).toBeNull();
  });

  test('does not disturb the computer opponent', () => {
    const g = loadGame();
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
