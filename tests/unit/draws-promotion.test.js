const { loadGame } = require('../helpers/load-game');

const SAVE_KEY = 'chessGameState';
const click = (ctx, square) => {
  const { row, col } = ctx.utils.algebraicToCoords(square);
  ctx.game.handleBoardClick(row, col);
};
const choice = (ctx, piece) =>
  ctx.window.document.querySelector(`.promotion-choice[data-piece="${piece}"]`);
const dialog = (ctx) => ctx.window.document.getElementById('promotion-dialog');

describe('insufficient material', () => {
  test('capturing down to bare kings ends the game as a draw', () => {
    const ctx = loadGame();
    ctx.setPosition({ e1: 'wk*', e8: 'bk*', d2: 'bn' });
    ctx.play('e1d2');
    expect(ctx.game.isGameOver).toBe(true);
    expect(ctx.game.currentStatus).toBe('Draw by insufficient material.');
    expect(ctx.game.buildPGN()).toContain('[Result "1/2-1/2"]');
  });

  test('a lone bishop or knight, or same-coloured bishops, cannot win', () => {
    const ctx = loadGame();
    const { Piece } = ctx.pieces;
    const board = (placement) => {
      const b = Array.from({ length: 8 }, () => Array(8).fill(null));
      for (const [square, code] of Object.entries(placement)) {
        const { row, col } = ctx.utils.algebraicToCoords(square);
        b[row][col] = new Piece(code[1], code[0]);
      }
      return b;
    };
    const kings = { e1: 'wk', e8: 'bk' };
    expect(ctx.game.hasInsufficientMaterial(board({ ...kings, c1: 'wb' }))).toBe(true);
    expect(ctx.game.hasInsufficientMaterial(board({ ...kings, b8: 'bn' }))).toBe(true);
    expect(ctx.game.hasInsufficientMaterial(board({ ...kings, c1: 'wb', f8: 'bb' }))).toBe(true); // both on dark squares
    expect(ctx.game.hasInsufficientMaterial(board({ ...kings, c1: 'wb', c8: 'bb' }))).toBe(false); // opposite colours
    expect(ctx.game.hasInsufficientMaterial(board({ ...kings, b1: 'wn', g1: 'wn' }))).toBe(false);
    expect(ctx.game.hasInsufficientMaterial(board({ ...kings, a2: 'wp' }))).toBe(false);
    expect(ctx.game.hasInsufficientMaterial(board({ ...kings, a1: 'wr' }))).toBe(false);
  });
});

describe('threefold repetition', () => {
  const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];

  test('the third occurrence of a position ends the game', () => {
    const ctx = loadGame();
    ctx.play(...shuffle); // start position, second time
    expect(ctx.game.isGameOver).toBe(false);
    ctx.play(...shuffle.slice(0, 3));
    expect(ctx.game.isGameOver).toBe(false);
    ctx.play(shuffle[3]); // third time
    expect(ctx.game.isGameOver).toBe(true);
    expect(ctx.game.currentStatus).toBe('Draw by threefold repetition.');
  });

  test('losing a castling right makes the position a different one', () => {
    const ctx = loadGame();
    // The rook steps out and back: same placement, but White can no longer castle queenside
    ctx.play('a2a4', 'a7a5', 'a1a2', 'b8c6', 'a2a1', 'c6b8');
    ctx.play(...shuffle);
    ctx.play(...shuffle.slice(0, 3));
    expect(ctx.game.isGameOver).toBe(false);
    ctx.play(shuffle[3]);
    expect(ctx.game.isGameOver).toBe(true);
  });

  test('undo takes the draw back and it can be reached again', () => {
    const ctx = loadGame();
    ctx.play(...shuffle, ...shuffle);
    expect(ctx.game.isGameOver).toBe(true);
    ctx.game.undoLastMove();
    expect(ctx.game.isGameOver).toBe(false);
    expect(ctx.game.currentStatus).toBe("Black's turn");
    ctx.play('f6g8');
    expect(ctx.game.isGameOver).toBe(true);
  });

  test('repetition is still counted after a reload', () => {
    const first = loadGame();
    first.play(...shuffle, ...shuffle.slice(0, 3));
    const saved = first.window.localStorage.getItem(SAVE_KEY);

    const ctx = loadGame({ storage: { [SAVE_KEY]: saved } });
    expect(ctx.game.moveHistory).toHaveLength(7);
    ctx.play('f6g8');
    expect(ctx.game.currentStatus).toBe('Draw by threefold repetition.');
  });
});

describe('fifty-move rule', () => {
  // Kings and rooks walking in a pattern that never repeats a position three times
  // would take long to write out, so start from a saved game that is one move short.
  const nearFifty = (clock) => {
    const seed = loadGame();
    seed.setPosition({ a1: 'wk*', h8: 'bk*', b2: 'wr*', g7: 'br*' });
    seed.play('b2b3');
    const saved = JSON.parse(seed.window.localStorage.getItem(SAVE_KEY));
    saved.halfmoveClock = clock;
    return loadGame({ storage: { [SAVE_KEY]: JSON.stringify(saved) } });
  };

  test('the clock counts quiet moves and resets on a pawn move or capture', () => {
    const ctx = loadGame();
    ctx.play('g1f3', 'g8f6');
    expect(ctx.game.halfmoveClock).toBe(2);
    ctx.play('e2e4');
    expect(ctx.game.halfmoveClock).toBe(0);
    ctx.play('f6e4');
    expect(ctx.game.halfmoveClock).toBe(0);
    ctx.play('f1e2');
    expect(ctx.game.halfmoveClock).toBe(1);
    ctx.game.undoLastMove();
    ctx.game.undoLastMove();
    ctx.game.undoLastMove();
    expect(ctx.game.halfmoveClock).toBe(2);
  });

  test('the hundredth quiet half-move ends the game', () => {
    const ctx = nearFifty(98);
    ctx.play('g7g6');
    expect(ctx.game.isGameOver).toBe(false);
    ctx.play('b3b4');
    expect(ctx.game.isGameOver).toBe(true);
    expect(ctx.game.currentStatus).toBe('Draw by the fifty-move rule.');
  });

  test('checkmate on the hundredth half-move is still checkmate', () => {
    const seed = loadGame();
    seed.setPosition({ g6: 'wk*', h8: 'bk*', a1: 'wr*', b3: 'wn', c6: 'bn' });
    seed.play('b3c1');
    const saved = JSON.parse(seed.window.localStorage.getItem(SAVE_KEY));
    saved.halfmoveClock = 98;
    const ctx = loadGame({ storage: { [SAVE_KEY]: JSON.stringify(saved) } });
    ctx.play('c6d4', 'a1a8');
    expect(ctx.game.halfmoveClock).toBe(100);
    expect(ctx.game.currentStatus).toBe('Checkmate! White wins.');
  });

  test('a damaged clock in a saved game is read as zero', () => {
    const ctx = nearFifty('lots');
    expect(ctx.game.halfmoveClock).toBe(0);
    expect(ctx.game.moveHistory).toHaveLength(1);
  });
});

describe('promotion choice', () => {
  const ready = (options) => {
    const ctx = loadGame(options);
    ctx.setPosition({ e1: 'wk*', h6: 'bk*', b7: 'wp*', a8: 'br*' });
    return ctx;
  };

  test('makeMove promotes to the piece it is given, and to a queen by default', () => {
    const knight = ready();
    knight.game.makeMove(1, 1, 0, 1, 'n');
    expect(knight.at('b8')).toMatchObject({ type: 'n', color: 'w' });
    expect(knight.game.moveHistory[0].notation).toBe('b8=N');

    const queen = ready();
    queen.play('b7b8');
    expect(queen.at('b8').type).toBe('q');

    const bogus = ready();
    bogus.game.makeMove(1, 1, 0, 1, 'k');
    expect(bogus.at('b8').type).toBe('q');
  });

  test('a click move opens the chooser and holds the move until a piece is picked', () => {
    const ctx = ready();
    click(ctx, 'b7');
    click(ctx, 'a8'); // capture with promotion
    expect(dialog(ctx).hidden).toBe(false);
    expect(ctx.promotion.isPromotionChooserOpen()).toBe(true);
    expect(ctx.game.moveHistory).toHaveLength(0);
    expect(ctx.at('b7').type).toBe('p');

    // The board ignores clicks while the chooser is open
    click(ctx, 'e1');
    expect(ctx.board.selectedSquare).toBeNull();

    choice(ctx, 'r').click();
    expect(dialog(ctx).hidden).toBe(true);
    expect(ctx.at('a8')).toMatchObject({ type: 'r', color: 'w' });
    expect(ctx.game.moveHistory[0].notation).toBe('bxa8=R');
    expect(ctx.game.currentPlayer).toBe('b');
  });

  test('the choices are labelled buttons and the first one takes focus', () => {
    const ctx = ready();
    click(ctx, 'b7');
    click(ctx, 'b8');
    const buttons = Array.from(ctx.window.document.querySelectorAll('.promotion-choice'));
    expect(buttons.map((b) => b.tagName)).toEqual(['BUTTON', 'BUTTON', 'BUTTON', 'BUTTON']);
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Queen',
      'Rook',
      'Bishop',
      'Knight',
    ]);
    expect(ctx.window.document.activeElement).toBe(buttons[0]);

    const key = (name) =>
      buttons[0].dispatchEvent(
        new ctx.window.KeyboardEvent('keydown', { key: name, bubbles: true })
      );
    key('ArrowRight');
    expect(ctx.window.document.activeElement).toBe(buttons[1]);
  });

  test('Escape cancels and the pawn stays where it was', () => {
    const ctx = ready();
    click(ctx, 'b7');
    click(ctx, 'b8');
    dialog(ctx).dispatchEvent(
      new ctx.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    expect(dialog(ctx).hidden).toBe(true);
    expect(ctx.game.moveHistory).toHaveLength(0);
    expect(ctx.at('b7').type).toBe('p');
    expect(ctx.game.currentPlayer).toBe('w');

    // The move can be started again
    click(ctx, 'b7');
    click(ctx, 'b8');
    choice(ctx, 'q').click();
    expect(ctx.at('b8').type).toBe('q');
  });

  test('undo after a promotion restores the pawn', () => {
    const ctx = ready();
    const before = ctx.snapshot();
    click(ctx, 'b7');
    click(ctx, 'b8');
    choice(ctx, 'b').click();
    expect(ctx.at('b8').type).toBe('b');
    ctx.game.undoLastMove();
    expect(ctx.snapshot()).toEqual(before);
  });

  test('New Game closes an open chooser without playing the move', () => {
    const ctx = ready();
    click(ctx, 'b7');
    click(ctx, 'b8');
    ctx.game.resetGame();
    expect(dialog(ctx).hidden).toBe(true);
    expect(ctx.game.moveHistory).toHaveLength(0);
    expect(ctx.at('e2').type).toBe('p');
  });

  test('with the feature off the pawn becomes a queen at once', () => {
    const ctx = ready({
      configure: (config) => {
        config.FEATURES.PROMOTION_UI = false;
      },
    });
    click(ctx, 'b7');
    click(ctx, 'b8');
    expect(ctx.at('b8').type).toBe('q');
    expect(dialog(ctx)).toBeNull();
  });
});
