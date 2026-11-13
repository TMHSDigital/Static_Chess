const { loadGame } = require('../helpers/load-game');

describe('New Game button', () => {
  const button = (g) => g.window.document.getElementById('reset-button');

  test('resets at once when no move has been played', () => {
    const g = loadGame();
    button(g).click();
    expect(button(g).classList.contains('confirming')).toBe(false);
    expect(g.game.moveHistory).toHaveLength(0);
  });

  test('a game in progress needs a second click', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5');
    button(g).click();
    expect(g.game.moveHistory).toHaveLength(2);
    expect(button(g).textContent).toBe('Discard game?');
    expect(button(g).classList.contains('confirming')).toBe(true);

    button(g).click();
    expect(g.game.moveHistory).toHaveLength(0);
    expect(g.at('e2').type).toBe('p');
    expect(button(g).textContent).toBe('New Game');
    expect(button(g).classList.contains('confirming')).toBe(false);
  });

  test('the confirmation expires and the game is kept', () => {
    jest.useFakeTimers();
    try {
      const g = loadGame();
      g.play('e2e4');
      button(g).click();
      jest.advanceTimersByTime(global.CONFIG.RESET_CONFIRM_MS + 1);
      expect(button(g).textContent).toBe('New Game');
      expect(g.game.moveHistory).toHaveLength(1);
      // The next click asks again rather than discarding
      button(g).click();
      expect(g.game.moveHistory).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('a finished game resets with one click', () => {
    const g = loadGame();
    g.play('f2f3', 'e7e5', 'g2g4', 'd8h4');
    button(g).click();
    expect(g.game.moveHistory).toHaveLength(0);
  });
});

describe('PGN export', () => {
  const body = (pgn) => pgn.split('\n\n')[1].trim();

  test('has the seven standard tags', () => {
    const g = loadGame();
    g.play('e2e4');
    const tags = g.game
      .buildPGN()
      .split('\n\n')[0]
      .split('\n')
      .map((line) => line.match(/^\[(\w+) "/)[1]);
    expect(tags).toEqual(['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result']);
  });

  test('numbers the moves and marks an unfinished game', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5', 'g1f3');
    expect(body(g.game.buildPGN())).toBe('1. e4 e5 2. Nf3 *');
    expect(g.game.buildPGN()).toContain('[Result "*"]');
  });

  test('a win for Black', () => {
    const g = loadGame();
    g.play('f2f3', 'e7e5', 'g2g4', 'd8h4');
    expect(body(g.game.buildPGN())).toBe('1. f3 e5 2. g4 Qh4# 0-1');
    expect(g.game.buildPGN()).toContain('[Result "0-1"]');
  });

  test('a win for White', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6', 'h5f7');
    expect(body(g.game.buildPGN())).toBe('1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0');
  });

  test('stalemate is a draw', () => {
    const g = loadGame();
    g.setPosition({ f7: 'wk*', g5: 'wq*', h8: 'bk*' });
    g.play('g5g6');
    expect(g.game.buildPGN()).toContain('[Result "1/2-1/2"]');
  });

  test('en passant is written without the e.p. suffix', () => {
    const g = loadGame();
    g.play('e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6');
    expect(body(g.game.buildPGN())).toBe('1. e4 a6 2. e5 d5 3. exd6 *');
  });

  test('the button is disabled until a move has been played', () => {
    const g = loadGame();
    const button = g.window.document.getElementById('pgn-button');
    expect(button.disabled).toBe(true);
    g.play('e2e4');
    expect(button.disabled).toBe(false);
  });
});

describe('Undo button', () => {
  test('is hidden when the feature flag is off', () => {
    const g = loadGame({
      configure: (config) => {
        config.FEATURES.UNDO_MOVE = false;
      },
    });
    expect(g.window.document.getElementById('undo-button').hidden).toBe(true);
  });

  test('takes back the last move', () => {
    const g = loadGame();
    g.play('e2e4');
    g.window.document.getElementById('undo-button').click();
    expect(g.at('e2').type).toBe('p');
    expect(g.game.moveHistory).toHaveLength(0);
  });
});
