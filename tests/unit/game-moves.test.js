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
    
    const game = require('../../js/game');
    initializeGame = game.initializeGame;
    handleBoardClick = game.handleBoardClick;
    generateLegalMovesForPiece = game.generateLegalMovesForPiece;
    
    // Also attach to window for code that expects window.*
    window.initializeGame = initializeGame;
    window.handleBoardClick = handleBoardClick;
    window.generateLegalMovesForPiece = generateLegalMovesForPiece;
    
    initializeGame();
  });

  test('can make a legal opening move', () => {
    // e2 -> e4
    handleBoardClick(6, 4);
    const moves = generateLegalMovesForPiece(6, 4);
    expect(moves.some((m) => m.row === 4 && m.col === 4)).toBe(true);
  });
});


