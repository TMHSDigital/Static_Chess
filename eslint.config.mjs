// ESLint flat config
import js from '@eslint/js';
import globals from 'globals';

// The page loads its scripts into one global scope, in the order given in
// index.html. These are the names one file may use from another. A name is
// listed once here, not once per file that uses it.
const shared = (names, access = 'readonly') =>
  Object.fromEntries(names.map((name) => [name, access]));
const appGlobals = {
  // config.js
  ...shared(['CONFIG']),
  // utils.js
  ...shared([
    'sideName',
    'algebraicToCoords',
    'coordsToAlgebraic',
    'isWithinBounds',
    'readStored',
    'writeStored',
    'removeStored',
    'playSound',
    'debugLog',
  ]),
  // pieces.js
  ...shared([
    'PAWN',
    'ROOK',
    'KNIGHT',
    'BISHOP',
    'QUEEN',
    'KING',
    'WHITE',
    'BLACK',
    'PIECE_NAMES',
    'PIECE_POINTS',
    'Piece',
    'isPseudoLegalMove',
    'getInitialPieces',
  ]),
  // rules.js
  ...shared([
    'opponentOf',
    'isPathObstructed',
    'isInCheck',
    'applyMove',
    'canCastleIn',
    'legalMovesFrom',
    'allLegalMoves',
    'initialPosition',
    'allLegalCaptures',
    'positionKey',
    'hasInsufficientMaterial',
    'gameOutcome',
    'canDeliverMate',
    'findSANMove',
    'positionToFEN',
    'positionFromFEN',
  ]),
  // ai.js
  ...shared(['PROMOTION_TYPES']),
  ...shared(['assessPosition', 'searchBudget']),
  ...shared(['AI_LEVELS', 'chooseAIMove', 'evaluatePosition']),
  // board.js
  ...shared([
    'boardElement',
    'createBoard',
    'renderPieces',
    'getSquareElement',
    'updateBoardVisuals',
    'setSelectedSquare',
    'clearSelectedSquare',
    'getSelectedSquare',
    'setPossibleMoves',
    'clearPossibleMoves',
    'getPossibleMoves',
    'setBoardFlipped',
  ]),
  // drag.js
  ...shared(['initDragAndDrop']),
  // promotion.js
  ...shared(['showPromotionChooser', 'closePromotionChooser', 'isPromotionChooserOpen']),
  // notation.js
  ...shared([
    'writeSAN',
    'firstPGNGame',
    'pgnResult',
    'pgnTag',
    'pgnMoveTokens',
    'looksLikeFEN',
    'sharedTextFromHash',
    'pgnMovetext',
  ]),
  ...shared([
    'moveNumber',
    'moveNumberPrefix',
    'writePGN',
    'importSizeError',
    'readPGN',
    'readFEN',
  ]),
  // saved-game.js
  ...shared(['SAVED_GAME_VERSION', 'STANDARD_START', 'validateSavedGame']),
  // game-store.js
  ...shared([
    'storeGame',
    'clearStoredGame',
    'readStoredGame',
    'readArchive',
    'addToArchive',
    'removeFromArchive',
    'clearArchive',
  ]),
  // clock.js
  ...shared(['makeClock', 'timeLeft', 'formatClock', 'lowTimeLevel', 'timeoutResult']),
  // review.js
  ...shared(['scoreText', 'scoreDrop', 'scoreDropText']),
  // engine-bridge.js
  ...shared(['askEngine', 'askEngineForScores', 'dropEngineRequests', 'isLatestEngineRequest']),
  // game-ui.js
  ...shared([
    'bindControls',
    'renderStatus',
    'renderControls',
    'renderClocks',
    'renderPlayers',
    'renderReviewScore',
    'renderHint',
    'renderMoveList',
    'renderCaptured',
    'focusCurrentMove',
    'announce',
    'confirmSecondClick',
    'cancelConfirm',
    'cancelConfirms',
    'flashButton',
    'copyOrDownload',
    'downloadText',
    'openImportDialog',
    'closeImportDialog',
    'openSharedText',
    'playHereButton',
    'resignButton',
    'resetButton',
    'pgnButton',
    'downloadButton',
    'fenButton',
    'linkButton',
  ]),
  // game.js
  ...shared([
    'importPGN',
    'importFEN',
    'isGameInProgress',
    'initializeGame',
    'isOwnPiece',
    'generateLegalMovesForPiece',
    'playChosenMove',
    'refreshBoardVisuals',
    'isBoardLocked',
    'setOpponent',
    'setTimeControl',
  ]),
};

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  // This config file is the only ES module in the repository
  {
    files: ['**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
    },
  },
  // Test files
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  // Application scripts
  {
    files: ['js/**/*.js'],
    languageOptions: {
      globals: appGlobals,
    },
    rules: {
      // Each shared name is declared by exactly one of these files, which would
      // otherwise count as redeclaring the global listed above
      'no-redeclare': ['error', { builtinGlobals: false }],
    },
  },
  {
    ignores: [
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.playwright/**',
      '.playwright-mcp/**',
    ],
  },
];
