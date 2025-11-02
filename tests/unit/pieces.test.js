const { JSDOM } = require('jsdom');

describe('pieces', () => {
  let getInitialPieces;

  beforeEach(() => {
    const dom = new JSDOM(`<!DOCTYPE html><body></body>`, { url: 'http://localhost' });
    global.window = dom.window;
    global.document = dom.window.document;
    
    // Set up CONFIG and utils globals before requiring pieces
    const config = require('../../js/config');
    global.CONFIG = config.CONFIG;
    const utils = require('../../js/utils');
    global.isWithinBounds = utils.isWithinBounds;
    
    // Require pieces module
    const pieces = require('../../js/pieces');
    getInitialPieces = pieces.getInitialPieces;
  });

  test('initial pieces count', () => {
    const board = getInitialPieces();
    let count = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c]) count++;
      }
    }
    expect(count).toBe(32);
  });
});


