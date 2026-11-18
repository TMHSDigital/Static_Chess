const { loadGame } = require('../helpers/load-game');

/** The piece element on a square, or null. */
const pieceOn = (g, square) => {
  const { row, col } = g.utils.algebraicToCoords(square);
  return g.board.getSquareElement(row, col).querySelector('.piece');
};
const squareEl = (g, square) => {
  const { row, col } = g.utils.algebraicToCoords(square);
  return g.board.getSquareElement(row, col);
};
const mouse = (g, type, target, x = 0, y = 0) =>
  target.dispatchEvent(
    new g.window.MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: x,
      clientY: y,
    })
  );
/** A touch event; each finger is { id, x, y }. */
const fingers = (g, type, target, touches, changed = touches) => {
  const event = new g.window.Event(type, { bubbles: true, cancelable: true });
  const asTouch = ({ id, x, y }) => ({ identifier: id, clientX: x, clientY: y });
  event.touches = touches.map(asTouch);
  event.changedTouches = changed.map(asTouch);
  target.dispatchEvent(event);
};

describe('drag and drop', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('a black piece cannot be picked up while White is to move', () => {
    const g = loadGame({ drag: true });
    const pawn = pieceOn(g, 'e7');
    mouse(g, 'mousedown', pawn, 100, 100);
    mouse(g, 'mousemove', g.window.document, 100, 140);
    expect(pawn.classList.contains('dragging')).toBe(false);
    expect(g.window.document.querySelector('.dragging')).toBeNull();
    expect(g.board.getSelectedSquare()).toBeNull();
  });

  test('a press that moves less than the threshold is a click: the piece stays selected', () => {
    const g = loadGame({ drag: true });
    const pawn = pieceOn(g, 'e2');
    const small = global.CONFIG.DRAG_THRESHOLD_PX;
    mouse(g, 'mousedown', pawn, 100, 100);
    mouse(g, 'mousemove', g.window.document, 100 + small, 100 - small);
    expect(pawn.classList.contains('dragging')).toBe(false);
    mouse(g, 'mouseup', g.window.document, 100 + small, 100 - small);
    mouse(g, 'click', pawn);
    expect(g.board.getSelectedSquare()).toEqual({ row: 6, col: 4 });
  });

  test('a drop where there is no square plays nothing and puts the piece back', () => {
    const g = loadGame({ drag: true });
    const pawn = pieceOn(g, 'e2');
    g.window.document.elementsFromPoint = () => [];
    mouse(g, 'mousedown', pawn, 100, 100);
    mouse(g, 'mousemove', g.window.document, 100, 60);
    mouse(g, 'mouseup', g.window.document, 100, 60);
    expect(g.game.moveHistory).toHaveLength(0);
    expect(pieceOn(g, 'e2')).toBe(pawn);
    expect(pawn.classList.contains('dragging')).toBe(false);
    expect(pawn.style.left).toBe('');
    expect(g.board.getSelectedSquare()).toBeNull();
  });

  test('the click after a drag is swallowed for a moment, then clicks work again', () => {
    const g = loadGame({ drag: true });
    g.window.document.elementsFromPoint = () => [squareEl(g, 'e4')];
    mouse(g, 'mousedown', pieceOn(g, 'e2'), 100, 100);
    mouse(g, 'mousemove', g.window.document, 100, 60);
    mouse(g, 'mouseup', g.window.document, 100, 60);
    expect(g.game.moveHistory).toHaveLength(1);
    expect('dragJustEnded' in g.window).toBe(false); // Nothing is shared through the window

    squareEl(g, 'e7').click(); // The click the browser fires after the drag
    expect(g.board.getSelectedSquare()).toBeNull();
    pieceOn(g, 'e7').click(); // Also when it lands on the piece itself
    expect(g.board.getSelectedSquare()).toBeNull();

    jest.advanceTimersByTime(global.CONFIG.DRAG_CLICK_GUARD_MS);
    squareEl(g, 'e7').click();
    expect(g.board.getSelectedSquare()).toEqual({ row: 1, col: 4 });
  });

  test('a touchmove of another finger does not move the piece being dragged', () => {
    const g = loadGame({ drag: true });
    const pawn = pieceOn(g, 'e2');
    const first = { id: 1, x: 100, y: 100 };
    fingers(g, 'touchstart', pawn, [first]);
    fingers(g, 'touchmove', g.window.document, [{ id: 2, x: 300, y: 20 }]);
    expect(pawn.classList.contains('dragging')).toBe(false); // Not lifted by the other finger
    expect(g.board.getSelectedSquare()).toBeNull();

    fingers(g, 'touchmove', g.window.document, [{ ...first, y: 60 }]);
    expect(pawn.classList.contains('dragging')).toBe(true);
    const left = pawn.style.left;
    const top = pawn.style.top;
    fingers(g, 'touchmove', g.window.document, [{ id: 2, x: 400, y: 400 }]);
    expect([pawn.style.left, pawn.style.top]).toEqual([left, top]);
  });
});
