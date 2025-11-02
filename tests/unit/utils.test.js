const { JSDOM } = require('jsdom');

describe('utils', () => {
  let algebraicToCoords, coordsToAlgebraic;

  beforeEach(() => {
    const dom = new JSDOM(`<!DOCTYPE html><body></body>`, { url: 'http://localhost' });
    global.window = dom.window;
    global.document = dom.window.document;
    global.localStorage = dom.window.localStorage;
    
    // Set up CONFIG global before requiring utils
    const config = require('../../js/config');
    global.CONFIG = config.CONFIG;
    
    // Require utils module
    const utils = require('../../js/utils');
    algebraicToCoords = utils.algebraicToCoords;
    coordsToAlgebraic = utils.coordsToAlgebraic;
  });

  test('coordsToAlgebraic and algebraicToCoords round-trip', () => {
    const positions = ['a1', 'h8', 'e4', 'b7'];
    positions.forEach((alg) => {
      const c = algebraicToCoords(alg);
      const back = coordsToAlgebraic(c.row, c.col);
      expect(back).toBe(alg);
    });
  });
});


