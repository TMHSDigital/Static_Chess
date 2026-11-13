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
│   ├── ai.js            # Skeleton for AI opponent (not loaded by index.html)
│   └── promotion.js     # Pawn promotion chooser
├── tests/               # Jest tests (dev only)
│   ├── helpers/         # Shared loader that builds a fresh page and game per test
│   ├── unit/            # Rules, undo, persistence, input, utilities
│   └── integration/     # Move flow through the DOM
├── package.json         # Dev tooling only: lint, format and test scripts
├── eslint.config.mjs     # ESLint configuration, including per-file globals
├── assets/              # SVG files for chess pieces, plus screenshots/ for the README
│   ├── wp.svg, bp.svg   # Pawns
│   ├── wr.svg, br.svg   # Rooks
│   ├── wn.svg, bn.svg   # Knights
│   ├── wb.svg, bb.svg   # Bishops
│   ├── wq.svg, bq.svg   # Queens
│   └── wk.svg, bk.svg   # Kings
├── releases/            # Release files (notes and guides)
│   └── RELEASE_NOTES_vX.Y.Z.md  # Release notes for each version
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
   - Deep cloning, sound playback, debug logging
   - `saveToLocalStorage` / `loadFromLocalStorage` helpers (not used yet; `game.js` and `main.js` guard their own storage calls)

6. **config.js**: Centralized configuration
   - Feature flags (see the table below)
   - Default values for the settings toggles (`DEFAULT_SETTINGS`)
   - The `localStorage` keys (`STORAGE_KEYS`), animation timing and sound definitions

### Feature flags

| Flag | Default | Effect |
|---|---|---|
| `DRAG_AND_DROP` | `true` | Enables dragging pieces (`drag.js`) |
| `UNDO_MOVE` | `true` | Shows and enables the Undo button |
| `SOUND_EFFECTS` | `false` | Runtime state. It is overwritten at startup from the "Sound effects" toggle, so editing it in `config.js` has no lasting effect; change `DEFAULT_SETTINGS.ENABLE_SOUNDS` instead |
| `AI_OPPONENT` | `false` | Nothing until `ai.js` is loaded and wired in (see below) |
| `PROMOTION_UI` | `true` | Asks which piece a pawn promotes to. When `false`, pawns become queens without asking |

### Stored data

Everything is kept in `localStorage` under the keys in `CONFIG.STORAGE_KEYS`: `chessGameState` (the game, its move list, undo stack and fifty-move counter, with a `version` field) and one key per setting (`showCoords`, `showPossibleMoves`, `showLastMove`, `enableSounds`). A saved game is validated before it is used; anything unusable is discarded and a fresh game starts.

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
- Game status (in progress, check, checkmate, stalemate, draw)
- Half-move clock for the fifty-move rule
- Selected piece and possible moves

## Skeleton Implementations

Several planned features already have skeleton implementations that provide a foundation for full implementation:

- **drag.js**: ✅ Fully implemented - drag and drop functionality integrated with click-based flow
- **promotion.js**: ✅ Fully implemented - dialog for choosing the promotion piece
- **ai.js**: Framework for implementing the AI opponent

Drag and drop and the promotion chooser are complete and enabled. `ai.js` is not loaded by `index.html` and nothing in `game.js` calls it yet; the section below describes what is there and what is missing.

## Implementing Future Features

### 1. Drag and Drop

> **✅ Fully Implemented: `js/drag.js`**

Drag and drop is fully implemented and enabled. It works by:

1. Feature flag `DRAG_AND_DROP` is enabled in `config.js`
2. The `drag.js` script is included in `index.html`
3. `initDragAndDrop()` is called in `main.js` after game initialization
4. A press on a piece only arms a drag. Once the pointer moves more than 5px, the piece is selected, its possible moves are shown, and it follows the pointer
5. On drop, `makeMove()` is called directly if the drop square is valid; either way the selection is cleared
6. A press that never moves is an ordinary click or tap and is handled by the click handler in `game.js`

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
   if (CONFIG.FEATURES.AI_OPPONENT && currentPlayer === BLACK) {
     ai.findBestMove(boardState, currentPlayer).then(move => {
       // Execute AI move
     });
   }
   ```
4. Fill in the placeholders in `ai.js`:
   - `_getAllLegalMoves` returns an empty list, so `findBestMove` currently always resolves `null`
   - `_minimax` returns 0
   - The position evaluation only counts material

Move generation in `game.js` reads the live board, so a search cannot yet try moves on a copy. That has to change first (pass the board and king positions in as arguments).

The skeleton already includes:
- AI configuration with difficulty levels
- Material-based evaluation
- Promise-based API for "thinking" delays

### 3. Promotion Choice UI

> **✅ Fully Implemented: `js/promotion.js`**

1. `makeMove()` takes an optional fifth argument, the piece type to promote to. It defaults to a queen, so tests and a future AI can call it directly
2. When a click or drop would move a pawn to the last rank, `handleBoardClick()` does not play the move. It calls `showPromotionChooser(color, onChoose)` and plays the move from the callback, once a piece has been picked
3. While the chooser is open the board ignores input. Escape or a click outside the panel cancels, leaving the pawn where it was; Undo and New Game also close it
4. The choices are `<button>` elements with labels. The first one takes focus, and Tab and the arrow keys cycle through them
5. With `PROMOTION_UI` set to `false` the chooser is skipped and the pawn becomes a queen

### 4. Game Timer

To implement the chess clock:

1. Add timer UI elements to the HTML
2. Create a new `js/timer.js` file to manage clock state
3. Integrate with `game.js` to switch active timer on move
4. Add timer settings to the UI
5. Add a `GAME_TIMER` feature flag to `config.js` and read it where the timer starts

### 5. Sound Effects

Sound effects are feature-flagged and user-toggleable:

1. Settings toggle updates `CONFIG.FEATURES.SOUND_EFFECTS` and persists preference
2. `game.js` triggers `playSound()` for move, capture, check, castle, promotion and game end
3. `playSound()` in `utils.js` synthesizes short tones with the Web Audio API from the definitions in `CONFIG.SOUNDS`, so no audio files are needed

### 6. Undo Move

Undo is implemented using a pre-move snapshot stack:

1. At the start of `makeMove()`, before anything changes, `game.js` pushes a snapshot of the board, side to move, king positions, en passant target and half-move clock to `positionHistory`
2. `undoLastMove()` restores the previous snapshot, removes the last move from the move list and rerenders
3. The stack is saved with the game, so Undo still works after a reload
4. `index.html` includes an Undo button, which is disabled when there is nothing to undo

### 7. Multiple Saved Games

To implement multiple saved games:

1. Modify save/load functions to support named game slots
2. Create a game selection/management UI
3. Implement `saveCurrentGame(name)` and `loadGame(name)` functions
4. Update `config.js` to define the saved games storage structure

### 8. Draw Detection

After every move that is not checkmate or stalemate, `findDrawReason()` in `game.js` checks three rules and ends the game if one applies:

1. **Insufficient material**: bare kings, a single bishop or knight, or only bishops that all stand on squares of one colour
2. **Threefold repetition**: `positionKey()` turns a position into a string (placement, side to move, castling rights, and the en passant square if a pawn can capture there). The current key is compared with the snapshots on the undo stack back to the last pawn move or capture
3. **Fifty-move rule**: `halfmoveClock` counts half-moves since the last pawn move or capture; the game is drawn at 100

Draws are declared automatically; there is no claim button. The clock is part of the undo snapshot and the saved game, and repetition is counted from the undo stack, so both survive Undo and a reload.

### 9. SAN Generation

SAN generation with disambiguation is implemented:

1. `generateNotationWithDisambiguation()` in `game.js` uses the pre-move board to resolve conflicts (file first, then rank, then both)
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

Automated tests with Jest + jsdom, all built on `tests/helpers/load-game.js`:
- Unit: rules (castling, en passant, pins, check, mate, stalemate, promotion, notation), undo, persistence, mouse and touch input, utilities, piece setup
- Integration: move flow updates status and history
- Not covered yet: board rendering details and the settings toggles
- Optional: Playwright E2E for browser-level scenarios

Manual testing:
- Cross-browser checks, responsive layout, accessibility (keyboard/ARIA)