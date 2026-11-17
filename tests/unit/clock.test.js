const { loadGame } = require('../helpers/load-game');

const el = (g, id) => g.window.document.getElementById(id);

/** Loads a game with a time control chosen, the way main.js does before the game starts. */
function timedGame(control, options = {}) {
  const g = loadGame(options);
  g.game.setTimeControl(control);
  return g;
}

describe('running low on time', () => {
  const announced = (g) => {
    const announcer = el(g, 'announcer');
    return announcer ? announcer.textContent : '';
  };
  /** Counts the low-time sounds from here on. */
  const listen = () => {
    global.playSound = jest.fn();
    return () => global.playSound.mock.calls.filter(([name]) => name === 'low_time').length;
  };

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('crossing 20 and 10 seconds each gives one announcement and one sound', () => {
    const g = timedGame('1+0');
    const sounds = listen();
    g.play('e2e4'); // Black is on the clock with a minute

    jest.advanceTimersByTime(39000);
    expect(announced(g)).not.toContain('seconds left');
    expect(sounds()).toBe(0);

    jest.advanceTimersByTime(1500); // 19.5 s left
    expect(announced(g)).toBe('Black has 20 seconds left.');
    expect(sounds()).toBe(1);

    jest.advanceTimersByTime(8000); // 11.5 s left: many ticks, nothing new
    expect(announced(g)).toBe('Black has 20 seconds left.');
    expect(sounds()).toBe(1);

    jest.advanceTimersByTime(2000); // 9.5 s left
    expect(announced(g)).toBe('Black has 10 seconds left.');
    expect(sounds()).toBe(2);

    jest.advanceTimersByTime(9000); // Half a second left
    expect(announced(g)).toBe('Black has 10 seconds left.');
    expect(sounds()).toBe(2);

    jest.advanceTimersByTime(1000); // The flag falls: that is announced on its own
    expect(announced(g)).toBe('Black ran out of time. White wins.');
    expect(sounds()).toBe(2);
  });

  test('each side is warned about its own clock', () => {
    const g = timedGame('1+0');
    const sounds = listen();
    g.play('e2e4');
    jest.advanceTimersByTime(45000); // Black: 15 s
    expect(announced(g)).toBe('Black has 20 seconds left.');
    g.play('e7e5');
    jest.advanceTimersByTime(45000); // White: 15 s
    expect(announced(g)).toBe('White has 20 seconds left.');
    g.play('g1f3');
    jest.advanceTimersByTime(2000); // Black: 13 s, already warned at 20
    expect(announced(g)).not.toContain('seconds left');
    expect(sounds()).toBe(2);
    jest.advanceTimersByTime(4000); // Black: 9 s
    expect(announced(g)).toBe('Black has 10 seconds left.');
    expect(sounds()).toBe(3);
  });

  test('an increment that takes the clock back above a threshold lets it warn again', () => {
    const g = timedGame('3+2');
    const sounds = listen();
    g.play('e2e4');
    g.game.clock.remaining.b = 9500; // Already under both thresholds: one warning, the nearer one
    jest.advanceTimersByTime(600); // Black: 8.9 s
    expect(announced(g)).toBe('Black has 10 seconds left.');
    expect(sounds()).toBe(1);

    g.play('e7e5'); // Black gains two seconds: 10.9 s
    g.play('g1f3');
    jest.advanceTimersByTime(400); // 10.5 s: above ten again, still under twenty
    expect(announced(g)).not.toContain('seconds left');
    expect(sounds()).toBe(1);
    jest.advanceTimersByTime(1000); // 9.5 s: down past ten a second time
    expect(announced(g)).toBe('Black has 10 seconds left.');
    expect(sounds()).toBe(2);
  });

  test('the warning sound is a sound the settings know', () => {
    const g = loadGame();
    expect(global.CONFIG.SOUNDS.LOW_TIME.length).toBeGreaterThan(0);
    expect(global.CONFIG.LOW_TIME_WARNINGS).toEqual([20000, 10000]);
    expect(() => g.utils.playSound('low_time')).not.toThrow();
  });
});

describe('the computer on the clock', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('with plenty of time it pauses before it moves, as in a game without a clock', () => {
    const g = loadGame();
    g.game.setTimeControl('5+0');
    g.game.setOpponent('easy', 'w');
    g.play('e2e4');
    jest.advanceTimersByTime(global.CONFIG.AI_MOVE_DELAY_MS - 50);
    expect(g.game.moveHistory).toHaveLength(1);
    jest.advanceTimersByTime(50);
    expect(g.game.moveHistory).toHaveLength(2);
    g.game.setOpponent(null);
  });

  test('with under ten seconds left it moves without the pause', () => {
    const g = loadGame();
    g.game.setTimeControl('1+0');
    g.game.setOpponent('easy', 'w');
    g.game.clock.remaining.b = 9000;
    g.play('e2e4');
    jest.advanceTimersByTime(20); // Far less than the usual pause
    expect(g.game.moveHistory).toHaveLength(2);
    expect(g.game.clock.remaining.b).toBeGreaterThan(8900);
    g.game.setOpponent(null);
  });
});

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

  test('a move made after the flag falls is not played', () => {
    const g = timedGame('3+2');
    g.play('e2e4'); // Black is on the clock, with the increment still to come
    // The flag has fallen, but no tick has been able to run since
    g.game.clock.remaining.b = 0;
    g.play('e7e5');
    expect(g.game.isGameOver).toBe(true);
    expect(g.game.gameResult).toBe('1-0');
    expect(g.game.currentStatus).toBe('Black ran out of time. White wins.');
    expect(g.at('e7').type).toBe(g.pieces.PAWN); // The move was not played
    expect(g.at('e5')).toBeNull();
    expect(g.game.clock.remaining.b).toBe(0); // The increment was not credited
    expect(el(g, 'clock-black').textContent).toBe('0:00.0');
    expect(g.game.buildPGN()).toContain('{Black ran out of time. White wins.} 1-0');
    expect(g.game.isBoardLocked()).toBe(true);
    // The ticking has stopped; the timers the first move left are not this test's
    expect(g.game.clock.turnStartedAt).toBeNull();
    jest.clearAllTimers();
  });

  test('formats times, with tenths in the last ten seconds', () => {
    const g = loadGame();
    expect(g.clockRules.formatClock(600000)).toBe('10:00');
    expect(g.clockRules.formatClock(59001)).toBe('1:00');
    expect(g.clockRules.formatClock(10000)).toBe('0:10');
    expect(g.clockRules.formatClock(9400)).toBe('0:09.4');
    expect(g.clockRules.formatClock(0)).toBe('0:00.0');
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

  test('who could still give mate is decided by the rules, not by the game', () => {
    const g = loadGame();
    const mates = (placement, color = 'w') => {
      g.setPosition({ e1: 'wk*', e8: 'bk*', ...placement });
      return g.rules.canDeliverMate(g.game.boardState, color);
    };
    expect(mates({})).toBe(false); // A lone king
    expect(mates({ b1: 'wn*' })).toBe(false);
    expect(mates({ c1: 'wb*' })).toBe(false);
    expect(mates({ c1: 'wb*', a3: 'wb*' })).toBe(false); // Two bishops on dark squares
    expect(mates({ c1: 'wb*', f1: 'wb*' })).toBe(true); // One on each colour
    expect(mates({ b1: 'wn*', g1: 'wn*' })).toBe(true);
    expect(mates({ a2: 'wp*' })).toBe(true);
    expect(mates({ a1: 'wr*' })).toBe(true);
    expect(mates({ a1: 'wr*' }, 'b')).toBe(false); // Black has only its king
    // A board on which nobody can mate is one on which neither side can
    g.setPosition({ e1: 'wk*', e8: 'bk*', c1: 'wb*', a3: 'wb*' });
    expect(g.rules.hasInsufficientMaterial(g.game.boardState)).toBe(true);
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
    const stored = () => JSON.parse(first.window.localStorage.getItem('chessGameState'));
    expect(stored().clock.remaining.w).toBe(300000); // As of the last move
    first.window.dispatchEvent(new first.window.Event('pagehide')); // The page is being closed
    expect(stored().clock.remaining.w).toBe(280000);
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

  test('closing the page before the first move saves nothing', () => {
    const g = timedGame('5+0');
    g.window.dispatchEvent(new g.window.Event('pagehide'));
    expect(g.window.localStorage.getItem('chessGameState')).toBeNull();
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
