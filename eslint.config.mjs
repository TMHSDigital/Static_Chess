// ESLint v9 flat config
// Structured to avoid redeclare errors by only adding globals to files that USE them, not DECLARE them
import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off'
    }
  },
  // This config file is the only ES module in the repository
  {
    files: ['**/*.mjs'],
    languageOptions: {
      sourceType: 'module'
    }
  },
  // Test files
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly'
      }
    }
  },
  // config.js - declares CONFIG, uses nothing
  {
    files: ['js/config.js'],
    languageOptions: {
      globals: {}
    }
  },
  // utils.js - declares utilities, uses CONFIG, WHITE, BLACK
  {
    files: ['js/utils.js'],
    languageOptions: {
      globals: {
        CONFIG: 'readonly',
        WHITE: 'readonly',
        BLACK: 'readonly'
      }
    }
  },
  // pieces.js - declares constants/Piece/getInitialPieces, uses isWithinBounds
  {
    files: ['js/pieces.js'],
    languageOptions: {
      globals: {
        isWithinBounds: 'readonly'
      }
    }
  },
  // rules.js - declares the rules functions, uses piece constants and helpers
  {
    files: ['js/rules.js'],
    languageOptions: {
      globals: {
        PAWN: 'readonly',
        ROOK: 'readonly',
        KNIGHT: 'readonly',
        BISHOP: 'readonly',
        QUEEN: 'readonly',
        KING: 'readonly',
        WHITE: 'readonly',
        BLACK: 'readonly',
        Piece: 'readonly',
        isPseudoLegalMove: 'readonly',
        isWithinBounds: 'readonly',
        coordsToAlgebraic: 'readonly'
      }
    }
  },
  // board.js - declares selectedSquare, possibleMoves, boardElement, and board functions
  // Uses: coordsToAlgebraic, moveHistory (from game.js)
  {
    files: ['js/board.js'],
    languageOptions: {
      globals: {
        CONFIG: 'readonly',
        PIECE_NAMES: 'readonly',
        coordsToAlgebraic: 'readonly',
        moveHistory: 'readonly'
      }
    }
  },
  // game.js - declares boardState, currentPlayer, moveHistory, and game functions
  // Uses: everything from other files, but doesn't redeclare them
  {
    files: ['js/game.js'],
    languageOptions: {
      globals: {
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
        PIECE_NAMES: 'readonly',
        isWithinBounds: 'readonly',
        isPseudoLegalMove: 'readonly',
        isPathObstructed: 'readonly',
        isInCheck: 'readonly',
        applyMove: 'readonly',
        canCastleIn: 'readonly',
        legalMovesFrom: 'readonly',
        allLegalMoves: 'readonly',
        positionKey: 'readonly',
        hasInsufficientMaterial: 'readonly',
        coordsToAlgebraic: 'readonly',
        deepClone: 'readonly',
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
        showPromotionChooser: 'readonly',
        closePromotionChooser: 'readonly',
        isPromotionChooserOpen: 'readonly',
        selectedSquare: 'writable',
        possibleMoves: 'writable'
      }
    }
  },
  // main.js - uses CONFIG, debugLog, initializeGame, initDragAndDrop, initPromotionUI, ChessAI
  {
    files: ['js/main.js'],
    languageOptions: {
      globals: {
        CONFIG: 'readonly',
        debugLog: 'readonly',
        initializeGame: 'readonly',
        initDragAndDrop: 'readonly',
        setBoardFlipped: 'readonly',
        ChessAI: 'readonly'
      }
    }
  },
  // drag.js - uses CONFIG, debugLog, handleBoardClick
  {
    files: ['js/drag.js'],
    languageOptions: {
      globals: {
        CONFIG: 'readonly',
        debugLog: 'readonly',
        handleBoardClick: 'readonly'
      }
    }
  },
  // ai.js - uses CONFIG, debugLog, deepClone
  {
    files: ['js/ai.js'],
    languageOptions: {
      globals: {
        CONFIG: 'readonly',
        debugLog: 'readonly',
        deepClone: 'readonly'
      }
    }
  },
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.playwright/**',
      'eslint.config.js' // ESLint config file itself uses ES modules
    ]
  }
];


