# Static Chess - Architecture Documentation

## Overview

Static Chess is a pure vanilla implementation of chess using HTML, CSS, and JavaScript without any frameworks or libraries. This document outlines the architecture, component interactions, and guidelines for implementing future features.

## Project Structure

```
Static_Chess/
├── index.html           # Main HTML entry point
├── css/                 # CSS styles
│   ├── style.css        # General page styles
│   ├── board.css        # Chessboard specific styles
│   └── pieces.css       # Chess pieces styles
├── js/                  # JavaScript logic
│   ├── config.js        # Game configuration and feature flags
│   ├── utils.js         # Utility functions
│   ├── pieces.js        # Piece definitions and movement rules
│   ├── board.js         # Board rendering and interaction
│   ├── game.js          # Core game logic
│   ├── main.js          # Application entry point
│   ├── drag.js          # Skeleton for drag and drop functionality
│   ├── ai.js            # Skeleton for AI opponent
│   └── promotion.js     # Skeleton for pawn promotion UI
├── assets/              # SVG files for chess pieces
│   ├── wp.svg, bp.svg   # Pawns
│   ├── wr.svg, br.svg   # Rooks
│   ├── wn.svg, bn.svg   # Knights
│   ├── wb.svg, bb.svg   # Bishops
│   ├── wq.svg, bq.svg   # Queens
│   └── wk.svg, bk.svg   # Kings
└── docs/                # Documentation
    ├── ARCHITECTURE.md  # This document
    └── ROADMAP.md       # Development roadmap
```

## Component Interaction Flow

1. **main.js**: Application entry point
   - Initializes settings and event listeners
   - Calls `initializeGame()` from game.js

2. **game.js**: Core game logic
   - Manages game state, turn management, move validation
   - Delegates rendering to board.js
   - Uses piece movement rules from pieces.js

3. **board.js**: UI representation of the chess board
   - Renders the board and pieces
   - Handles interactions (clicks, drags)
   - Updates visual state (highlighting, animations)

4. **pieces.js**: Chess piece definitions
   - Defines piece types and their basic movement patterns
   - Provides functions for initial board setup

5. **utils.js**: Helper functions
   - Coordinate conversions (algebraic notation)
   - localStorage management
   - General utility functions

6. **config.js**: Centralized configuration
   - Feature flags for enabling/disabling features
   - Game constants and settings
   - Default user preferences

## Data Flow

1. User interacts with the board (clicks a square)
2. `board.js` captures the event and calls the appropriate handler in `game.js`
3. `game.js` validates the move using rules from `pieces.js`
4. If valid, `game.js` updates the game state and calls `renderPieces()` in `board.js`
5. `board.js` updates the visual representation

## State Management

The game state is primarily managed in `game.js` and consists of:

- Current board state (2D array of pieces)
- Current turn (white or black)
- Move history
- Game status (in progress, check, checkmate, stalemate)
- Selected piece and possible moves

## Skeleton Implementations

Several planned features already have skeleton implementations that provide a foundation for full implementation:

- **drag.js**: Basic structure for drag and drop functionality
- **ai.js**: Framework for implementing the AI opponent
- **promotion.js**: UI components for pawn promotion

These skeleton files include commented code with clear TODOs and integration points, so they're ready to be expanded upon when implementing the features.

## Implementing Future Features

### 1. Drag and Drop

> **Skeleton Implementation Available: `js/drag.js`**

To implement drag and drop for pieces:

1. Update `config.js` to enable the DRAG_AND_DROP feature flag
2. Add the `drag.js` script to `index.html`:
   ```html
   <script src="js/drag.js"></script>
   ```
3. Call `initDragAndDrop()` in `main.js` after initializing the game
4. Complete the TODOs in `drag.js` to integrate with game logic:
   - Update `handleDragStart` to check if the piece can be moved
   - Update `handleDragEnd` to call into game.js for move validation
   - Implement visual feedback for possible moves during drag

The skeleton already includes:
- Event listeners for mouse and touch events
- Drag state management
- Basic visual feedback during dragging

### 2. AI Opponent

> **Skeleton Implementation Available: `js/ai.js`**

To implement the AI opponent:

1. Update `config.js` to enable the AI_OPPONENT feature flag
2. Add the `ai.js` script to `index.html`:
   ```html
   <script src="js/ai.js"></script>
   ```
3. Implement in `game.js`:
   ```javascript
   // Initialize AI
   const ai = new ChessAI(CONFIG.DEFAULT_SETTINGS.AI_DIFFICULTY);
   
   // Call AI after player move
   if (CONFIG.FEATURES.AI_OPPONENT && currentTurn === 'b') {
     ai.findBestMove(boardState, currentTurn).then(move => {
       // Execute AI move
     });
   }
   ```
4. Complete the TODOs in `ai.js`:
   - Implement the `_getAllLegalMoves` method to get valid moves
   - Implement the `_minimax` algorithm for move evaluation
   - Improve the position evaluation function

The skeleton already includes:
- AI configuration with difficulty levels
- Material-based evaluation
- Promise-based API for "thinking" delays
- Piece-square tables for positional evaluation

### 3. Promotion Choice UI

> **Skeleton Implementation Available: `js/promotion.js`**

To implement the promotion choice UI:

1. Update `config.js` to enable the PROMOTION_UI feature flag
2. Add the `promotion.js` script to `index.html`:
   ```html
   <script src="js/promotion.js"></script>
   ```
3. Call `initPromotionUI()` in `main.js` after initializing the game
4. Modify pawn promotion logic in `game.js` to use the UI:
   ```javascript
   // When a pawn reaches the opposite rank
   if (isPawnPromotion(move)) {
     showPromotionModal(currentTurn, move.to.row, move.to.col)
       .then(promotionPiece => {
         // Complete the move with the chosen piece
       });
   }
   ```

The skeleton already includes:
- Modal dialog creation and styling
- Piece selection UI
- Promise-based API for waiting for user selection

### 4. Game Timer

To implement the chess clock:

1. Add timer UI elements to the HTML
2. Create a new `js/timer.js` file to manage clock state
3. Integrate with `game.js` to switch active timer on move
4. Add timer settings to the UI
5. Update `config.js` to enable the GAME_TIMER feature flag

### 5. Sound Effects

To implement sound effects:

1. Create an `assets/sounds/` directory with sound files
2. Update `utils.js` to use the existing `playSound()` function
3. Trigger sounds for key events:
   - Piece movement
   - Captures
   - Check/checkmate
   - Game end
4. Update `config.js` to enable the SOUND_EFFECTS feature flag

### 6. Undo Move

To implement undo functionality:

1. Track detailed move history in `game.js` including captured pieces
2. Implement `undoLastMove()` function in `game.js`
3. Add undo button to UI
4. Update `config.js` to enable the UNDO_MOVE feature flag

### 7. Multiple Saved Games

To implement multiple saved games:

1. Modify save/load functions to support named game slots
2. Create a game selection/management UI
3. Implement `saveCurrentGame(name)` and `loadGame(name)` functions
4. Update `config.js` to define the saved games storage structure

### 8. Advanced Draw Detection

To implement advanced draw detection:

1. Enhance `game.js` to track:
   - Threefold repetition (same position 3 times)
   - Fifty-move rule (50 moves without captures or pawn moves)
   - Insufficient material (e.g., K vs K, K+B vs K)
2. Add draw detection to the move validation logic
3. Update UI to show draw conditions

### 9. Full SAN Implementation

To implement complete Standard Algebraic Notation:

1. Enhance the existing `formatSAN()` function in `utils.js`
2. Add disambiguation (which piece moved when multiple can)
3. Add support for all special moves notation
4. Update move history display

## Coding Standards

1. **Naming Conventions**:
   - camelCase for variables and functions
   - UPPER_CASE for constants
   - Classes should be PascalCase (if any)

2. **Documentation**:
   - Use JSDoc comments for functions
   - Document parameters, return values, and descriptions

3. **Code Organization**:
   - Keep files small and focused on a single responsibility
   - Use clear separation of concerns between modules

4. **Error Handling**:
   - Use input validation
   - Provide fallbacks for errors
   - Use console.error for important errors

## Performance Considerations

1. **Rendering**: Minimize DOM operations
2. **Move Calculation**: Cache possible moves when possible
3. **Event Handlers**: Use event delegation
4. **Local Storage**: Limit the size of saved games

## Testing Approach

- Manual testing for core gameplay
- Use debugLog() for debugging
- Test across different browsers
- Test responsive layout on different devices 