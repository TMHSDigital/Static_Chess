const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

function loadScripts(window) {
  ['js/utils.js', 'js/pieces.js'].forEach((p) => {
    const script = window.document.createElement('script');
    script.textContent = fs.readFileSync(path.resolve(p), 'utf-8');
    window.document.body.appendChild(script);
  });
}

describe('pieces', () => {
  let window;

  beforeEach(() => {
    const dom = new JSDOM(`<!DOCTYPE html><body></body>`);
    window = dom.window;
    global.window = window;
    global.document = window.document;
    loadScripts(window);
  });

  test('initial pieces count', () => {
    const board = window.getInitialPieces();
    let count = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c]) count++;
      }
    }
    expect(count).toBe(32);
  });
});


