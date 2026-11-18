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
      jest.advanceTimersByTime(global.CONFIG.CONFIRM_MS + 1);
      expect(button(g).textContent).toBe('New Game');
      expect(g.game.moveHistory).toHaveLength(1);
      // The next click asks again rather than discarding
      button(g).click();
      expect(g.game.moveHistory).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('a move withdraws the question, as it does for Resign', () => {
    jest.useFakeTimers();
    try {
      const g = loadGame();
      g.game.setOpponent('easy', 'w');
      g.play('e2e4');
      button(g).click();
      expect(button(g).textContent).toBe('Discard game?');

      jest.runAllTimers(); // The computer replies before the second click
      expect(g.game.moveHistory).toHaveLength(2);
      expect(button(g).textContent).toBe('New Game');
      expect(button(g).classList.contains('confirming')).toBe(false);

      button(g).click(); // So this click asks again instead of discarding the game
      expect(g.game.moveHistory).toHaveLength(2);
      expect(button(g).textContent).toBe('Discard game?');
      g.game.undoLastMove(); // Undo withdraws it too
      expect(button(g).textContent).toBe('New Game');
      g.game.setOpponent(null);
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

describe('Redo', () => {
  const el = (g, id) => g.window.document.getElementById(id);
  const notations = (g) => g.game.moveHistory.map((move) => move.notation);
  const key = (g, options) => {
    const event = new g.window.KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      ...options,
    });
    g.window.document.body.dispatchEvent(event);
    return event;
  };

  test('Undo then Redo brings back the same position, status and notation', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5', 'g1f3');
    const before = g.snapshot();
    const status = g.game.currentStatus;
    expect(el(g, 'redo-button').disabled).toBe(true);

    el(g, 'undo-button').click();
    expect(el(g, 'redo-button').disabled).toBe(false);
    el(g, 'redo-button').click();
    expect(g.snapshot()).toEqual(before);
    expect(g.game.currentStatus).toBe(status);
    expect(notations(g)).toEqual(['e4', 'e5', 'Nf3']);
    expect(el(g, 'redo-button').disabled).toBe(true);
  });

  test('several undos are redone one at a time, in order', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5', 'g1f3');
    g.game.undoLastMove();
    g.game.undoLastMove();
    expect(notations(g)).toEqual(['e4']);
    g.game.redoMove();
    expect(notations(g)).toEqual(['e4', 'e5']);
    g.game.redoMove();
    expect(notations(g)).toEqual(['e4', 'e5', 'Nf3']);
  });

  test('a new move forgets what could be redone', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5');
    g.game.undoLastMove();
    g.play('c7c5');
    expect(el(g, 'redo-button').disabled).toBe(true);
    g.game.redoMove();
    expect(notations(g)).toEqual(['e4', 'c5']);
  });

  test('New Game forgets it too', () => {
    const g = loadGame();
    g.play('e2e4');
    g.game.undoLastMove();
    g.game.resetGame();
    g.game.redoMove();
    expect(g.game.moveHistory).toHaveLength(0);
  });

  test('against the computer, Redo brings back both moves', () => {
    jest.useFakeTimers();
    try {
      const g = loadGame();
      g.game.setOpponent('easy', 'w');
      g.play('e2e4');
      jest.runAllTimers(); // The computer replies
      const before = g.snapshot();
      g.game.undoLastMove(); // Takes back both
      expect(g.game.moveHistory).toHaveLength(0);
      g.game.redoMove();
      expect(g.snapshot()).toEqual(before);
      expect(g.game.currentPlayer).toBe('w');
      jest.runAllTimers();
      expect(g.game.moveHistory).toHaveLength(2); // The computer does not move again
    } finally {
      jest.useRealTimers();
    }
  });

  test('a mating move redone ends the game again', () => {
    const g = loadGame();
    g.play('f2f3', 'e7e5', 'g2g4', 'd8h4');
    g.game.undoLastMove();
    g.game.redoMove();
    expect(g.game.isGameOver).toBe(true);
    expect(g.game.gameResult).toBe('0-1');
    expect(notations(g)[3]).toBe('Qh4#');
  });

  test('Ctrl+Y and Ctrl+Shift+Z redo, but not in a text field', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5');
    g.game.undoLastMove();
    g.game.undoLastMove();
    expect(key(g, { key: 'y', ctrlKey: true }).defaultPrevented).toBe(true);
    expect(notations(g)).toEqual(['e4']);
    expect(key(g, { key: 'Z', ctrlKey: true, shiftKey: true }).defaultPrevented).toBe(true);
    expect(notations(g)).toEqual(['e4', 'e5']);

    g.game.undoLastMove();
    const field = el(g, 'import-text');
    const event = new g.window.KeyboardEvent('keydown', {
      key: 'y',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    field.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(notations(g)).toEqual(['e4']);
    expect(key(g, { key: 'z', ctrlKey: true }).defaultPrevented).toBe(false); // Plain Ctrl+Z is not Redo
  });

  test('is hidden when Undo is switched off', () => {
    const g = loadGame({ configure: (config) => (config.FEATURES.UNDO_MOVE = false) });
    expect(el(g, 'redo-button').hidden).toBe(true);
  });
});

describe('a change of position clears what was about the old one', () => {
  const resetButton = (g) => g.window.document.getElementById('reset-button');

  /** A game with a draw offered, an earlier move being looked at and New Game asking to confirm. */
  const pending = (g) => {
    g.play('e2e4', 'e7e5', 'g1f3');
    g.game.handleDrawClick();
    g.game.viewMove(1);
    resetButton(g).click();
    expect(g.game.drawOffered).toBe(true);
    expect(g.game.viewPly).toBe(1);
    expect(resetButton(g).textContent).toBe('Discard game?');
  };
  const cleared = (g, { view = true } = {}) => {
    expect(g.game.drawOffered).toBe(false);
    if (view) expect(g.game.viewPly).toBeNull();
    expect(resetButton(g).textContent).toBe('New Game');
  };

  test.each([
    ['New Game', (g) => g.game.resetGame()],
    ['Play from here', (g) => g.game.playFromHere()],
    ['a move', (g) => g.game.makeMove(0, 1, 2, 2)], // 3... Nc6, as the computer's reply would come
    ['Undo', (g) => g.game.undoLastMove()],
    ['Resign', (g) => g.game.resign()],
  ])('%s', (name, change) => {
    const g = loadGame();
    pending(g);
    change(g);
    cleared(g);
  });

  test('Redo', () => {
    const g = loadGame();
    g.play('d2d4');
    g.game.undoLastMove();
    pending(g);
    g.game.undoLastMove();
    g.game.redoMove();
    cleared(g);
  });

  test('a new opponent: the review is left alone, as the game itself goes on', () => {
    jest.useFakeTimers();
    try {
      const g = loadGame();
      pending(g);
      g.game.setOpponent('easy', 'w');
      cleared(g, { view: false });
      expect(g.game.viewPly).toBe(1);
      g.game.setOpponent(null);
    } finally {
      jest.useRealTimers();
    }
  });

  test('playing through the moves stops when the position is left', () => {
    jest.useFakeTimers();
    try {
      const g = loadGame();
      g.play('e2e4', 'e7e5', 'g1f3');
      g.game.viewMove(0);
      g.game.toggleAutoplay();
      expect(g.game.controlsView().autoplaying).toBe(true);
      g.game.undoLastMove();
      expect(g.game.controlsView().autoplaying).toBe(false);
      expect(g.game.viewPly).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});
