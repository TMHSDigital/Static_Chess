const { loadGame } = require('../helpers/load-game');

describe('game flow integration', () => {
  test('select move updates status and history', () => {
    const g = loadGame();
    // e2 -> e4 (6,4 to 4,4)
    g.game.handleBoardClick(6, 4);
    g.game.handleBoardClick(4, 4);
    expect(g.window.document.getElementById('game-status').textContent).toMatch(/Black's turn/);
    const items = g.window.document.querySelectorAll('#move-history li .white-move');
    expect(items.length).toBeGreaterThan(0);
    expect(items[items.length - 1].textContent).toMatch(/e4/);
  });

  test('a second game in the same file writes to its own page', () => {
    const g = loadGame();
    g.game.handleBoardClick(6, 3);
    g.game.handleBoardClick(4, 3);
    const items = g.window.document.querySelectorAll('#move-history li .white-move');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toMatch(/d4/);
  });
});
