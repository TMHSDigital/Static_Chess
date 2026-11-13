const { JSDOM } = globalThis; // Provided by tests/helpers/jsdom-environment.js

const HTML = `<!DOCTYPE html><body><div id="chess-board"></div><ul id="move-history"></ul><div id="game-status"></div><button id="undo-button">Undo</button><button id="pgn-button">Copy PGN</button><button id="reset-button">New Game</button></body>`;

/**
 * Loads a fresh copy of the game into a new JSDOM. Modules are reset first, so
 * every call gets its own DOM and game state.
 * @param {{ drag?: boolean, storage?: Object<string, string>, brokenStorage?: boolean }} [options]
 *   drag: also load and start drag.js. storage: values to put in localStorage before
 *   the game starts. brokenStorage: make every localStorage call throw. configure:
 *   a function that may change CONFIG before the game loads.
 */
function loadGame(options = {}) {
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

  game.initializeGame();

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
   * setPosition({ e1: 'wk', a1: 'wr', e8: 'bk*' }).
   */
  function setPosition(placement, turn = pieces.WHITE) {
    if (game.currentPlayer !== pieces.WHITE || game.moveHistory.length > 0) {
      throw new Error('setPosition must be called on a fresh game');
    }
    const b = game.boardState;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) b[r][c] = null;
    for (const [square, code] of Object.entries(placement)) {
      const { row, col } = utils.algebraicToCoords(square);
      const piece = new pieces.Piece(code[1], code[0]);
      piece.hasMoved = code.endsWith('*');
      b[row][col] = piece;
      if (piece.type === pieces.KING) {
        game.kingPositions[piece.color] = { row, col };
      }
    }
    if (turn !== pieces.WHITE) {
      throw new Error('setPosition only supports White to move');
    }
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
