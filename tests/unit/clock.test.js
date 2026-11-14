const { loadGame } = require('../helpers/load-game');

const el = (g, id) => g.window.document.getElementById(id);

/** Loads a game with a time control chosen, the way main.js does before the game starts. */
function timedGame(control, options = {}) {
  const g = loadGame(options);
  g.game.setTimeControl(control);
  return g;
}

describe('Chess clock', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('is off by default', () => {
    const g = loadGame();
    expect(g.game.clock).toBeNull();
    expect(el(g, 'clock-white').hidden).toBe(true);
    g.play('e2e4', 'e7e5');
    expect(g.game.buildPGN()).not.toContain('TimeControl');
  });

  test('shows the full time and waits for the first move', () => {
    const g = timedGame('5+0');
    expect(el(g, 'clock-white').hidden).toBe(false);
    expect(el(g, 'clock-white').textContent).toBe('5:00');
    expect(el(g, 'clock-black').textContent).toBe('5:00');
    jest.advanceTimersByTime(30000);
    expect(g.game.clockRemaining('w')).toBe(300000);
    expect(el(g, 'clock-white').classList.contains('running')).toBe(false);
  });

  test('times each side from the second move on', () => {
    const g = timedGame('5+0');
    g.play('e2e4');
    expect(g.game.clockRemaining('w')).toBe(300000); // White's first move is free
    expect(el(g, 'clock-black').classList.contains('running')).toBe(true);
    jest.advanceTimersByTime(10000);
    expect(g.game.clockRemaining('b')).toBe(290000);
    expect(el(g, 'clock-black').textContent).toBe('4:50');

    g.play('e7e5');
    jest.advanceTimersByTime(4000);
    expect(g.game.clockRemaining('b')).toBe(290000);
    expect(g.game.clockRemaining('w')).toBe(296000);
    expect(el(g, 'clock-white').classList.contains('running')).toBe(true);
    expect(el(g, 'clock-black').classList.contains('running')).toBe(false);
  });

  test('adds the increment after a move', () => {
    const g = timedGame('3+2');
    g.play('e2e4');
    jest.advanceTimersByTime(5000);
    g.play('e7e5');
    expect(g.game.clockRemaining('b')).toBe(180000 - 5000 + 2000);
  });

  test('formats times, with tenths in the last ten seconds', () => {
    const g = loadGame();
    expect(g.game.formatClock(600000)).toBe('10:00');
    expect(g.game.formatClock(59001)).toBe('1:00');
    expect(g.game.formatClock(10000)).toBe('0:10');
    expect(g.game.formatClock(9400)).toBe('0:09.4');
    expect(g.game.formatClock(0)).toBe('0:00.0');
  });

  test('running out of time loses the game', () => {
    const g = timedGame('1+0');
    g.play('e2e4');
    jest.advanceTimersByTime(60000 + 250);
    expect(g.game.isGameOver).toBe(true);
    expect(g.game.gameResult).toBe('1-0');
    expect(g.game.currentStatus).toBe('Black ran out of time. White wins.');
    expect(g.game.isBoardLocked()).toBe(true);
    expect(el(g, 'clock-black').textContent).toBe('0:00.0');
    expect(jest.getTimerCount()).toBe(0); // The ticking has stopped
    expect(g.game.buildPGN()).toContain('{Black ran out of time. White wins.} 1-0');
  });

  test('it is a draw when the side with time left cannot checkmate', () => {
    const g = timedGame('1+0');
    g.setPosition({ e1: 'wk*', e8: 'bk*', a7: 'bp*' });
    g.play('e1e2');
    jest.advanceTimersByTime(61000);
    expect(g.game.gameResult).toBe('1/2-1/2');
    expect(g.game.currentStatus).toBe('Black ran out of time, but White cannot checkmate. Draw.');
  });

  test('the clock stops when the game ends on the board or by resignation', () => {
    const g = timedGame('5+0');
    g.play('f2f3', 'e7e5', 'g2g4', 'd8h4');
    jest.advanceTimersByTime(400000);
    expect(g.game.gameResult).toBe('0-1');

    const h = timedGame('5+0');
    h.play('e2e4');
    jest.advanceTimersByTime(7000);
    h.game.resign();
    jest.advanceTimersByTime(400000);
    expect(h.game.clockRemaining('b')).toBe(293000);
    expect(h.game.currentStatus).toBe('Black resigned. White wins.');
  });

  test('moves cannot be taken back on the clock', () => {
    const g = timedGame('5+0');
    g.play('e2e4', 'e7e5');
    expect(el(g, 'undo-button').disabled).toBe(true);
    g.game.undoLastMove();
    expect(g.game.moveHistory).toHaveLength(2);
  });

  test('a new time control waits for the next game', () => {
    const g = timedGame('5+0');
    g.play('e2e4');
    g.game.setTimeControl('1+0');
    expect(g.game.clock.base).toBe(300000);
    g.game.resetGame();
    expect(g.game.clock.base).toBe(60000);
    expect(g.game.clockRemaining('w')).toBe(60000);

    g.game.setTimeControl('off');
    expect(g.game.clock).toBeNull();
    expect(el(g, 'clock-white').hidden).toBe(true);
  });

  test('unknown time controls mean no clock', () => {
    const g = timedGame('toString');
    expect(g.game.clock).toBeNull();
  });

  test('the times survive a reload and the clock goes on', () => {
    const first = timedGame('5+0');
    first.play('e2e4', 'e7e5');
    jest.advanceTimersByTime(20000);
    first.game.saveGameState(); // As the pagehide handler does
    const saved = first.window.localStorage.getItem('chessGameState');
    jest.clearAllTimers();

    const g = loadGame({ storage: { chessGameState: saved } });
    expect(g.game.clock.control).toBe('5+0');
    expect(g.game.clockRemaining('w')).toBe(280000);
    expect(g.game.clockRemaining('b')).toBe(300000);
    jest.advanceTimersByTime(5000);
    expect(g.game.clockRemaining('w')).toBe(275000);
    expect(el(g, 'clock-white').textContent).toBe('4:35');
  });

  test('a damaged saved clock is dropped and the game still loads', () => {
    const first = timedGame('5+0');
    first.play('e2e4');
    const saved = JSON.parse(first.window.localStorage.getItem('chessGameState'));
    saved.clock.remaining.w = 'lots';
    jest.clearAllTimers();
    const g = loadGame({ storage: { chessGameState: JSON.stringify(saved) } });
    expect(g.game.moveHistory).toHaveLength(1);
    expect(g.game.clock).toBeNull();
  });

  test('the PGN names the time control', () => {
    const g = timedGame('3+2');
    g.play('e2e4');
    expect(g.game.buildPGN()).toContain('[TimeControl "180+2"]');
  });

  test('the computer plays on the clock too', () => {
    const g = timedGame('5+0');
    g.game.setOpponent('easy', 'w');
    g.play('e2e4');
    jest.advanceTimersByTime(2000); // Long enough for the reply
    expect(g.game.moveHistory).toHaveLength(2);
    expect(g.game.clockRemaining('b')).toBeLessThan(300000);
    expect(el(g, 'clock-white').classList.contains('running')).toBe(true);
  });
});
