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
│   ├── pieces.js        # Piece definitions and movement patterns
│   ├── rules.js         # The rules of chess as pure functions of a position
│   ├── board.js         # Board rendering and interaction
│   ├── game.js          # The live game: state, move flow, undo, saving, page updates
│   ├── main.js          # Application entry point
│   ├── drag.js          # Drag and drop functionality (integrated via click flow)
│   ├── ai.js            # Computer opponent: evaluation and search
│   ├── ai-worker.js     # Web Worker that runs the search off the main thread
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

2. **game.js**: The live game
   - Holds the game state (board, side to move, history, undo stack)
   - `makeMove()` applies a move through `rules.js`, records it, detects the end of the game, then calls `showMoveResult()` for the page updates
   - Delegates rendering to board.js

3. **rules.js**: The rules of chess
   - Pure functions of a position `{ board, kingPositions, enPassantTarget }`; no DOM, storage or sound
   - `legalMovesFrom`, `allLegalMoves`, `canCastleIn`, `isInCheck`, `positionKey`, `hasInsufficientMaterial`
   - `applyMove(position, from, to, promotion)` returns a new position and a move record; it never changes the position it is given, which is what lets undo keep old boards and a search try moves on copies
   - Checked against published perft counts in `tests/unit/rules.test.js`

4. **board.js**: UI representation of the chess board
   - Renders the board and pieces
   - Handles interactions (clicks, keyboard navigation, drags)
   - Diff-based rendering updates only changed squares
   - Updates visual state (highlighting, animations, ARIA labels)

5. **pieces.js**: Chess piece definitions
   - Defines piece types and their basic movement patterns
   - Provides functions for initial board setup

6. **utils.js**: Helper functions
   - Coordinate conversions (algebraic notation)
   - Deep cloning, sound playback, debug logging
   - `saveToLocalStorage` / `loadFromLocalStorage` helpers (not used yet; `game.js` and `main.js` guard their own storage calls)

7. **config.js**: Centralized configuration
   - Feature flags (see the table below)
   - Default values for the settings toggles (`DEFAULT_SETTINGS`)
   - The `localStorage` keys (`STORAGE_KEYS`), animation timing and sound definitions

### Feature flags

| Flag | Default | Effect |
|---|---|---|
| `DRAG_AND_DROP` | `true` | Enables dragging pieces (`drag.js`) |
| `UNDO_MOVE` | `true` | Shows and enables the Undo button |
| `SOUND_EFFECTS` | `false` | Runtime state. It is overwritten at startup from the "Sound effects" toggle, so editing it in `config.js` has no lasting effect; change `DEFAULT_SETTINGS.ENABLE_SOUNDS` instead |
| `AI_OPPONENT` | `true` | Offers the computer opponent in the settings. When `false`, the selectors are hidden and the game is always two-player |
| `PROMOTION_UI` | `true` | Asks which piece a pawn promotes to. When `false`, pawns become queens without asking |

### Stored data

Everything is kept in `localStorage` under the keys in `CONFIG.STORAGE_KEYS`: `chessGameState` (the game, its move list, undo stack and fifty-move counter, with a `version` field) and one key per setting (`showCoords`, `showPossibleMoves`, `showLastMove`, `enableSounds`, `flipBoard`, `opponent`, `playerSide`). A saved game is validated before it is used; anything unusable is discarded and a fresh game starts.

## Data Flow

1. User interacts with the board (clicks a square)
2. `board.js` captures the event and calls the appropriate handler in `game.js`
3. `game.js` validates the move using `rules.js` (which builds on the movement patterns in `pieces.js`)
4. If valid, `game.js` updates the game state and calls `renderPieces()` in `board.js`
5. `board.js` updates the visual representation

## Accessibility

- The board is an ARIA grid: `board.js` builds eight `role="row"` elements of eight `role="gridcell"` squares. The rows use `display: contents`, so the squares still lay out in the board's CSS grid
- Roving tabindex: one square has `tabindex="0"` and the rest `-1`, so Tab enters and leaves the board in one press. The tab stop follows focus
- Each square's `aria-label` names its piece and square, and `updateBoardVisuals()` appends "selected", "legal move" or "in check" to match the visual highlights
- `announce()` in `game.js` writes to the hidden `#announcer` live region. `describeMove()` turns a move into a sentence followed by the new status, for example "White knight takes on f3. Check. Black's turn". The visible status line is not a live region, so nothing is read twice
- `style.css` shortens animations and transitions under `prefers-reduced-motion: reduce`

## State Management

The game state is primarily managed in `game.js` and consists of:

- Current board state (2D array of pieces)
- Current turn (white or black)
- Move history
- Game status (in progress, check, checkmate, stalemate, draw)
- Half-move clock for the fifty-move rule
- Selected piece and possible moves

## Optional Modules

- **drag.js**: Drag and drop, integrated with the click-based flow
- **promotion.js**: Dialog for choosing the promotion piece
- **ai.js** and **ai-worker.js**: The computer opponent

All three are loaded and enabled. Each has a feature flag in `config.js`.

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

### 2. Computer Opponent

> **✅ Fully Implemented: `js/ai.js`, `js/ai-worker.js`**

1. `chooseAIMove(position, color, level)` in `ai.js` picks a move. It uses only `rules.js`, so it has no DOM access
   - `easy` plays a random legal move
   - `medium` and `hard` run a negamax search with alpha-beta pruning, 2 and 3 half-moves deep, followed by a captures-only (quiescence) search so an exchange is counted to its end
   - `evaluatePosition()` counts material, plus small bonuses for central minor pieces, advanced pawns and a king kept at home
   - Moves within a few hundredths of a pawn of the best are treated as equal and one is picked at random; a forced mate always takes the quickest line
2. `setOpponent(level, humanColor)` in `game.js` turns the opponent on or off. `main.js` calls it from the "Opponent" and "Play as" selectors, which are saved like the other settings
3. `requestAIMove()` runs after every move, undo, reset and load. If it is the computer's turn it posts the position to `ai-worker.js` and plays the answer with `makeMove()`. Where a Worker cannot be created (a page opened from a file, or the tests) the search runs on the main thread after a `setTimeout`
4. Each request has an id. Undo, New Game and changing the opponent bump the id, so an answer that arrives late is dropped
5. While it is the computer's turn `isBoardLocked()` is true: clicks and drags are ignored and the status line says the computer is thinking
6. Undo takes back the computer's reply together with the player's move

To make it stronger, raise the `depth` values in `AI_LEVELS`; each extra half-move costs roughly an order of magnitude in time, so move generation in `rules.js` would need to get faster first.

### 3. Promotion Choice UI

> **✅ Fully Implemented: `js/promotion.js`**

1. `makeMove()` takes an optional fifth argument, the piece type to promote to. It defaults to a queen, so tests and the computer opponent can call it directly
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

1. At the start of `makeMove()`, `game.js` pushes the current board, side to move, king positions, en passant target and half-move clock to `positionHistory`. No copy is needed, because `applyMove()` builds a new position instead of changing the old one
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