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
    'algebraicToCoords',
    'coordsToAlgebraic',
    'isWithinBounds',
    'deepClone',
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
    'positionKey',
    'hasInsufficientMaterial',
    'findSANMove',
    'positionToFEN',
  ]),
  // ai.js
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
  // game.js (the two state variables are reassigned there)
  ...shared([
    'initializeGame',
    'generateLegalMovesForPiece',
    'playChosenMove',
    'refreshBoardVisuals',
    'isBoardLocked',
    'setOpponent',
    'setTimeControl',
  ]),
  ...shared(['boardState', 'currentPlayer'], 'writable'),
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
