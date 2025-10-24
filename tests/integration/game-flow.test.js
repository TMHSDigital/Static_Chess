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

describe('integration: game flow', () => {
  let window;

  beforeEach(() => {
    const dom = new JSDOM(
      `<!DOCTYPE html><body>
        <div id="chess-board"></div>
        <ul id="move-history"></ul>
        <div id="game-status"></div>
        <button id="reset-button"></button>
      </body>`,
      { url: 'http://localhost' }
    );
    window = dom.window;
    global.window = window;
    global.document = window.document;
    loadScripts(window);
    window.initializeGame();
  });

  test('select move updates status and history', () => {
    // e2 -> e4 (6,4 to 4,4)
    window.handleBoardClick(6, 4);
    window.handleBoardClick(4, 4);
    expect(window.document.getElementById('game-status').textContent).toMatch(/Black's turn/);
    const items = window.document.querySelectorAll('#move-history li .white-move');
    expect(items.length).toBeGreaterThan(0);
    expect(items[items.length - 1].textContent).toMatch(/e4/);
  });
});


