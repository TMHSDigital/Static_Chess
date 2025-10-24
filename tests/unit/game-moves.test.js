const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

function loadScripts(window) {
  ['js/utils.js', 'js/pieces.js', 'js/board.js', 'js/game.js'].forEach((p) => {
    const script = window.document.createElement('script');
    script.textContent = fs.readFileSync(path.resolve(p), 'utf-8');
    window.document.body.appendChild(script);
  });
}

describe('game core', () => {
  let window;

  beforeEach(() => {
    const dom = new JSDOM(`<!DOCTYPE html><body><div id="chess-board"></div><ul id="move-history"></ul><div id="game-status"></div><button id="reset-button"></button></body>`, { url: 'http://localhost' });
    window = dom.window;
    global.window = window;
    global.document = window.document;
    loadScripts(window);
    window.initializeGame();
  });

  test('can make a legal opening move', () => {
    // e2 -> e4
    window.handleBoardClick(6, 4);
    const moves = window.generateLegalMovesForPiece(6, 4);
    expect(moves.some((m) => m.row === 4 && m.col === 4)).toBe(true);
  });
});


