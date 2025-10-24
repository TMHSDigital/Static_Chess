const { JSDOM } = require('jsdom');

// Load utils.js into jsdom environment
function loadScripts(window) {
  const script = window.document.createElement('script');
  script.textContent = require('fs').readFileSync(require('path').resolve('js/utils.js'), 'utf-8');
  window.document.body.appendChild(script);
}

describe('utils', () => {
  let window;

  beforeEach(() => {
    const dom = new JSDOM(`<!DOCTYPE html><body></body>`, { url: 'http://localhost' });
    window = dom.window;
    global.window = window;
    global.document = window.document;
    global.localStorage = window.localStorage;
    loadScripts(window);
  });

  test('coordsToAlgebraic and algebraicToCoords round-trip', () => {
    const { algebraicToCoords, coordsToAlgebraic } = window;
    const positions = ['a1', 'h8', 'e4', 'b7'];
    positions.forEach((alg) => {
      const c = algebraicToCoords(alg);
      const back = coordsToAlgebraic(c.row, c.col);
      expect(back).toBe(alg);
    });
  });
});


