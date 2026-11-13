const { JSDOM } = require('jsdom');

describe('utils', () => {
  let algebraicToCoords, coordsToAlgebraic, isWithinBounds, deepClone;

  beforeEach(() => {
    const dom = new JSDOM(`<!DOCTYPE html><body></body>`, { url: 'http://localhost' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;

    // Set up CONFIG global before requiring utils
    const config = require('../../js/config');
    global.CONFIG = config.CONFIG;

    ({ algebraicToCoords, coordsToAlgebraic, isWithinBounds, deepClone } = require('../../js/utils'));

    // Invalid input is reported with console.error; keep the test output clean
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('coordsToAlgebraic and algebraicToCoords round-trip', () => {
    const positions = ['a1', 'h8', 'e4', 'b7'];
    positions.forEach((alg) => {
      const c = algebraicToCoords(alg);
      const back = coordsToAlgebraic(c.row, c.col);
      expect(back).toBe(alg);
    });
  });

  test('algebraicToCoords rejects squares that are not on the board', () => {
    for (const bad of ['i1', 'a9', 'a0', '', null, undefined, 'e44', 42]) {
      expect(algebraicToCoords(bad)).toBeNull();
    }
  });

  test('algebraicToCoords accepts an upper-case file', () => {
    expect(algebraicToCoords('E4')).toEqual({ row: 4, col: 4 });
  });

  test('coordsToAlgebraic rejects coordinates off the board', () => {
    expect(coordsToAlgebraic(8, 0)).toBeNull();
    expect(coordsToAlgebraic(-1, 0)).toBeNull();
    expect(coordsToAlgebraic(0, 8)).toBeNull();
  });

  test('isWithinBounds at the edges', () => {
    expect(isWithinBounds(0, 0)).toBe(true);
    expect(isWithinBounds(7, 7)).toBe(true);
    expect(isWithinBounds(-1, 0)).toBe(false);
    expect(isWithinBounds(0, 8)).toBe(false);
    expect(isWithinBounds(8, 0)).toBe(false);
  });

  test('deepClone makes an independent copy of a nested board', () => {
    const board = [[{ type: 'r', color: 'w', hasMoved: false }, null], [null, { type: 'k', color: 'b', hasMoved: true }]];
    const copy = deepClone(board);
    expect(copy).toEqual(board);
    expect(copy).not.toBe(board);
    expect(copy[0]).not.toBe(board[0]);
    expect(copy[0][0]).not.toBe(board[0][0]);

    copy[0][0].hasMoved = true;
    copy[1][0] = { type: 'p', color: 'w' };
    expect(board[0][0].hasMoved).toBe(false);
    expect(board[1][0]).toBeNull();
  });
});
