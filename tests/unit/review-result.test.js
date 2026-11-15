const { loadGame } = require('../helpers/load-game');

const el = (g, id) => g.window.document.getElementById(id);
const moveButton = (g, ply) =>
  g.window.document.querySelector(`#move-history button[data-ply="${ply}"]`);
const pieceOn = (g, square) => {
  const { row, col } = g.utils.algebraicToCoords(square);
  const piece = g.board.getSquareElement(row, col).querySelector('.piece');
  return piece ? piece.dataset.piece : null;
};

describe('Captured pieces', () => {
  const icons = (g, id) => el(g, id).querySelectorAll('.captured-piece').length;
  const lead = (g, id) => {
    const element = el(g, id).querySelector('.material-lead');
    return element ? element.textContent : null;
  };

  test('nothing is shown before a capture', () => {
    const g = loadGame();
    g.play('e2e4', 'd7d5');
    expect(icons(g, 'captured-by-white')).toBe(0);
    expect(lead(g, 'captured-by-white')).toBeNull();
    expect(el(g, 'captured-by-white').getAttribute('aria-label')).toBe(
      'White has captured nothing.'
    );
  });

  test('a capture is listed with the material lead', () => {
    const g = loadGame();
    g.play('e2e4', 'd7d5', 'e4d5');
    expect(icons(g, 'captured-by-white')).toBe(1);
    expect(lead(g, 'captured-by-white')).toBe('+1');
    expect(lead(g, 'captured-by-black')).toBeNull();
    expect(el(g, 'captured-by-white').getAttribute('aria-label')).toBe(
      'White has captured pawn. White is ahead by 1.'
    );
  });

  test('an even exchange shows both captures and no lead', () => {
    const g = loadGame();
    g.play('e2e4', 'd7d5', 'e4d5', 'd8d5');
    expect(icons(g, 'captured-by-white')).toBe(1);
    expect(icons(g, 'captured-by-black')).toBe(1);
    expect(lead(g, 'captured-by-white')).toBeNull();
    expect(lead(g, 'captured-by-black')).toBeNull();
  });

  test('en passant counts as a capture', () => {
    const g = loadGame();
    g.play('e2e4', 'a7a6', 'e4e5', 'd7d5', 'e5d6');
    expect(icons(g, 'captured-by-white')).toBe(1);
    expect(lead(g, 'captured-by-white')).toBe('+1');
  });

  test('a promotion changes the lead', () => {
    const g = loadGame();
    g.setPosition({ e1: 'wk*', a7: 'wp*', h8: 'bk*' });
    expect(g.game.gameResult).toBeNull();
    g.play('a7a8');
    expect(icons(g, 'captured-by-white')).toBe(0);
    expect(lead(g, 'captured-by-white')).toBe('+9');
  });

  test('undo and New Game clear the rows', () => {
    const g = loadGame();
    g.play('e2e4', 'd7d5', 'e4d5');
    g.game.undoLastMove();
    expect(icons(g, 'captured-by-white')).toBe(0);
    g.play('e4d5');
    g.game.resetGame();
    expect(icons(g, 'captured-by-white')).toBe(0);
    expect(lead(g, 'captured-by-white')).toBeNull();
  });

  test('the rows are rebuilt from a saved game', () => {
    const first = loadGame();
    first.play('e2e4', 'd7d5', 'e4d5');
    const saved = first.window.localStorage.getItem('chessGameState');
    const second = loadGame({ storage: { chessGameState: saved } });
    expect(icons(second, 'captured-by-white')).toBe(1);
    expect(lead(second, 'captured-by-white')).toBe('+1');
  });
});

describe('Looking back through the move list', () => {
  test('clicking a move shows the position after it and keeps the game', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5', 'g1f3');
    const before = g.snapshot();
    moveButton(g, 1).click();

    expect(g.game.viewPly).toBe(1);
    expect(pieceOn(g, 'e4')).toBe('wp');
    expect(pieceOn(g, 'e5')).toBeNull();
    expect(pieceOn(g, 'g1')).toBe('wn');
    expect(g.snapshot()).toEqual(before);
    expect(g.game.positionHistory).toHaveLength(3);
    expect(el(g, 'game-status').textContent).toBe('Viewing 1. e4');
    expect(el(g, 'live-button').hidden).toBe(false);
    expect(moveButton(g, 1).getAttribute('aria-current')).toBe('true');
  });

  test('the viewed move is highlighted as the last move', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5', 'g1f3');
    moveButton(g, 2).click();
    const square = (name) => {
      const { row, col } = g.utils.algebraicToCoords(name);
      return g.board.getSquareElement(row, col);
    };
    expect(square('e7').classList.contains('last-move-from')).toBe(true);
    expect(square('e5').classList.contains('last-move-to')).toBe(true);
    expect(square('f3').classList.contains('last-move-to')).toBe(false);
  });

  test('the board is locked while viewing', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5');
    moveButton(g, 1).click();
    expect(g.game.isBoardLocked()).toBe(true);
    g.game.handleBoardClick(6, 3); // d2
    expect(g.board.getSelectedSquare()).toBeNull();
  });

  test('Back to game returns to the live position', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5');
    moveButton(g, 1).click();
    el(g, 'live-button').click();
    expect(g.game.viewPly).toBeNull();
    expect(pieceOn(g, 'e5')).toBe('bp');
    expect(el(g, 'live-button').hidden).toBe(true);
    expect(el(g, 'game-status').textContent).toBe("White's turn");
    expect(g.game.isBoardLocked()).toBe(false);
  });

  describe('Play from here', () => {
    const KEY = 'chessGameState';
    const saved = (g) => JSON.parse(g.window.localStorage.getItem(KEY));

    test('is offered only while looking back, and asks before it drops the later moves', () => {
      jest.useFakeTimers();
      try {
        const g = loadGame();
        g.play('e2e4', 'e7e5', 'g1f3', 'b8c6');
        expect(el(g, 'review-actions').hidden).toBe(true);
        g.game.viewMove(2);
        expect(el(g, 'review-actions').hidden).toBe(false);

        el(g, 'play-here-button').click();
        expect(el(g, 'play-here-button').textContent).toBe('Drop later moves?');
        expect(g.game.moveHistory).toHaveLength(4); // Nothing yet
        jest.advanceTimersByTime(global.CONFIG.CONFIRM_MS);
        expect(el(g, 'play-here-button').textContent).toBe('Play from here');

        el(g, 'play-here-button').click();
        g.game.viewMove(1); // Looking at another position withdraws the question
        expect(el(g, 'play-here-button').textContent).toBe('Play from here');
        expect(g.game.moveHistory).toHaveLength(4);
      } finally {
        jest.useRealTimers();
      }
    });

    test('makes the viewed position the live one and drops the later moves', () => {
      const g = loadGame();
      g.play('e2e4', 'e7e5', 'g1f3', 'b8c6');
      g.game.viewMove(2);
      el(g, 'play-here-button').click();
      el(g, 'play-here-button').click();

      expect(g.game.viewPly).toBeNull();
      expect(g.game.moveHistory.map((m) => m.notation)).toEqual(['e4', 'e5']);
      expect(g.game.positionHistory).toHaveLength(2);
      expect(pieceOn(g, 'f3')).toBeNull();
      expect(pieceOn(g, 'g1')).toBe('wn');
      expect(el(g, 'game-status').textContent).toBe("White's turn");
      expect(el(g, 'review-actions').hidden).toBe(true);
      expect(g.window.document.querySelectorAll('#move-history button')).toHaveLength(2);
      expect(saved(g).moveHistory).toHaveLength(2);
      expect(saved(g).positionHistory).toHaveLength(2);

      g.play('d2d4'); // The game goes on along another line
      expect(g.game.moveHistory.map((m) => m.notation)).toEqual(['e4', 'e5', 'd4']);
      g.game.undoLastMove();
      g.game.undoLastMove();
      expect(g.game.moveHistory.map((m) => m.notation)).toEqual(['e4']);
    });

    test('the game as it was is kept among the past games', () => {
      const g = loadGame();
      g.play('e2e4', 'e7e5', 'g1f3', 'b8c6');
      g.game.viewMove(1);
      g.game.playFromHere();
      const archive = g.game.readArchive();
      expect(archive).toHaveLength(1);
      expect(archive[0].pgn).toContain('1. e4 e5 2. Nf3 Nc6');
    });

    test('reopens a finished game on the clock, without the clock', () => {
      jest.useFakeTimers();
      try {
        const g = loadGame();
        g.game.setTimeControl('5+0');
        g.game.resetGame();
        g.play('f2f3', 'e7e5', 'g2g4', 'd8h4'); // Checkmate
        expect(g.game.isGameOver).toBe(true);
        expect(el(g, 'undo-button').disabled).toBe(true); // No Undo on the clock

        g.game.viewMove(2);
        g.game.playFromHere();
        expect(g.game.isGameOver).toBe(false);
        expect(g.game.gameResult).toBeNull();
        expect(g.game.clock).toBeNull();
        expect(el(g, 'clock-white').hidden).toBe(true);
        expect(el(g, 'undo-button').disabled).toBe(false);
        expect(saved(g).isGameOver).toBe(false);
        g.play('e2e4');
        expect(g.game.moveHistory.map((m) => m.notation)).toEqual(['f3', 'e5', 'e4']);
      } finally {
        jest.useRealTimers();
      }
    });

    test('reopens a game that ended by resignation', () => {
      const g = loadGame();
      g.play('e2e4', 'e7e5');
      g.game.resign();
      g.game.viewMove(1);
      g.game.playFromHere();
      expect(g.game.isGameOver).toBe(false);
      expect(el(g, 'game-status').textContent).toBe("Black's turn");
      expect(saved(g).endedWithoutMove).toBe(false);
    });

    test('against the computer, it replies if the position gives it the move', () => {
      jest.useFakeTimers();
      try {
        const g = loadGame();
        g.game.setOpponent('easy', 'w');
        g.play('e2e4');
        jest.runAllTimers();
        g.play('d2d4');
        jest.runAllTimers();
        expect(g.game.moveHistory).toHaveLength(4);

        g.game.viewMove(1); // After 1. e4: the computer to move
        g.game.playFromHere();
        expect(g.game.moveHistory).toHaveLength(1);
        expect(el(g, 'game-status').textContent).toBe("Black's turn (computer is thinking)");
        jest.runAllTimers();
        expect(g.game.moveHistory).toHaveLength(2);
        expect(g.game.currentPlayer).toBe('w');

        g.game.viewMove(0); // The starting position: the player to move
        g.game.playFromHere();
        jest.runAllTimers();
        expect(g.game.moveHistory).toHaveLength(0);
        expect(g.game.isBoardLocked()).toBe(false);
      } finally {
        jest.useRealTimers();
      }
    });

    test('does nothing while the live game is on the board', () => {
      const g = loadGame();
      g.play('e2e4', 'e7e5');
      g.game.playFromHere();
      el(g, 'play-here-button').click();
      expect(g.game.moveHistory).toHaveLength(2);
      expect(el(g, 'play-here-button').textContent).toBe('Play from here');
    });
  });

  describe('engine score', () => {
    const score = (g) => el(g, 'review-score');

    test('is shown only while looking back', () => {
      const g = loadGame();
      g.play('e2e4', 'e7e5');
      expect(score(g).hidden).toBe(true);
      g.game.viewMove(1);
      expect(score(g).hidden).toBe(false);
      expect(score(g).textContent).toBe('Engine thinks the position is about equal.');
      g.game.returnToLiveGame();
      expect(score(g).hidden).toBe(true);
    });

    test('says who is ahead and by how much', () => {
      const white = loadGame();
      white.setPosition({ e1: 'wk*', d1: 'wq*', e8: 'bk*', a7: 'bp' });
      white.play('e1e2', 'a7a6', 'e2e3');
      white.game.viewMove(1);
      expect(score(white).textContent).toMatch(/^Engine thinks White is ahead by (7|8|9)\.\d\.$/);

      const black = loadGame();
      black.setPosition({ e1: 'wk*', a2: 'wp', e8: 'bk*', a8: 'br*', h8: 'br*' });
      black.play('a2a3', 'e8e7', 'a3a4');
      black.game.viewMove(2);
      expect(score(black).textContent).toMatch(/^Engine thinks Black is ahead by (9|10|11)\.\d\.$/);
    });

    test('sees a mate that is one move away, and the mate itself', () => {
      const g = loadGame();
      g.play('f2f3', 'e7e5', 'g2g4', 'd8h4');
      g.game.viewMove(3);
      expect(score(g).textContent).toBe('Engine thinks Black can force mate.');
      g.game.viewMove(0);
      expect(score(g).textContent).toBe('Engine thinks the position is about equal.');

      const mated = loadGame();
      mated.play('f2f3', 'e7e5', 'g2g4', 'd8h4');
      mated.game.undoLastMove();
      mated.play('d8h4');
      mated.game.viewMove(3);
      mated.game.viewMove(4); // The final position is the live game
      expect(score(mated).hidden).toBe(true);
    });

    test('is not read out with every step', () => {
      const g = loadGame();
      g.play('e2e4', 'e7e5');
      g.game.viewMove(1);
      const announced = g.window.document.getElementById('announcer');
      expect(score(g).getAttribute('aria-live')).toBeNull();
      expect(score(g).getAttribute('role')).toBeNull();
      if (announced) expect(announced.textContent).not.toContain('Engine');
    });

    test("does not hold up or drop the computer's move", () => {
      jest.useFakeTimers();
      try {
        const g = loadGame();
        g.game.setOpponent('easy', 'w');
        g.play('e2e4'); // The computer starts thinking
        g.game.viewMove(0);
        expect(score(g).hidden).toBe(false);
        jest.runAllTimers();
        expect(g.game.moveHistory).toHaveLength(2);
        expect(g.game.viewPly).toBeNull(); // Its reply brings the live game back
        expect(score(g).hidden).toBe(true);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('moves that lost ground', () => {
    const score = (g) => el(g, 'review-score');
    const marks = (g) =>
      [...g.window.document.querySelectorAll('#move-history .lost-ground')].map(
        (entry) => entry.dataset.ply
      );

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('are marked once the game is over, with the reason in the name and the tooltip', () => {
      const g = loadGame();
      g.play('f2f3', 'e7e5', 'g2g4');
      jest.runOnlyPendingTimers();
      expect(g.game.gameScores).toBeNull(); // The game is still on
      expect(marks(g)).toEqual([]);

      g.play('d8h4');
      expect(marks(g)).toEqual([]); // Not worked out yet
      jest.runOnlyPendingTimers();

      expect(g.game.gameScores).toHaveLength(5); // Every position, first to last
      expect(marks(g)).toEqual(['3']);
      const move = moveButton(g, 3);
      expect(move.textContent).toBe('g4'); // The move itself is not rewritten
      expect(move.title).toBe('Engine thinks 2. g4 allowed a forced mate.');
      expect(move.getAttribute('aria-label')).toBe(
        'g4. Engine thinks 2. g4 allowed a forced mate.'
      );
      expect(moveButton(g, 4).hasAttribute('aria-label')).toBe(false);
      expect(g.game.moveCost(2)).toMatchObject({ allowedMate: true, missedMate: false });
      expect(g.game.moveCost(3)).toBeNull(); // The mating move lost nothing
    });

    test('a piece given away is marked with about what it cost', () => {
      const g = loadGame();
      g.play('e2e4', 'e7e5', 'd1h5', 'b8c6', 'h5f7', 'e8f7'); // 3. Qxf7+ Kxf7
      g.game.resign();
      jest.runOnlyPendingTimers();

      expect(marks(g)).toEqual(['5']);
      const cost = g.game.moveCost(4);
      expect(cost.allowedMate).toBe(false);
      expect(cost.lost).toBeGreaterThan(600); // A queen for a pawn
      expect(cost.lost).toBeLessThan(1100);
      expect(moveButton(g, 5).title).toMatch(/^Engine thinks 3\. Qxf7\+ lost about \d+\.\d\.$/);
    });

    test('the line under the list says it when the move is looked at', () => {
      const g = loadGame();
      g.play('f2f3', 'e7e5', 'g2g4', 'd8h4');
      jest.runOnlyPendingTimers();
      g.game.viewMove(3);
      expect(score(g).textContent).toBe(
        'Engine thinks Black can force mate. Engine thinks 2. g4 allowed a forced mate.'
      );
      g.game.viewMove(2);
      expect(score(g).textContent).toBe('Engine thinks the position is about equal.');
    });

    test('a game with no such move has no marks', () => {
      const g = loadGame();
      g.play('e2e4', 'e7e5', 'g1f3', 'b8c6');
      g.game.resign();
      jest.runOnlyPendingTimers();
      expect(g.game.gameScores).toHaveLength(5);
      expect(marks(g)).toEqual([]);
    });

    test('are forgotten when the game goes on again, and worked out anew when it ends', () => {
      const g = loadGame();
      g.play('f2f3', 'e7e5', 'g2g4', 'd8h4');
      jest.runOnlyPendingTimers();
      expect(marks(g)).toEqual(['3']);

      g.game.undoLastMove();
      expect(g.game.gameScores).toBeNull();
      expect(marks(g)).toEqual([]);

      g.play('d8h4');
      jest.runOnlyPendingTimers();
      expect(marks(g)).toEqual(['3']);

      g.game.resetGame();
      expect(g.game.gameScores).toBeNull();
      expect(marks(g)).toEqual([]);
    });

    test('a finished game that is loaded again gets its marks', () => {
      const first = loadGame();
      first.play('f2f3', 'e7e5', 'g2g4', 'd8h4');
      const pgn = first.game.buildPGN();

      const g = loadGame();
      g.game.importPGN(pgn);
      jest.runOnlyPendingTimers();
      expect(g.game.isGameOver).toBe(true);
      expect(marks(g)).toEqual(['3']);
    });
  });

  describe('step buttons', () => {
    const step = (g, name) => el(g, 'step-buttons').querySelector(`[data-step="${name}"]`);
    const disabled = (g) =>
      ['first', 'previous', 'next', 'last'].filter((name) => step(g, name).disabled);

    test('previous and next move one position at a time', () => {
      const g = loadGame();
      g.play('e2e4', 'e7e5', 'g1f3');
      step(g, 'previous').click();
      expect(g.game.viewPly).toBe(2);
      expect(pieceOn(g, 'f3')).toBeNull();
      step(g, 'previous').click();
      expect(el(g, 'game-status').textContent).toBe('Viewing 1. e4');
      step(g, 'next').click();
      expect(g.game.viewPly).toBe(2);
      step(g, 'next').click();
      expect(g.game.viewPly).toBeNull(); // The last position is the live game
      expect(pieceOn(g, 'f3')).toBe('wn');
    });

    test('first shows the starting position and last returns to the game', () => {
      const g = loadGame();
      g.play('e2e4', 'e7e5');
      const before = g.snapshot();
      step(g, 'first').click();
      expect(g.game.viewPly).toBe(0);
      expect(pieceOn(g, 'e2')).toBe('wp');
      expect(pieceOn(g, 'e4')).toBeNull();
      expect(el(g, 'game-status').textContent).toBe('Viewing the starting position');
      step(g, 'last').click();
      expect(g.game.viewPly).toBeNull();
      expect(el(g, 'live-button').hidden).toBe(true);
      expect(g.snapshot()).toEqual(before);
    });

    test('are off at the end already reached', () => {
      const g = loadGame();
      expect(disabled(g)).toEqual(['first', 'previous', 'next', 'last']); // No moves yet
      g.play('e2e4', 'e7e5');
      expect(disabled(g)).toEqual(['next', 'last']);
      step(g, 'previous').click();
      expect(disabled(g)).toEqual([]);
      step(g, 'first').click();
      expect(disabled(g)).toEqual(['first', 'previous']);
    });

    test('are off when the positions behind the moves are missing', () => {
      const g = loadGame();
      g.play('e2e4', 'e7e5');
      g.game.positionHistory.length = 0; // As in a save from an older version
      g.game.setOpponent(null); // Redraws the controls
      expect(disabled(g)).toEqual(['first', 'previous', 'next', 'last']);
    });
  });

  test('clicking the last move is the live position', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5');
    moveButton(g, 1).click();
    moveButton(g, 2).click();
    expect(g.game.viewPly).toBeNull();
  });

  test('the arrow keys, Home and End step through the game', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5', 'g1f3');
    const press = (key) =>
      el(g, 'move-history').dispatchEvent(
        new g.window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      );
    press('ArrowLeft');
    expect(g.game.viewPly).toBe(2);
    expect(g.window.document.activeElement).toBe(moveButton(g, 2));
    press('Home');
    expect(g.game.viewPly).toBe(0);
    expect(pieceOn(g, 'e2')).toBe('wp');
    expect(el(g, 'game-status').textContent).toBe('Viewing the starting position');
    press('ArrowLeft');
    expect(g.game.viewPly).toBe(0);
    press('ArrowRight');
    expect(g.game.viewPly).toBe(1);
    press('End');
    expect(g.game.viewPly).toBeNull();
  });

  test('only one move is in the tab order', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5', 'g1f3');
    const stops = () => g.window.document.querySelectorAll('#move-history button[tabindex="0"]');
    expect(stops()).toHaveLength(1);
    expect(stops()[0]).toBe(moveButton(g, 3));
    moveButton(g, 1).click();
    expect(stops()).toHaveLength(1);
    expect(stops()[0]).toBe(moveButton(g, 1));
  });

  test('captured pieces follow the viewed position', () => {
    const g = loadGame();
    g.play('e2e4', 'd7d5', 'e4d5');
    moveButton(g, 2).click();
    expect(el(g, 'captured-by-white').querySelectorAll('.captured-piece')).toHaveLength(0);
  });

  test('a move played while viewing returns to the game', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5');
    moveButton(g, 1).click();
    g.game.makeMove(7, 6, 5, 5); // As the computer's reply would: Nf3
    expect(g.game.viewPly).toBeNull();
    expect(pieceOn(g, 'f3')).toBe('wn');
    expect(pieceOn(g, 'e5')).toBe('bp');
  });

  test('undo while viewing returns to the game and takes the move back', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5');
    moveButton(g, 1).click();
    g.game.undoLastMove();
    expect(g.game.viewPly).toBeNull();
    expect(g.game.moveHistory).toHaveLength(1);
    expect(pieceOn(g, 'e7')).toBe('bp');
  });

  test('a saved game without an undo stack cannot be viewed', () => {
    const first = loadGame();
    first.play('e2e4', 'e7e5');
    const saved = JSON.parse(first.window.localStorage.getItem('chessGameState'));
    delete saved.positionHistory;
    const g = loadGame({ storage: { chessGameState: JSON.stringify(saved) } });
    expect(moveButton(g, 1).disabled).toBe(true);
    g.game.viewMove(1);
    expect(g.game.viewPly).toBeNull();
  });
});

describe('Resigning', () => {
  test('the buttons are disabled until a move has been played', () => {
    const g = loadGame();
    expect(el(g, 'resign-button').disabled).toBe(true);
    expect(el(g, 'draw-button').disabled).toBe(true);
    g.play('e2e4');
    expect(el(g, 'resign-button').disabled).toBe(false);
    expect(el(g, 'draw-button').disabled).toBe(false);
  });

  test('needs a second click, then the side to move loses', () => {
    const g = loadGame();
    g.play('e2e4');
    el(g, 'resign-button').click();
    expect(g.game.isGameOver).toBe(false);
    expect(el(g, 'resign-button').textContent).toBe('Resign?');

    el(g, 'resign-button').click();
    expect(g.game.isGameOver).toBe(true);
    expect(g.game.gameResult).toBe('1-0');
    expect(g.game.currentStatus).toBe('Black resigned. White wins.');
    expect(g.game.isBoardLocked()).toBe(true);
    expect(el(g, 'resign-button').textContent).toBe('Resign');
    expect(el(g, 'resign-button').disabled).toBe(true);
  });

  test('the confirmation expires', () => {
    jest.useFakeTimers();
    try {
      const g = loadGame();
      g.play('e2e4');
      el(g, 'resign-button').click();
      jest.advanceTimersByTime(global.CONFIG.CONFIRM_MS + 1);
      expect(el(g, 'resign-button').textContent).toBe('Resign');
      el(g, 'resign-button').click();
      expect(g.game.isGameOver).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  test('playing a move drops a pending confirmation', () => {
    const g = loadGame();
    g.play('e2e4');
    el(g, 'resign-button').click();
    g.play('e7e5');
    expect(el(g, 'resign-button').textContent).toBe('Resign');
    el(g, 'resign-button').click();
    expect(g.game.isGameOver).toBe(false);
  });

  test('against the computer it is the person who resigns, even on the computer’s turn', () => {
    jest.useFakeTimers();
    try {
      const g = loadGame();
      g.game.setOpponent('easy', 'w');
      g.play('e2e4'); // Now the computer (Black) is thinking
      g.game.resign();
      expect(g.game.gameResult).toBe('0-1');
      expect(g.game.currentStatus).toBe('White resigned. Black wins.');
      jest.runOnlyPendingTimers();
      expect(g.game.moveHistory).toHaveLength(1); // The pending reply was dropped
    } finally {
      jest.useRealTimers();
    }
  });

  test('the PGN carries the result and says how the game ended', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5');
    g.game.resign();
    const pgn = g.game.buildPGN();
    expect(pgn).toContain('[Result "0-1"]');
    expect(pgn.split('\n\n')[1].trim()).toBe('1. e4 e5 {White resigned. Black wins.} 0-1');
  });

  test('undo reopens the game without taking a move back', () => {
    const g = loadGame();
    g.play('e2e4', 'e7e5');
    g.game.resign();
    expect(el(g, 'undo-button').disabled).toBe(false);
    g.game.undoLastMove();
    expect(g.game.isGameOver).toBe(false);
    expect(g.game.gameResult).toBeNull();
    expect(g.game.moveHistory).toHaveLength(2);
    expect(g.game.currentStatus).toBe("White's turn");
    expect(g.game.buildPGN()).toContain('[Result "*"]');
  });

  test('the result survives a reload and can still be reopened', () => {
    const first = loadGame();
    first.play('e2e4', 'e7e5');
    first.game.resign();
    const saved = first.window.localStorage.getItem('chessGameState');
    const g = loadGame({ storage: { chessGameState: saved } });
    expect(g.game.isGameOver).toBe(true);
    expect(g.game.gameResult).toBe('0-1');
    expect(g.game.buildPGN()).toContain('{White resigned. Black wins.} 0-1');
    g.game.undoLastMove();
    expect(g.game.isGameOver).toBe(false);
    expect(g.game.moveHistory).toHaveLength(2);
  });

  test('New Game clears the result', () => {
    const g = loadGame();
    g.play('e2e4');
    g.game.resign();
    g.game.resetGame();
    expect(g.game.gameResult).toBeNull();
    expect(g.game.isGameOver).toBe(false);
    expect(el(g, 'undo-button').disabled).toBe(true);
  });
});

describe('Results of games ended by a move', () => {
  test('checkmate sets the result and undo clears it', () => {
    const g = loadGame();
    g.play('f2f3', 'e7e5', 'g2g4', 'd8h4');
    expect(g.game.gameResult).toBe('0-1');
    g.game.undoLastMove();
    expect(g.game.gameResult).toBeNull();
    expect(g.game.isGameOver).toBe(false);
  });

  test('a finished game saved before results were stored still gets one', () => {
    const first = loadGame();
    first.play('f2f3', 'e7e5', 'g2g4', 'd8h4');
    const saved = JSON.parse(first.window.localStorage.getItem('chessGameState'));
    delete saved.gameResult;
    delete saved.endedWithoutMove;
    const g = loadGame({ storage: { chessGameState: JSON.stringify(saved) } });
    expect(g.game.gameResult).toBe('0-1');
    expect(g.game.buildPGN()).toContain('[Result "0-1"]');
  });
});

describe('Draw by agreement', () => {
  test('two players: an offer, then acceptance', () => {
    const g = loadGame();
    g.play('e2e4');
    el(g, 'draw-button').click();
    expect(g.game.isGameOver).toBe(false);
    expect(el(g, 'draw-button').textContent).toBe('Accept draw?');
    expect(el(g, 'game-status').textContent).toBe("Black's turn (draw offered)");

    el(g, 'draw-button').click();
    expect(g.game.isGameOver).toBe(true);
    expect(g.game.gameResult).toBe('1/2-1/2');
    expect(g.game.currentStatus).toBe('Draw by agreement.');
    expect(g.game.buildPGN().split('\n\n')[1].trim()).toBe('1. e4 {Draw by agreement.} 1/2-1/2');
  });

  test('playing a move declines the offer', () => {
    const g = loadGame();
    g.play('e2e4');
    el(g, 'draw-button').click();
    g.play('e7e5');
    expect(el(g, 'draw-button').textContent).toBe('Offer draw');
    el(g, 'draw-button').click(); // A new offer, not an acceptance
    expect(g.game.isGameOver).toBe(false);
  });

  test('the computer accepts when it is not ahead', () => {
    const g = loadGame();
    g.play('e2e4', 'd7d5', 'e4d5'); // White is a pawn up
    g.game.setOpponent('easy', 'w'); // The computer takes Black, to move
    el(g, 'draw-button').click();
    expect(g.game.gameResult).toBe('1/2-1/2');
  });

  test('the computer declines when it is ahead', () => {
    const g = loadGame();
    g.play('e2e4', 'd7d5', 'e4d5', 'a7a6'); // White is a pawn up
    g.game.setOpponent('easy', 'b'); // The computer takes White
    el(g, 'draw-button').click();
    expect(g.game.isGameOver).toBe(false);
    expect(el(g, 'game-status').textContent).toContain('declines the draw');
  });
});
