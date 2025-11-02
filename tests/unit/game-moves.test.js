const { JSDOM } = require('jsdom');

describe('game core', () => {
  let window, initializeGame, handleBoardClick, generateLegalMovesForPiece;

  beforeEach(() => {
    const dom = new JSDOM(`<!DOCTYPE html><body><div id="chess-board"></div><ul id="move-history"></ul><div id="game-status"></div><button id="reset-button"></button><button id="undo-button"></button></body>`, { url: 'http://localhost' });
    window = dom.window;
    global.window = window;
    global.document = window.document;
    global.localStorage = window.localStorage;
    
    // Set up globals in dependency order
    const config = require('../../js/config');
    global.CONFIG = config.CONFIG;
    
    const utils = require('../../js/utils');
    global.coordsToAlgebraic = utils.coordsToAlgebraic;
    global.algebraicToCoords = utils.algebraicToCoords;
    global.isWithinBounds = utils.isWithinBounds;
    global.deepClone = utils.deepClone;
    global.playSound = utils.playSound;
    global.debugLog = utils.debugLog;
    
    const pieces = require('../../js/pieces');
    global.PAWN = pieces.PAWN;
    global.ROOK = pieces.ROOK;
    global.KNIGHT = pieces.KNIGHT;
    global.BISHOP = pieces.BISHOP;
    global.QUEEN = pieces.QUEEN;
    global.KING = pieces.KING;
    global.WHITE = pieces.WHITE;
    global.BLACK = pieces.BLACK;
    global.Piece = pieces.Piece;
    global.isPseudoLegalMove = pieces.isPseudoLegalMove;
    global.getInitialPieces = pieces.getInitialPieces;
    
    const board = require('../../js/board');
    global.boardElement = board.boardElement;
    global.createBoard = board.createBoard;
    global.renderPieces = board.renderPieces;
    global.getSquareElement = board.getSquareElement;
    global.updateBoardVisuals = board.updateBoardVisuals;
    global.setSelectedSquare = board.setSelectedSquare;
    global.clearSelectedSquare = board.clearSelectedSquare;
    global.setPossibleMoves = board.setPossibleMoves;
    global.clearPossibleMoves = board.clearPossibleMoves;
    
    // Set up board state globals that game.js expects
    Object.defineProperty(global, 'selectedSquare', {
      get: () => board.selectedSquare,
      configurable: true
    });
    Object.defineProperty(global, 'possibleMoves', {
      get: () => board.possibleMoves,
      configurable: true
    });
    
    const game = require('../../js/game');
    initializeGame = game.initializeGame;
    handleBoardClick = game.handleBoardClick;
    generateLegalMovesForPiece = game.generateLegalMovesForPiece;
    
    // Set up game state globals that board.js functions expect
    // Use getters to always reference current state
    Object.defineProperty(global, 'moveHistory', {
      get: () => game.moveHistory,
      configurable: true
    });
    Object.defineProperty(global, 'boardState', {
      get: () => game.boardState,
      configurable: true
    });
    Object.defineProperty(global, 'currentPlayer', {
      get: () => game.currentPlayer,
      configurable: true
    });
    Object.defineProperty(global, 'isGameOver', {
      get: () => game.isGameOver,
      configurable: true
    });
    Object.defineProperty(global, 'kingPositions', {
      get: () => game.kingPositions,
      configurable: true
    });
    Object.defineProperty(global, 'currentStatus', {
      get: () => game.currentStatus,
      configurable: true
    });
    Object.defineProperty(global, 'enPassantTarget', {
      get: () => game.enPassantTarget,
      configurable: true
    });
    Object.defineProperty(global, 'positionHistory', {
      get: () => game.positionHistory,
      configurable: true
    });
    
    // Also attach to window for code that expects window.*
    window.initializeGame = initializeGame;
    window.handleBoardClick = handleBoardClick;
    window.generateLegalMovesForPiece = generateLegalMovesForPiece;
    Object.defineProperty(window, 'moveHistory', {
      get: () => game.moveHistory,
      configurable: true
    });
    
    initializeGame();
  });

  test('can make a legal opening move', () => {
    // e2 -> e4
    handleBoardClick(6, 4);
    const moves = generateLegalMovesForPiece(6, 4);
    expect(moves.some((m) => m.row === 4 && m.col === 4)).toBe(true);
  });
});


