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
│   ├── drag.js          # Drag and drop functionality (integrated via click flow)
│   ├── ai.js            # Skeleton for AI opponent
│   └── promotion.js     # Skeleton for pawn promotion UI
├── assets/              # SVG files for chess pieces
│   ├── wp.svg, bp.svg   # Pawns
│   ├── wr.svg, br.svg   # Rooks
│   ├── wn.svg, bn.svg   # Knights
│   ├── wb.svg, bb.svg   # Bishops
│   ├── wq.svg, bq.svg   # Queens
│   └── wk.svg, bk.svg   # Kings
├── .github/             # GitHub configuration
│   ├── workflows/       # CI/CD workflows (ci.yml, release.yml)
│   └── [templates]      # Issue/PR templates, CODEOWNERS, etc.
└── docs/                # Documentation
    ├── ARCHITECTURE.md  # This document
    ├── ROADMAP.md       # Development roadmap
    └── RELEASE.md       # Release process documentation
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
   - Handles interactions (clicks, keyboard navigation, drags)
   - Diff-based rendering updates only changed squares
   - Updates visual state (highlighting, animations, ARIA labels)

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
   - Default user preferences (including sound effects toggle)

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

- **drag.js**: ✅ Fully implemented - drag and drop functionality integrated with click-based flow
- **ai.js**: Framework for implementing the AI opponent
- **promotion.js**: UI components for pawn promotion

The drag and drop feature is complete and enabled. Other skeleton files include commented code with clear TODOs and integration points, so they're ready to be expanded upon when implementing the features.

## Implementing Future Features

### 1. Drag and Drop

> **✅ Fully Implemented: `js/drag.js`**

Drag and drop is fully implemented and enabled. It works by:

1. Feature flag `DRAG_AND_DROP` is enabled in `config.js`
2. The `drag.js` script is included in `index.html`
3. `initDragAndDrop()` is called in `main.js` after game initialization
4. On drag start, the piece is selected and possible moves are shown
5. On drop, `makeMove()` is called directly if the drop square is valid
6. Integration with click handlers prevents conflicts

The implementation includes:
- Event listeners for mouse and touch events
- Drag state management with movement detection
- Visual feedback (piece follows cursor with opacity change)
- Drop validation using `elementsFromPoint()` to find target square
- Proper cleanup and event prevention to avoid click conflicts

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

Sound effects are feature-flagged and user-toggleable:

1. Settings toggle updates `CONFIG.FEATURES.SOUND_EFFECTS` and persists preference
2. `game.js` triggers `playSound()` for move, capture, check, castle, promotion
3. Add actual audio files under `assets/sounds/` to enable playback

### 6. Undo Move

Undo is implemented using a pre-move snapshot stack:

1. Before each move, `game.js` pushes a deep snapshot to `positionHistory`
2. `undoLastMove()` restores the previous snapshot and rerenders
3. `index.html` includes an Undo button

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

### 9. SAN Generation

SAN generation with basic disambiguation is implemented:

1. `generateNotationWithDisambiguation()` in `game.js` uses the pre-move board to resolve conflicts
2. Includes capture markers, checks, mates, promotions, and en passant indicator
3. Future work: handle all edge cases for full SAN parity

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

Automated tests with Jest + jsdom:
- Unit: utilities (coordinate conversions), pieces (setup), selected game logic paths
- Integration: move flow updates status and history
- Optional: Playwright E2E for browser-level scenarios

Manual testing:
- Cross-browser checks, responsive layout, accessibility (keyboard/ARIA)