// ESLint v9 flat config
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script', // Vanilla JS, not modules
      globals: {
        ...globals.browser,
        // Allow tests to reference Node globals
        ...globals.node,
        // JSDOM/Jest globals (tests)
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        // Chess piece constants (from pieces.js)
        PAWN: 'readonly',
        ROOK: 'readonly',
        KNIGHT: 'readonly',
        BISHOP: 'readonly',
        QUEEN: 'readonly',
        KING: 'readonly',
        WHITE: 'readonly',
        BLACK: 'readonly',
        // Config and utilities (from config.js, utils.js)
        CONFIG: 'readonly',
        debugLog: 'readonly',
        isWithinBounds: 'readonly',
        isPseudoLegalMove: 'readonly',
        coordsToAlgebraic: 'readonly',
        algebraicToCoords: 'readonly',
        deepClone: 'readonly',
        getOppositeColor: 'readonly',
        // Board state (from board.js)
        selectedSquare: 'writable',
        possibleMoves: 'writable',
        getSquareElement: 'readonly',
        setSelectedSquare: 'readonly',
        clearSelectedSquare: 'readonly',
        setPossibleMoves: 'readonly',
        clearPossibleMoves: 'readonly',
        renderPieces: 'readonly',
        updateBoardVisuals: 'readonly',
        createBoard: 'readonly',
        boardElement: 'readonly',
        // Game state (from game.js)
        initializeGame: 'readonly',
        handleBoardClick: 'readonly',
        makeMove: 'readonly',
        resetGame: 'readonly',
        generateLegalMovesForPiece: 'readonly',
        generateAllLegalMoves: 'readonly',
        undoLastMove: 'readonly',
        findKingInCheck: 'readonly',
        isKingInCheck: 'readonly',
        moveHistory: 'readonly',
        boardState: 'readonly',
        currentPlayer: 'readonly',
        // Piece functions (from pieces.js)
        Piece: 'readonly',
        getInitialPieces: 'readonly',
        // Drag and drop (from drag.js)
        initDragAndDrop: 'readonly',
        // Promotion (from promotion.js)
        initPromotionUI: 'readonly',
        // AI (from ai.js)
        ChessAI: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off'
    }
  },
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.playwright/**'
    ]
  }
];


