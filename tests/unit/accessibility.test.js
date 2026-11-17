const { loadGame } = require('../helpers/load-game');

const doc = (g) => g.window.document;
const label = (g, square) => {
  const { row, col } = g.utils.algebraicToCoords(square);
  return g.board.getSquareElement(row, col).getAttribute('aria-label');
};
const click = (g, square) => {
  const { row, col } = g.utils.algebraicToCoords(square);
  g.game.handleBoardClick(row, col);
};
const announced = (g) => doc(g).getElementById('announcer').textContent;

describe('board structure', () => {
  test('eight rows of eight cells', () => {
    const g = loadGame();
    const rows = Array.from(doc(g).querySelectorAll('#chess-board > [role="row"]'));
    expect(rows).toHaveLength(8);
    for (const row of rows) {
      expect(row.querySelectorAll(':scope > [role="gridcell"]')).toHaveLength(8);
    }
  });

  test('rows and cells are both reversed on a flipped board', () => {
    const g = loadGame();
    g.board.setBoardFlipped(true);
    const rows = Array.from(doc(g).querySelectorAll('#chess-board > [role="row"]'));
    expect(rows.map((r) => r.dataset.row)).toEqual(['7', '6', '5', '4', '3', '2', '1', '0']);
    expect(Array.from(rows[0].children).map((s) => s.dataset.col)).toEqual([
      '7',
      '6',
      '5',
      '4',
      '3',
      '2',
      '1',
      '0',
    ]);
  });
});

describe('tab order', () => {
  const tabStops = (g) => Array.from(doc(g).querySelectorAll('#chess-board .square[tabindex="0"]'));

  test('exactly one square is a tab stop', () => {
    const g = loadGame();
    expect(tabStops(g)).toHaveLength(1);
    expect(doc(g).querySelectorAll('#chess-board .square[tabindex="-1"]')).toHaveLength(63);
  });

  test('the tab stop follows the focused square', () => {
    const g = loadGame();
    const e2 = g.board.getSquareElement(6, 4);
    e2.focus();
    expect(tabStops(g)).toEqual([e2]);

    e2.dispatchEvent(new g.window.KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(tabStops(g)).toEqual([g.board.getSquareElement(5, 4)]);
    expect(doc(g).activeElement).toBe(g.board.getSquareElement(5, 4));
  });

  test('the arrow keys move the focus one square each way and stop at the edge', () => {
    const g = loadGame();
    const focused = () => {
      const square = doc(g).activeElement;
      return g.utils.coordsToAlgebraic(Number(square.dataset.row), Number(square.dataset.col));
    };
    const press = (key) =>
      doc(g).activeElement.dispatchEvent(
        new g.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      );
    g.board.getSquareElement(6, 4).focus(); // e2

    press('ArrowDown');
    expect(focused()).toBe('e1');
    press('ArrowDown'); // Already on the edge
    expect(focused()).toBe('e1');
    press('ArrowLeft');
    expect(focused()).toBe('d1');
    press('ArrowRight');
    press('ArrowRight');
    expect(focused()).toBe('f1');
    press('ArrowUp');
    expect(focused()).toBe('f2');
    expect(tabStops(g)).toEqual([g.board.getSquareElement(6, 5)]);

    // On a flipped board the keys follow what is on screen
    g.board.setBoardFlipped(true);
    g.board.getSquareElement(6, 4).focus(); // e2, now near the top
    press('ArrowDown');
    expect(focused()).toBe('e3');
    press('ArrowRight');
    expect(focused()).toBe('d3');
    press('ArrowLeft');
    press('ArrowUp');
    expect(focused()).toBe('e2');
  });

  test('there is still one tab stop after the board is flipped and after a new game', () => {
    const g = loadGame();
    g.board.setBoardFlipped(true);
    g.play('e2e4');
    g.game.resetGame();
    expect(tabStops(g)).toHaveLength(1);
  });
});

describe('playing with the keyboard', () => {
  const square = (g, name) => {
    const { row, col } = g.utils.algebraicToCoords(name);
    return g.board.getSquareElement(row, col);
  };
  /** Presses a key on the focused element; returns the event, to see whether it was prevented. */
  const press = (g, key) => {
    const event = new g.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    doc(g).activeElement.dispatchEvent(event);
    return event;
  };

  test('Enter picks up a piece and Space plays it', () => {
    const g = loadGame();
    square(g, 'e2').focus();
    const enter = press(g, 'Enter');
    expect(enter.defaultPrevented).toBe(true);
    expect(g.board.getSelectedSquare()).toEqual({ row: 6, col: 4 });

    press(g, 'ArrowUp');
    press(g, 'ArrowUp');
    expect(doc(g).activeElement).toBe(square(g, 'e4'));
    const space = press(g, ' ');
    expect(space.defaultPrevented).toBe(true);
    expect(g.game.moveHistory.map((move) => move.notation)).toEqual(['e4']);
    expect(g.game.currentPlayer).toBe('b');
  });

  test('on a flipped board, Enter on a piece of the side not to move selects nothing', () => {
    const g = loadGame();
    g.board.setBoardFlipped(true);
    square(g, 'e7').focus();
    press(g, 'Enter');
    expect(g.board.getSelectedSquare()).toBeNull();
    expect(g.game.moveHistory).toHaveLength(0);
  });

  test('Enter on a promotion square opens the chooser, and the focus comes back to the board', () => {
    const g = loadGame();
    g.game.importFEN('7k/P7/8/8/8/8/8/K7 w - - 0 1');
    square(g, 'a7').focus();
    press(g, 'Enter');
    press(g, 'ArrowUp');
    press(g, 'Enter');
    const choice = doc(g).activeElement;
    expect(choice.classList.contains('promotion-choice')).toBe(true);

    doc(g).querySelector('.promotion-choice[data-piece="q"]').click();
    expect(g.game.moveHistory.map((move) => move.notation)).toEqual(['a8=Q+']);
    expect(doc(g).activeElement.classList.contains('square')).toBe(true);
  });

  test('a square pressed with a pointer gives up the focus; one reached by keyboard keeps it', () => {
    const g = loadGame();
    const e2 = square(g, 'e2');
    e2.focus();
    press(g, 'ArrowUp'); // e3, reached by keyboard
    expect(doc(g).activeElement).toBe(square(g, 'e3'));

    e2.focus(); // As a mouse press on the square does
    e2.dispatchEvent(new g.window.Event('pointerup', { bubbles: true }));
    expect(doc(g).activeElement.classList.contains('square')).toBe(false);
  });
});

describe('square labels', () => {
  test('name the piece in words', () => {
    const g = loadGame();
    expect(label(g, 'd8')).toBe('black queen on d8');
    expect(label(g, 'g1')).toBe('white knight on g1');
  });

  test('say which square is selected and where it can go', () => {
    const g = loadGame();
    click(g, 'e2');
    expect(label(g, 'e2')).toBe('white pawn on e2, selected');
    expect(g.board.getSquareElement(6, 4).getAttribute('aria-selected')).toBe('true');
    expect(label(g, 'e3')).toBe('e3, legal move');
    expect(label(g, 'e4')).toBe('e4, legal move');
    expect(label(g, 'e5')).toBe('e5');

    click(g, 'e4');
    expect(label(g, 'e2')).toBe('e2');
    expect(label(g, 'e3')).toBe('e3');
    expect(label(g, 'e4')).toBe('white pawn on e4');
    expect(g.board.getSquareElement(6, 4).hasAttribute('aria-selected')).toBe(false);
  });

  test('mark a king that is in check', () => {
    const g = loadGame();
    g.play('e2e4', 'f7f6', 'd1h5');
    expect(label(g, 'e8')).toBe('black king on e8, in check');
  });
});

describe('announcements', () => {
  test('a quiet move, then a capture', () => {
    const g = loadGame();
    g.play('e2e4');
    expect(announced(g)).toBe("White pawn to e4. Black's turn");
    g.play('d7d5', 'e4d5');
    expect(announced(g)).toBe("White pawn takes on d5. Black's turn");
  });

  test('check and checkmate', () => {
    const g = loadGame();
    g.play('e2e4', 'f7f6', 'd1h5');
    expect(announced(g)).toBe("White queen to h5. Check. Black's turn");

    const mate = loadGame();
    mate.play('f2f3', 'e7e5', 'g2g4', 'd8h4');
    expect(announced(mate)).toBe('Black queen to h4. Checkmate! Black wins.');
  });

  test('castling, en passant and promotion', () => {
    const castle = loadGame();
    castle.play('e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g8f6', 'e1g1');
    expect(announced(castle)).toBe("White castles kingside. Black's turn");

    const ep = loadGame();
    ep.play('e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6');
    expect(announced(ep)).toBe("White pawn takes on d6 en passant. Black's turn");

    const promo = loadGame();
    promo.setPosition({ e1: 'wk*', h6: 'bk*', b7: 'wp*', a8: 'br*' });
    promo.game.makeMove(1, 1, 0, 1, 'n');
    expect(announced(promo)).toBe("White pawn to b8, promotes to knight. Black's turn");
  });

  test('undo and New Game', () => {
    const g = loadGame();
    g.play('e2e4');
    g.game.undoLastMove();
    expect(announced(g)).toBe("Move taken back. White's turn");
    g.game.handleResetClick();
    expect(announced(g)).toBe("New game. White's turn");
  });

  test('the visible status line is unchanged', () => {
    const g = loadGame();
    g.play('e2e4');
    expect(doc(g).getElementById('game-status').textContent).toBe("Black's turn");
  });
});

describe('announcements', () => {
  test('a button that asks twice says so', () => {
    const g = loadGame();
    g.play('e2e4');
    doc(g).getElementById('resign-button').click();
    expect(announced(g)).toBe('Resign? Press again to confirm.');
  });

  test('the same message twice is a change each time, so it is read again', () => {
    const g = loadGame();
    const seen = [];
    g.game.setOpponent(null);
    for (let n = 0; n < 3; n++) {
      doc(g).getElementById('reset-button').click(); // Nothing to lose: resets at once
      seen.push(announced(g));
    }
    expect(seen[0]).not.toBe(seen[1]);
    expect(seen[1]).not.toBe(seen[2]);
    expect(seen.map((text) => text.trim())).toEqual(Array(3).fill("New game. White's turn"));
  });
});

describe('the move list keeps the focus when it is redrawn', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test("by the computer's move, on the current move", () => {
    const g = loadGame();
    g.game.setOpponent('easy', 'w');
    g.play('e2e4'); // The computer starts thinking
    doc(g).querySelector('#move-history button[tabindex="0"]').focus();
    jest.runAllTimers(); // Its reply redraws the list
    expect(g.game.moveHistory).toHaveLength(2);
    const focused = doc(g).activeElement;
    expect(focused.closest('#move-history')).not.toBeNull();
    expect(focused.dataset.ply).toBe('2');
  });

  test('not when the focus was elsewhere', () => {
    const g = loadGame();
    g.game.setOpponent('easy', 'w');
    g.play('e2e4');
    const elsewhere = doc(g).getElementById('pgn-button');
    elsewhere.focus();
    jest.runAllTimers();
    expect(g.game.moveHistory).toHaveLength(2);
    expect(doc(g).activeElement).toBe(elsewhere);
  });
});

describe('a button that switches itself off hands the focus on', () => {
  const step = (g, name) => doc(g).querySelector(`button[data-step="${name}"]`);
  const press = (button) => {
    button.focus();
    button.click();
  };
  const boardTabStop = (g) => doc(g).querySelector('#chess-board .square[tabindex="0"]');

  test('the step buttons, to the nearest one still on', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5');
    press(step(g, 'first'));
    expect(step(g, 'first').disabled).toBe(true);
    expect(doc(g).activeElement).toBe(step(g, 'next'));

    press(step(g, 'last'));
    expect(step(g, 'last').disabled).toBe(true);
    expect(doc(g).activeElement).toBe(step(g, 'previous'));
  });

  test('Back to game, to the board', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5');
    g.game.viewMove(1);
    const live = doc(g).getElementById('live-button');
    press(live);
    expect(live.hidden).toBe(true);
    expect(doc(g).activeElement).toBe(boardTabStop(g));
  });

  test('Resign, to the board', () => {
    const g = loadGame();
    g.play('e2e4');
    const resign = doc(g).getElementById('resign-button');
    press(resign);
    press(resign); // Confirms
    expect(resign.disabled).toBe(true);
    expect(doc(g).activeElement).toBe(boardTabStop(g));
  });

  test('a button that stays on keeps the focus', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5');
    press(step(g, 'previous'));
    expect(doc(g).activeElement).toBe(step(g, 'previous'));
  });
});
