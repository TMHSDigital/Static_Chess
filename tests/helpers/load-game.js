const fs = require('fs');
const path = require('path');

const { JSDOM } = globalThis; // Provided by tests/helpers/jsdom-environment.js

const INDEX = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

/**
 * The page's scripts as index.html loads them, without main.js, which the
 * tests that need it start themselves: ['config', 'utils', ..., 'game'].
 */
const SCRIPT_ORDER = [...INDEX.matchAll(/<script src="js\/([\w-]+)\.js"/g)]
  .map((match) => match[1])
  .filter((name) => name !== 'main');

/**
 * Gives a module's exports the reach they have in the browser, where the
 * scripts share one global scope. A getter stays a getter, so state such as
 * game.js's moveHistory is read live.
 */
function share(exports) {
  for (const [name, property] of Object.entries(Object.getOwnPropertyDescriptors(exports))) {
    if (typeof property.get === 'function') {
      Object.defineProperty(global, name, { get: () => exports[name], configurable: true });
    } else {
      Object.defineProperty(global, name, {
        value: property.value,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
  }
}

// The page's own markup, without its scripts: the tests load those themselves
const HTML = `<!DOCTYPE html><body>${/<body[^>]*>([\s\S]*)<\/body>/
  .exec(INDEX)[1]
  .replace(/<script[\s\S]*?<\/script>/g, '')}</body>`;

let previous = null; // The game and window of the last loadGame() call, until cleaned up

/** Stops the previous game's timers and closes its window, if there is one. */
function cleanupPreviousGame() {
  if (!previous) return;
  const { game, window } = previous;
  previous = null;
  try {
    game.stopAllTimers();
  } finally {
    window.close();
  }
}

// A test that ends with a clock running or the computer thinking must not leak
// either into the next test: clean up after every test, not just when the next
// game is built. Every file that requires this helper does so at the top level,
// so this registers once per file.
afterEach(cleanupPreviousGame);

/**
 * Loads a fresh copy of the game into a new JSDOM. Modules are reset first, so
 * every call gets its own DOM and game state.
 * @param {{ drag?: boolean, storage?: Object<string, string>, brokenStorage?: boolean, configure?: (config: object) => void, deferStart?: boolean }} [options]
 *   drag: also load and start drag.js. storage: values to put in localStorage before
 *   the game starts. brokenStorage: make every localStorage call throw. configure:
 *   a function that may change CONFIG before the game loads. deferStart: leave
 *   initializeGame to the caller, as when main.js starts the page.
 */
function loadGame(options = {}) {
  cleanupPreviousGame();
  jest.resetModules();
  const dom = new JSDOM(HTML, { url: 'http://localhost' });
  const window = dom.window;
  global.window = window;
  global.document = window.document;
  for (const [key, value] of Object.entries(options.storage || {})) {
    window.localStorage.setItem(key, value);
  }
  const blocked = () => {
    throw new Error('storage is blocked');
  };
  global.localStorage = options.brokenStorage
    ? { getItem: blocked, setItem: blocked, removeItem: blocked }
    : window.localStorage;

  // Every script of the page, in the order index.html loads it
  const modules = {};
  for (const name of SCRIPT_ORDER) {
    modules[name] = require(`../../js/${name}`);
    if (name === 'config' && options.configure) options.configure(modules.config.CONFIG);
    share(modules[name]);
  }
  const { utils, pieces, rules, ai, board, drag, promotion, notation, game } = modules;
  const store = modules['game-store'];
  const ui = modules['game-ui'];
  const clockRules = modules.clock;

  if (!options.deferStart) game.initializeGame();

  if (options.drag) {
    drag.initDragAndDrop();
  }

  /** Plays moves given as algebraic pairs, for example play('e2e4', 'e7e5'). */
  function play(...moves) {
    for (const m of moves) {
      const from = utils.algebraicToCoords(m.slice(0, 2));
      const to = utils.algebraicToCoords(m.slice(2, 4));
      const legal = game.generateLegalMovesForPiece(from.row, from.col);
      if (!legal.some((l) => l.row === to.row && l.col === to.col)) {
        throw new Error(`Illegal move in test: ${m}`);
      }
      game.makeMove(from.row, from.col, to.row, to.col);
    }
  }

  /**
   * Replaces the position. placement maps squares to two-letter codes, colour then
   * piece type, with an optional trailing "*" for a piece that has already moved:
   * setPosition({ e1: 'wk', a1: 'wr', e8: 'bk*' }). turn is the side to move.
   */
  function setPosition(placement, turn = pieces.WHITE) {
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    const kingPositions = rules.initialPosition().kingPositions;
    for (const [square, code] of Object.entries(placement)) {
      const { row, col } = utils.algebraicToCoords(square);
      const piece = new pieces.Piece(code[1], code[0]);
      piece.hasMoved = code.endsWith('*');
      board[row][col] = piece;
      if (piece.type === pieces.KING) {
        kingPositions[piece.color] = { row, col };
      }
    }
    game.startGameFrom({ board, kingPositions, enPassantTarget: null }, turn);
  }

  const at = (square) => {
    const { row, col } = utils.algebraicToCoords(square);
    return game.boardState[row][col];
  };
  const movesFrom = (square) => {
    const { row, col } = utils.algebraicToCoords(square);
    return game
      .generateLegalMovesForPiece(row, col)
      .map((m) => utils.coordsToAlgebraic(m.row, m.col))
      .sort();
  };
  /** A comparable picture of everything undo has to restore. */
  const snapshot = () =>
    JSON.parse(
      JSON.stringify({
        board: game.boardState,
        player: game.currentPlayer,
        kings: game.kingPositions,
        enPassant: game.enPassantTarget,
        clock: game.halfmoveClock,
        notations: game.moveHistory.map((m) => m.notation),
      })
    );

  previous = { game, window };
  return {
    window,
    game,
    board,
    drag,
    utils,
    pieces,
    rules,
    ai,
    promotion,
    notation,
    store,
    ui,
    clockRules,
    play,
    setPosition,
    at,
    movesFrom,
    snapshot,
  };
}

module.exports = { loadGame, SCRIPT_ORDER };
