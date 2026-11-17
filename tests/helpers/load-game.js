const { JSDOM } = globalThis; // Provided by tests/helpers/jsdom-environment.js

const HTML = `<!DOCTYPE html><body><div id="chess-board"></div><ul id="move-history"></ul><div id="step-buttons"><button data-step="first"></button><button data-step="previous"></button><button data-step="next"></button><button data-step="last"></button></div><div id="captured-by-black"></div><div id="captured-by-white"></div><span id="clock-black" hidden></span><span id="clock-white" hidden></span><div id="game-status"></div><p id="review-score" hidden></p><div id="review-actions" hidden><button id="live-button" hidden>Back to game</button><button id="play-here-button">Play from here</button></div><button id="hint-button">Hint</button><button id="draw-button">Offer draw</button><button id="resign-button">Resign</button><button id="undo-button">Undo</button><button id="pgn-button">Copy PGN</button><button id="download-button">Save PGN</button><button id="fen-button">Copy FEN</button><button id="import-button">Load PGN</button><button id="reset-button">New Game</button><div id="import-dialog" hidden><textarea id="import-text"></textarea><p id="import-error"></p><button id="import-file-button">Open file</button><input id="import-file" type="file" hidden /><button id="import-cancel">Cancel</button><button id="import-load">Load game</button><div id="archive-section" hidden><ul id="archive-list"></ul><button id="archive-clear">Clear all</button></div></div></body>`;

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
 * @param {{ drag?: boolean, storage?: Object<string, string>, brokenStorage?: boolean, deferStart?: boolean }} [options]
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

  const config = require('../../js/config').CONFIG;
  if (options.configure) options.configure(config);
  Object.assign(global, { CONFIG: config });

  const utils = require('../../js/utils');
  const pieces = require('../../js/pieces');
  Object.assign(global, utils, pieces);
  const rules = require('../../js/rules');
  Object.assign(global, rules);
  const ai = require('../../js/ai');
  Object.assign(global, ai);

  const board = require('../../js/board');
  Object.assign(global, {
    boardElement: board.boardElement,
    createBoard: board.createBoard,
    renderPieces: board.renderPieces,
    getSquareElement: board.getSquareElement,
    updateBoardVisuals: board.updateBoardVisuals,
    setSelectedSquare: board.setSelectedSquare,
    clearSelectedSquare: board.clearSelectedSquare,
    setPossibleMoves: board.setPossibleMoves,
    clearPossibleMoves: board.clearPossibleMoves,
    getSelectedSquare: board.getSelectedSquare,
    getPossibleMoves: board.getPossibleMoves,
    setBoardFlipped: board.setBoardFlipped,
  });

  const promotion = require('../../js/promotion');
  Object.assign(global, promotion);

  // The files game.js builds on, in the order index.html loads them
  for (const name of [
    'notation',
    'saved-game',
    'game-store',
    'clock',
    'review',
    'engine-bridge',
    'game-ui',
  ]) {
    Object.assign(global, require(`../../js/${name}`));
  }

  const game = require('../../js/game');
  for (const name of [
    'moveHistory',
    'boardState',
    'currentPlayer',
    'isGameOver',
    'kingPositions',
    'currentStatus',
    'enPassantTarget',
    'positionHistory',
    'halfmoveClock',
  ]) {
    Object.defineProperty(global, name, { get: () => game[name], configurable: true });
  }
  // The scripts share one global scope in the browser; give the functions the
  // other files call the same reach here
  for (const [name, property] of Object.entries(Object.getOwnPropertyDescriptors(game))) {
    if (typeof property.value === 'function') global[name] = property.value;
  }

  if (!options.deferStart) game.initializeGame();

  const drag = require('../../js/drag');
  Object.assign(global, drag);
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
    play,
    setPosition,
    at,
    movesFrom,
    snapshot,
  };
}

module.exports = { loadGame };
