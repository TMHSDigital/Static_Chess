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
      jest.advanceTimersByTime(global.CONFIG.RESET_CONFIRM_MS + 1);
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
