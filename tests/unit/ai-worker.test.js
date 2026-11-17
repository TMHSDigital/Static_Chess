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
    expect(Object.keys(message).sort()).toEqual([
      'budgetMs',
      'color',
      'id',
      'level',
      'position',
      'seen',
    ]);
    expect(message.budgetMs).toBeNull(); // No clock in this game
    expect(message.color).toBe('b');
    expect(message.level).toBe('easy');
    expect(message.position).toEqual(g.game.livePosition());
    expect(message.seen).toHaveLength(1); // The position before 1. e4

    jest.runAllTimers();
    expect(notations(g)).toEqual(['e4']);
    expect(statusText(g)).toBe("Black's turn (computer is thinking)");
  });

  test('the player bars say who is who, whose move it is and when the computer thinks', () => {
    const workers = installWorker();
    const g = loadGame();
    expect(g.game.playersView()).toEqual({
      w: { name: 'White', toMove: true, thinking: false },
      b: { name: 'Black', toMove: false, thinking: false },
    });

    g.game.setOpponent('medium', 'w');
    g.play('e2e4');
    expect(g.game.playersView()).toEqual({
      w: { name: 'You', toMove: false, thinking: false },
      b: { name: 'Computer (medium)', toMove: true, thinking: true },
    });

    workers[0].reply({ id: workers[0].messages[0].id, move: E7E5 });
    jest.runAllTimers();
    expect(g.game.playersView().b.thinking).toBe(false);
    expect(g.game.playersView().w.toMove).toBe(true);

    g.game.viewMove(1); // Looking back: nobody is marked as to move
    expect(g.game.playersView().w.toMove).toBe(false);
    g.game.returnToLiveGame();
    g.game.resign();
    expect(g.game.playersView().w.toMove).toBe(false); // Nor in a finished game

    g.game.setOpponent('hard', 'b'); // The person plays Black from the next game on
    expect(g.game.playersView().b.name).toBe('Computer (medium)'); // The finished game keeps its players
    g.game.resetGame();
    expect(g.game.playersView().w.name).toBe('Computer (hard)');
    expect(g.game.playersView().b.name).toBe('You');
    g.game.stopAllTimers();
  });

  test('in a game on the clock the worker is told how long it may think', () => {
    const workers = installWorker();
    const g = loadGame();
    g.game.setTimeControl('1+0');
    g.game.setOpponent('hard', 'w');
    g.play('e2e4');
    expect(workers[0].messages[0].budgetMs).toBe(2000); // A thirtieth of the minute it has
    g.game.setOpponent(null);
  });

  test('a hint is not budgeted against the clock of the player who asked for it', () => {
    const workers = installWorker();
    const g = loadGame();
    g.game.setTimeControl('10+0');
    g.play('e2e4'); // Black is on the clock
    g.game.requestHint();
    expect(workers[0].messages[0].color).toBe('b');
    expect(workers[0].messages[0].budgetMs).toBeNull(); // The hint level's usual time
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

  test("a hint for an earlier position has a worker of its own and leaves the computer's alone", () => {
    const workers = installWorker();
    const g = loadGame();
    g.game.setTimeControl('5+0');
    g.game.resetGame();
    g.game.setOpponent('easy', 'w');
    g.play('e2e4'); // The computer is thinking about its reply
    expect(workers).toHaveLength(1);

    g.game.viewMove(0);
    g.game.requestHint();
    expect(workers).toHaveLength(2);
    expect(workers[0].terminated).toBeUndefined();
    const [question] = workers[1].messages;
    expect(question.color).toBe('w');
    expect(question.position).toEqual(g.rules.initialPosition());
    expect(question.seen).toEqual([]); // Nothing came before the starting position
    expect(question.budgetMs).toBeNull(); // Not on anybody's clock

    workers[1].reply({
      id: question.id,
      move: { from: { row: 6, col: 3 }, to: { row: 4, col: 3 } },
    });
    expect(g.game.hintMove.to).toEqual({ row: 4, col: 3 });
    expect(notations(g)).toEqual(['e4']);

    workers[0].reply({ id: workers[0].messages[0].id, move: E7E5 });
    jest.runAllTimers();
    expect(notations(g)).toEqual(['e4', 'e5']); // The reply came through
    g.game.stopAllTimers();
  });

  test('a finished game is sent to a worker to be scored, once', () => {
    const workers = installWorker();
    const g = loadGame();
    g.play('f2f3', 'e7e5', 'g2g4');
    expect(workers).toHaveLength(0); // Nothing is scored while the game is on
    g.play('d8h4');

    expect(workers).toHaveLength(1);
    expect(workers[0].messages).toHaveLength(1);
    const [question] = workers[0].messages;
    expect(Object.keys(question).sort()).toEqual(['assess', 'id']);
    expect(question.assess.map((entry) => entry.color)).toEqual(['w', 'b', 'w', 'b', 'w']);
    expect(question.assess[0].position).toEqual(g.rules.initialPosition());
    expect(question.assess[4].position).toEqual(g.game.livePosition());

    g.game.viewMove(2); // Looking around does not ask again
    g.game.returnToLiveGame();
    expect(workers[0].messages).toHaveLength(1);
    expect(g.game.gameScores).toBeNull();

    const even = { score: 0, mate: false, over: false };
    const scores = [
      even,
      even,
      even,
      { score: -99000, mate: true, over: false },
      { score: -99000, mate: true, over: true },
    ];
    workers[0].reply({ id: question.id, scores });
    expect(g.game.gameScores).toEqual(scores);
    const marked = [...g.window.document.querySelectorAll('#move-history .lost-ground')];
    expect(marked.map((entry) => entry.textContent)).toEqual(['g4']);
  });

  test('scores that arrive after the game went on are ignored', () => {
    const workers = installWorker();
    const g = loadGame();
    g.play('f2f3', 'e7e5', 'g2g4', 'd8h4');
    const [question] = workers[0].messages;
    g.game.undoLastMove();
    expect(workers[0].terminated).toBe(true); // Nobody wants the answer any more

    workers[0].reply({ id: question.id, scores: [] });
    expect(g.game.gameScores).toBeNull();
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

  test('a worker that fails before it ever answers hands over to the page, for good', () => {
    const workers = installWorker();
    const g = loadGame();
    g.game.setOpponent('easy', 'w');
    g.play('e2e4');

    const event = { preventDefault: jest.fn() };
    workers[0].onerror(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(workers[0].terminated).toBe(true);
    jest.runAllTimers();
    expect(g.game.moveHistory).toHaveLength(2);

    const reply = g.game.generateAllLegalMoves('w')[0];
    g.game.makeMove(reply.from.row, reply.from.col, reply.to.row, reply.to.col);
    jest.runAllTimers();
    expect(g.game.moveHistory).toHaveLength(4);
    expect(workers).toHaveLength(1); // Not tried again
    expect(workers[0].messages).toHaveLength(1);
  });

  test('giving up on workers also shuts down those of the other channels', () => {
    const workers = installWorker();
    loadGame();
    const position = { position: global.initialPosition(), color: 'w' };
    global.askEngineForScores([position], () => {}, 'review-scores');
    global.askEngineForScores([position], () => {}, 'other');
    expect(workers).toHaveLength(2);
    workers[0].onerror({});
    expect(workers.map((worker) => worker.terminated)).toEqual([true, true]);
  });

  describe('a worker that fails after it has answered', () => {
    /** A game against the computer whose worker has answered once and is now thinking again. */
    const thinkingAgain = () => {
      const workers = installWorker();
      const g = loadGame();
      g.game.setOpponent('easy', 'w');
      g.play('e2e4');
      workers[0].reply({ id: workers[0].messages[0].id, move: E7E5 });
      jest.runAllTimers();
      g.play('g1f3'); // The worker is asked again
      return { workers, g };
    };

    test('is replaced, and the request goes to the new worker', () => {
      const { workers, g } = thinkingAgain();
      workers[0].onerror({});
      expect(workers[0].terminated).toBe(true);
      expect(workers).toHaveLength(2);
      expect(workers[1].messages).toEqual([workers[0].messages[1]]);

      const legal = g.game.generateAllLegalMoves('b')[0];
      workers[1].reply({ id: workers[1].messages[0].id, move: legal });
      jest.runAllTimers();
      expect(g.game.moveHistory).toHaveLength(4);
    });

    test('if the new one fails too, that answer is found on the page, and workers are still used', () => {
      const { workers, g } = thinkingAgain();
      workers[0].onerror({});
      workers[1].onerror({});
      expect(workers[1].terminated).toBe(true);
      jest.runAllTimers();
      expect(g.game.moveHistory).toHaveLength(4); // Answered on the page

      g.play('b1c3');
      expect(workers).toHaveLength(3); // The next request goes to a worker again
      expect(workers[2].messages).toHaveLength(1);
    });
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

  test('answers a list of positions with a score for each', () => {
    jest.useRealTimers();
    const g = loadGame();
    const { sandbox, posted } = startWorker();
    const start = g.rules.initialPosition();
    const queenUp = g.rules.positionFromFEN('4k3/8/8/8/8/8/8/3QK3 w - - 0 1').position;
    sandbox.onmessage({
      data: {
        id: 9,
        assess: [
          { position: start, color: 'w' },
          { position: queenUp, color: 'w' },
        ],
      },
    });

    expect(posted).toHaveLength(1);
    expect(posted[0].id).toBe(9);
    expect(posted[0].move).toBeUndefined();
    expect(posted[0].scores).toHaveLength(2);
    expect(posted[0].scores[0]).toEqual({ score: expect.any(Number), mate: false, over: false });
    expect(Math.abs(posted[0].scores[0].score)).toBeLessThan(100);
    expect(posted[0].scores[1].score).toBeGreaterThan(700);
  });

  test('runs under require too, so the coverage report counts it', () => {
    jest.useRealTimers();
    const g = loadGame(); // Puts the engine's functions on the global object, as importScripts would
    const posted = [];
    const imported = [];
    global.self = { postMessage: (message) => posted.push(message) };
    global.importScripts = (...files) => imported.push(...files);
    try {
      jest.isolateModules(() => require('../../js/ai-worker'));
      expect(imported).toEqual(['config.js', 'utils.js', 'pieces.js', 'rules.js', 'ai.js']);
      const position = g.rules.initialPosition();
      global.self.onmessage({ data: { id: 3, position, color: 'w', level: 'easy', seen: [] } });
      global.self.onmessage({ data: { id: 4, assess: [{ position, color: 'b' }] } });
      expect(posted.map((message) => message.id)).toEqual([3, 4]);
      expect(posted[0].move).toEqual(expect.objectContaining({ from: expect.any(Object) }));
      expect(posted[1].scores).toHaveLength(1);
    } finally {
      delete global.self;
      delete global.importScripts;
    }
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
