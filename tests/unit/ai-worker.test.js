const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { loadGame } = require('../helpers/load-game');

const root = path.join(__dirname, '..', '..');
const notations = (g) => g.game.moveHistory.map((move) => move.notation);
const statusText = (g) => g.window.document.getElementById('game-status').textContent;
const E7E5 = { from: { row: 1, col: 4 }, to: { row: 3, col: 4 }, promotion: 'q' };

/**
 * Puts a stand-in for the browser's Worker on the global object. It records
 * what the page posts and answers only when the test says so.
 * @param {{broken?: boolean}} [options] - broken: the constructor throws.
 * @returns {object[]} Every worker the game has created so far.
 */
function installWorker(options = {}) {
  const created = [];
  global.Worker = class {
    constructor(url) {
      if (options.broken) throw new Error('Workers are not allowed here');
      this.url = url;
      this.messages = [];
      created.push(this);
    }

    postMessage(message) {
      this.messages.push(message);
    }

    terminate() {
      this.terminated = true;
    }

    /** Answers as ai-worker.js would. */
    reply(data) {
      this.onmessage({ data });
    }
  };
  return created;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  delete global.Worker;
  jest.useRealTimers();
});

describe('the computer opponent in a Web Worker', () => {
  test('the position is posted to the worker and nothing is played until it answers', () => {
    const workers = installWorker();
    const g = loadGame();
    g.game.setOpponent('easy', 'w');
    expect(workers).toHaveLength(0); // Not created before it is needed
    g.play('e2e4');

    expect(workers).toHaveLength(1);
    expect(workers[0].url).toBe('js/ai-worker.js');
    expect(workers[0].messages).toHaveLength(1);
    const message = workers[0].messages[0];
    expect(Object.keys(message).sort()).toEqual(['color', 'id', 'level', 'position', 'seen']);
    expect(message.color).toBe('b');
    expect(message.level).toBe('easy');
    expect(message.position).toEqual(g.game.livePosition());
    expect(message.seen).toHaveLength(1); // The position before 1. e4

    jest.runAllTimers();
    expect(notations(g)).toEqual(['e4']);
    expect(statusText(g)).toBe("Black's turn (computer is thinking)");
  });

  test('its answer is played after the pause', () => {
    const workers = installWorker();
    const g = loadGame();
    g.game.setOpponent('easy', 'w');
    g.play('e2e4');
    workers[0].reply({ id: workers[0].messages[0].id, move: E7E5 });

    jest.advanceTimersByTime(global.CONFIG.AI_MOVE_DELAY_MS - 1);
    expect(notations(g)).toEqual(['e4']);
    jest.advanceTimersByTime(1);
    expect(notations(g)).toEqual(['e4', 'e5']);
    expect(statusText(g)).toBe("White's turn");
  });

  test('a search that is no longer wanted is stopped, and the next request gets a fresh worker', () => {
    const workers = installWorker();
    const g = loadGame();
    g.game.setOpponent('easy', 'w');
    g.play('e2e4');
    const first = workers[0].messages[0].id;

    g.game.undoLastMove(); // While the computer is thinking
    expect(workers[0].terminated).toBe(true);
    jest.runAllTimers();
    expect(notations(g)).toEqual([]);

    g.play('d2d4');
    expect(workers).toHaveLength(2); // Not queued behind the abandoned search
    expect(workers[1].messages).toHaveLength(1);
    const second = workers[1].messages[0].id;
    expect(second).not.toBe(first);

    g.game.resetGame();
    expect(workers[1].terminated).toBe(true);
    jest.runAllTimers();
    expect(notations(g)).toEqual([]);
  });

  test('a hint that is overtaken by a move does not hold up the reply', () => {
    const workers = installWorker();
    const g = loadGame();
    g.game.setOpponent('easy', 'w');
    g.game.requestHint();
    expect(workers[0].messages).toHaveLength(1);

    g.play('e2e4'); // Before the hint arrives
    expect(workers[0].terminated).toBe(true);
    expect(workers).toHaveLength(2);
    expect(workers[1].messages[0].color).toBe('b');
    workers[1].reply({ id: workers[1].messages[0].id, move: E7E5 });
    jest.runAllTimers();
    expect(notations(g)).toEqual(['e4', 'e5']);
  });

  test('a worker that has answered is kept for the next request', () => {
    const workers = installWorker();
    const g = loadGame();
    g.game.setOpponent('easy', 'w');
    g.play('e2e4');
    workers[0].reply({ id: workers[0].messages[0].id, move: E7E5 });
    g.game.undoLastMove(); // Its answer is waiting to be played: nothing left to stop
    jest.runAllTimers();
    expect(notations(g)).toEqual([]);
    expect(workers[0].terminated).toBeUndefined();

    g.play('d2d4');
    expect(workers).toHaveLength(1);
    expect(workers[0].messages).toHaveLength(2);
    workers[0].reply({ id: workers[0].messages[0].id, move: E7E5 }); // An answer with an old id
    jest.runAllTimers();
    expect(notations(g)).toEqual(['d4']);
  });

  test('a worker that fails hands over to a search on the page, for good', () => {
    const workers = installWorker();
    const g = loadGame();
    g.game.setOpponent('easy', 'w');
    g.play('e2e4');

    const event = { preventDefault: jest.fn() };
    workers[0].onerror(event);
    expect(event.preventDefault).toHaveBeenCalled();
    jest.runAllTimers();
    expect(g.game.moveHistory).toHaveLength(2);

    const reply = g.game.generateAllLegalMoves('w')[0];
    g.game.makeMove(reply.from.row, reply.from.col, reply.to.row, reply.to.col);
    jest.runAllTimers();
    expect(g.game.moveHistory).toHaveLength(4);
    expect(workers).toHaveLength(1); // Not tried again
    expect(workers[0].messages).toHaveLength(1);
  });

  test('where a worker cannot be created the search runs on the page', () => {
    const workers = installWorker({ broken: true });
    const g = loadGame();
    g.game.setOpponent('easy', 'w');
    g.play('e2e4');
    jest.runAllTimers();
    expect(g.game.moveHistory).toHaveLength(2);
    expect(workers).toHaveLength(0);
  });
});

describe('ai-worker.js', () => {
  /** Runs the worker script as a browser would, with the worker globals stubbed. */
  function startWorker() {
    const posted = [];
    const imported = [];
    const sandbox = { console, Math, Date };
    sandbox.self = sandbox;
    sandbox.postMessage = (message) => posted.push(message);
    sandbox.importScripts = (...files) => {
      for (const file of files) {
        imported.push(file);
        vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), sandbox, {
          filename: file,
        });
      }
    };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(root, 'js', 'ai-worker.js'), 'utf8'), sandbox);
    return { sandbox, posted, imported };
  }

  test('answers a position with the id it was given and a legal move', () => {
    jest.useRealTimers();
    const g = loadGame();
    const { sandbox, posted } = startWorker();
    const position = g.rules.initialPosition();
    sandbox.onmessage({ data: { id: 7, position, color: 'w', level: 'medium', seen: [] } });

    expect(posted).toHaveLength(1);
    expect(posted[0].id).toBe(7);
    const { from, to, promotion } = posted[0].move;
    const legal = g.rules
      .legalMovesFrom(position, from.row, from.col)
      .some((target) => target.row === to.row && target.col === to.col);
    expect(legal).toBe(true);
    expect(promotion).toBe('q');
  });

  test('loads the scripts the page loads ahead of the board, in the same order', () => {
    const scripts = [
      ...fs
        .readFileSync(path.join(root, 'index.html'), 'utf8')
        .matchAll(/<script src="js\/([^"]+)"/g),
    ].map((match) => match[1]);
    expect(scripts.indexOf('board.js')).toBeGreaterThan(0);
    expect(startWorker().imported).toEqual(scripts.slice(0, scripts.indexOf('board.js')));
  });
});
