const { loadGame } = require('../helpers/load-game');

/**
 * The timers a game starts must not outlive the test that built it: a clock
 * left running keeps Jest alive, and a computer move still on its way is
 * played into whichever game runs next. loadGame() cleans the previous game
 * up when the next one is built and after every test; these tests pin both
 * halves, and the first one is the repro from #122.
 */
test('leaves a clock running, and Jest still exits', () => {
  const g = loadGame();
  g.game.setTimeControl('5+0');
  g.game.resetGame();
  g.play('e2e4', 'e7e5');
  // No cleanup here on purpose: the afterEach in load-game.js stops the clock.
});

test('stopAllTimers stops a running clock', () => {
  jest.useFakeTimers();
  const g = loadGame();
  g.game.setTimeControl('5+0');
  g.game.resetGame();
  g.play('e2e4', 'e7e5');
  const clockWhite = () => g.window.document.getElementById('clock-white').textContent;

  jest.advanceTimersByTime(1000); // White's clock ticks: 5:00 -> 4:59
  expect(clockWhite()).toBe('4:59');
  g.game.stopAllTimers();
  jest.advanceTimersByTime(60000); // A running clock would read 3:59 by now
  expect(clockWhite()).toBe('4:59');
  expect(g.window.document.getElementById('game-status').textContent).not.toContain(
    'ran out of time'
  );
  jest.useRealTimers();
});

test('a computer move left thinking is not played after stopAllTimers', () => {
  jest.useFakeTimers();
  const g = loadGame();
  g.game.setOpponent('easy'); // The computer plays Black
  g.play('e2e4'); // Black to move: the computer thinks
  const before = g.snapshot();

  g.game.stopAllTimers();
  jest.runAllTimers(); // The engine's answer and the reply delay both arrive now

  expect(g.snapshot()).toEqual(before);
  expect(g.at('e7')).not.toBeNull(); // No black move was played
  jest.useRealTimers();
});

test('loading a second game stops the first one and closes its window', () => {
  jest.useFakeTimers();
  const first = loadGame();
  first.game.setTimeControl('5+0');
  first.game.resetGame();
  first.play('e2e4', 'e7e5');
  const firstClock = first.window.document.getElementById('clock-white');
  jest.advanceTimersByTime(1000); // White's clock ticks: 5:00 -> 4:59
  expect(firstClock.textContent).toBe('4:59');
  const close = jest.spyOn(first.window, 'close');

  loadGame();

  expect(close).toHaveBeenCalledTimes(1); // The previous window is closed
  jest.advanceTimersByTime(60000); // A running clock would read 3:59 by now
  expect(firstClock.textContent).toBe('4:59');
  jest.useRealTimers();
});

// The next two tests run as a pair: the first ends while the computer is
// thinking, the second runs everything pending and proves the move was voided
// by the afterEach cleanup, not played on either game.
let thinking = null;

test('the previous test leaves the computer thinking', () => {
  jest.useFakeTimers();
  thinking = loadGame();
  thinking.game.setOpponent('easy');
  thinking.play('e2e4'); // Black to move: the computer thinks, and this test ends here
  // No useRealTimers(): the fake clock stays on so the next test can run the
  // pending timers and prove the move was voided.
});

test('a computer move from the previous test is not played', () => {
  jest.runAllTimers(); // The engine's answer and the reply delay both arrive now

  expect(thinking.snapshot().notations).toEqual(['e4']); // Only White's move
  expect(thinking.game.currentPlayer).toBe(thinking.pieces.BLACK); // Still Black to move
  expect(thinking.at('e4')).not.toBeNull();
  expect(thinking.at('e5')).toBeNull();
  expect(thinking.at('e7')).not.toBeNull();

  const g = loadGame(); // A fresh game starts clean
  expect(g.game.currentPlayer).toBe(g.pieces.WHITE);
  expect(g.snapshot().notations).toEqual([]);
  expect(g.at('e2')).not.toBeNull();
  expect(g.at('e7')).not.toBeNull();
  jest.useRealTimers();
});
