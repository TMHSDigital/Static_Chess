// ESLint v9 flat config
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script', // Vanilla JS files are scripts
      globals: {
        ...globals.browser,
        ...globals.node,
        // JSDOM/Jest globals (tests)
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        // Cross-file dependencies (used but not declared in some files)
        // These are declared in their respective files but used elsewhere
        CONFIG: 'readonly',
        debugLog: 'readonly',
        PAWN: 'readonly',
        ROOK: 'readonly',
        KNIGHT: 'readonly',
        BISHOP: 'readonly',
        QUEEN: 'readonly',
        KING: 'readonly',
        WHITE: 'readonly',
        BLACK: 'readonly',
        isWithinBounds: 'readonly',
        isPseudoLegalMove: 'readonly',
        coordsToAlgebraic: 'readonly',
        algebraicToCoords: 'readonly',
        deepClone: 'readonly',
        getOppositeColor: 'readonly',
        playSound: 'readonly',
        Piece: 'readonly',
        getInitialPieces: 'readonly',
        getSquareElement: 'readonly',
        setSelectedSquare: 'readonly',
        clearSelectedSquare: 'readonly',
        setPossibleMoves: 'readonly',
        clearPossibleMoves: 'readonly',
        renderPieces: 'readonly',
        updateBoardVisuals: 'readonly',
        createBoard: 'readonly',
        boardElement: 'readonly',
        initializeGame: 'readonly',
        handleBoardClick: 'readonly',
        makeMove: 'readonly',
        resetGame: 'readonly',
        generateLegalMovesForPiece: 'readonly',
        generateAllLegalMoves: 'readonly',
        undoLastMove: 'readonly',
        findKingInCheck: 'readonly',
        isKingInCheck: 'readonly',
        initDragAndDrop: 'readonly',
        initPromotionUI: 'readonly',
        ChessAI: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-redeclare': 'off' // Allow redeclaring globals since we use global scope intentionally
    }
  },
  {
    files: ['js/**/*.js'],
    languageOptions: {
      globals: {
        // State variables that are writable
        selectedSquare: 'writable',
        possibleMoves: 'writable',
        boardState: 'writable',
        currentPlayer: 'writable',
        moveHistory: 'writable',
        isGameOver: 'writable',
        kingPositions: 'writable',
        currentStatus: 'writable',
        enPassantTarget: 'writable',
        positionHistory: 'writable'
      }
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


