# Static Chess - Architecture Documentation

## Overview

Static Chess is a pure vanilla implementation of chess using HTML, CSS, and JavaScript without any frameworks or libraries. This document outlines the architecture, component interactions, and guidelines for implementing future features.

## Project Structure

```
Static_Chess/
├── index.html           # Main HTML entry point
├── sw.js                # Service worker: keeps a copy of the app for offline use
├── manifest.webmanifest # Makes the page installable as an app
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
│   ├── promotion.js     # Pawn promotion chooser
│   ├── notation.js      # Writing a move in SAN; taking PGN text apart
│   ├── saved-game.js    # Checking a saved game read from storage
│   ├── clock.js         # The arithmetic of a chess clock
│   ├── engine-bridge.js # Requests to the engine, through the worker or on the page
│   └── game-ui.js       # Status, buttons, clocks, move list and the Load dialog
├── tests/               # Jest tests (dev only)
│   ├── helpers/         # Shared loader that builds a fresh page and game per test
│   ├── unit/            # Rules, engine, undo, persistence, clock, import, input, settings, service worker
│   └── integration/     # Move flow through the DOM, and the real index.html
├── package.json         # Dev tooling only: lint, format and test scripts
├── eslint.config.mjs     # ESLint configuration, including the list of names shared between scripts
├── assets/              # SVG files for chess pieces, plus screenshots/ for the README
│   ├── wp.svg, bp.svg   # Pawns
│   ├── wr.svg, br.svg   # Rooks
│   ├── wn.svg, bn.svg   # Knights
│   ├── wb.svg, bb.svg   # Bishops
│   ├── wq.svg, bq.svg   # Queens
│   ├── wk.svg, bk.svg   # Kings
│   └── icons/           # App icon as SVG and as 192px and 512px PNG
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
   - Holds the game state (board, side to move, history, undo stack, result, clock)
   - Adds the click listener to the board and handles the buttons beside it
   - `makeMove()` plays a move in the live game. The change to the game itself is `playMove()`: it applies the move through `rules.js`, records it and detects checkmate and stalemate, and it refuses a finished game. `makeMove()` adds what only a move made on the page needs: the clock, automatic draws, `showMoveResult()` for the page updates, saving and the computer's reply. Load PGN plays its moves in through `playMove()` alone
   - `startGameFrom()` begins a game from a position, by default `initialPosition()` from `rules.js` with White to move. How the game began is kept in `gameStart` and saved with it, and `moveNumberAt()` is the one place that works out move numbers from it for the move list, PGN and FEN
   - `currentSnapshot()` and `restoreSnapshot()` are the one place that lists the fields of a position; the undo stack, saving, loading and a new game go through them
   - Delegates rendering to board.js

3. **rules.js**: The rules of chess
   - Pure functions of a position `{ board, kingPositions, enPassantTarget }`; no DOM, storage or sound
   - `legalMovesFrom`, `allLegalMoves`, `canCastleIn`, `isInCheck`, `positionKey`, `hasInsufficientMaterial`
   - `applyMove(position, from, to, promotion)` returns a new position and a move record; it never changes the position it is given, which is what lets undo keep old boards and a search try moves on copies
   - Checked against published perft counts in `tests/unit/rules.test.js`

4. **board.js**: UI representation of the chess board
   - Renders the board and pieces
   - Handles keyboard navigation on the board (`keydown`, `focusin`); clicks are handled by `game.js` and drags by `drag.js`
   - Diff-based rendering updates only changed squares
   - Updates visual state (highlighting, animations, ARIA labels)

5. **pieces.js**: Chess piece definitions
   - Defines piece types and their basic movement patterns
   - Provides functions for initial board setup

6. **utils.js**: Helper functions
   - Coordinate conversions (algebraic notation)
   - Sound playback, debug logging
   - `readStored`, `writeStored` and `removeStored`: the one way the app reaches `localStorage`. Storage that is blocked or full reads as empty and never throws

7. **config.js**: Centralized configuration
   - Feature flags (see the table below)
   - Default values for the settings (`DEFAULT_SETTINGS`)
   - The time controls on offer (`TIME_CONTROLS`) and the board themes (`BOARD_THEMES`)
   - The `localStorage` keys (`STORAGE_KEYS`), animation timing and sound definitions

### Feature flags

| Flag            | Default | Effect                                                                                                                                                                           |
| --------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DRAG_AND_DROP` | `true`  | Enables dragging pieces (`drag.js`)                                                                                                                                              |
| `UNDO_MOVE`     | `true`  | Shows and enables the Undo button                                                                                                                                                |
| `SOUND_EFFECTS` | `false` | Runtime state. It is overwritten at startup from the "Sound effects" toggle, so editing it in `config.js` has no lasting effect; change `DEFAULT_SETTINGS.ENABLE_SOUNDS` instead |
| `AI_OPPONENT`   | `true`  | Offers the computer opponent in the settings. When `false`, the selectors are hidden and the game is always two-player                                                           |
| `PROMOTION_UI`  | `true`  | Asks which piece a pawn promotes to. When `false`, pawns become queens without asking                                                                                            |
| `GAME_TIMER`    | `true`  | Offers the chess clock under "Clock". When `false`, the selector is hidden and no game is timed                                                                                  |

### Stored data

Everything is kept in `localStorage` under the keys in `CONFIG.STORAGE_KEYS`:

- `chessGameState`: the game. It holds a `version` field, the position (`boardState`, `currentPlayer`, `isGameOver`, `kingPositions`, `currentStatus`, `enPassantTarget`, `halfmoveClock`), the move list (`moveHistory`), the undo stack (`positionHistory`), the result (`gameResult`, and `endedWithoutMove` for a resignation, an agreed draw or a loss on time), how the game began (`gameStart`) and the `clock` object when the game is timed
- `chessGameArchive`: the past games, newest first, at most `CONFIG.ARCHIVE_LIMIT`. Each entry is `{ pgn, result, opponent, date, moves }`; `readArchive()` ignores a damaged value and drops incomplete entries
- One key per setting: `showCoords`, `showPossibleMoves`, `showLastMove`, `enableSounds`, `flipBoard`, `opponent`, `playerSide`, `timeControl`, `boardTheme`, `pageTheme`

A saved game is validated before it is used (`validateSavedGame()`); anything unusable is discarded and a fresh game starts. Fields added later are optional there, so older saves still load. Changing a key name orphans what players have saved under the old one.

## How the scripts depend on each other

The scripts are plain `<script>` files in one global scope, loaded in the order in `index.html`: `config`, `utils`, `pieces`, `rules`, `ai`, `board`, `drag`, `promotion`, `notation`, `saved-game`, `clock`, `engine-bridge`, `game-ui`, `game`, `main`.

- `rules.js` depends only on `pieces.js` and `utils.js`; `ai.js` builds on `rules.js` (`allLegalMoves`, `allLegalCaptures`, `applyMove`, `isInCheck`, `positionKey`). Neither touches the DOM, which is what lets `ai-worker.js` load them in a Web Worker
- `board.js` owns the selection (`getSelectedSquare()`, `getPossibleMoves()` and their setters) and renders what it is given; it reads nothing from `game.js`. The last move to highlight is an argument of `updateBoardVisuals()`
- `game.js` owns the game state and calls into `board.js`, `rules.js`, `promotion.js` and the five files below
- `game-ui.js` draws everything on the page apart from the board: the status line, the buttons, the clocks, the move list, the captured pieces, announcements and the Load dialog. It holds no game. `game.js` tells it what to show in plain values (`renderStatus(text)`, `renderControls(view)`, `renderClocks(clocks)`, `renderMoveList(moves, view)`, `renderCaptured(taken, lead)`, `renderHint(move)`) and hands it its handlers once (`bindControls()`); the Load dialog calls back into `importPGN()`, `importFEN()` and `readArchive()`. `tests/unit/game-ui.test.js` loads it without `game.js`
- `notation.js`, `saved-game.js` and `clock.js` hold what needs no page: writing SAN and reading PGN text, validating a saved game, and clock arithmetic. They take what they work on as arguments and can be loaded and tested with no document (`tests/unit/no-dom.test.js`)
- `engine-bridge.js` is the only file that talks to the worker. It knows nothing about the game: `game.js` hands it a position and gets a move back, or a list of positions and gets a score for each. Requests travel on named channels, each with a worker of its own; only the latest request on a channel counts, and channels do not affect each other
- `drag.js` calls `board.js` for the selection and `game.js` for `isBoardLocked()`, `isOwnPiece()`, `generateLegalMovesForPiece()`, `playChosenMove()` and `refreshBoardVisuals()`; it reads no state of the game directly
- Cross-file calls are direct, with no `window.` lookups or `typeof` guards, so a missing script is a `ReferenceError` rather than a click that does nothing. The names involved are listed once in `eslint.config.mjs`
- The one shared flag on `window` is `dragJustEnded`, which lets the click handler ignore the click that follows a drag

## Data Flow

1. User interacts with the board (clicks a square)
2. The click listener that `game.js` puts on the board calls `handleBoardClick()`; `board.js` turns Enter and Space on a focused square into the same call
3. `game.js` validates the move using `rules.js` (which builds on the movement patterns in `pieces.js`)
4. If valid, `game.js` updates the game state and calls `renderPieces()` in `board.js`
5. `board.js` updates the visual representation

## Accessibility

- The board is an ARIA grid: `board.js` builds eight `role="row"` elements of eight `role="gridcell"` squares. The rows use `display: contents`, so the squares still lay out in the board's CSS grid
- Roving tabindex: one square has `tabindex="0"` and the rest `-1`, so Tab enters and leaves the board in one press. The tab stop follows focus
- Each square's `aria-label` names its piece and square, and `updateBoardVisuals()` appends "selected", "legal move" or "in check" to match the visual highlights
- `announce()` in `game-ui.js` writes to the hidden `#announcer` live region. `describeMove()` turns a move into a sentence followed by the new status, for example "White knight takes on f3. Check. Black's turn". The visible status line is not a live region, so nothing is read twice
- `style.css` shortens animations and transitions under `prefers-reduced-motion: reduce`

## State Management

The game state is primarily managed in `game.js` and consists of:

- Current board state (2D array of pieces)
- Current turn (white or black)
- Move history
- Game status (in progress, check, checkmate, stalemate, draw)
- Half-move clock for the fifty-move rule
- The result, and whether it came from a move
- The chess clock of a timed game
- The position being looked at while reviewing (`viewPly`), a pending draw offer and the current hint

The selected piece and its possible moves are held in `board.js`.

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
5. On drop, `playChosenMove()` in `game.js` is called if the drop square is valid, the same function a click uses, so a dropped pawn also gets the promotion chooser; either way the selection is cleared
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
   - `easy` looks one half-move ahead (plus the captures that follow), so it takes material left hanging and gives mate in one, but it plays any move within a pawn and a half of the best, and three moves in ten are a random legal move
   - `medium` and `hard` run a negamax search with alpha-beta pruning, 2 and 3 half-moves deep, followed by a captures-only (quiescence) search so an exchange is counted to its end
   - In the Web Worker, `hard` then keeps searching one half-move deeper at a time for about a second (`timeMs`), keeping the result of the last depth it finished. On the page's own thread (no worker) it stays at its fixed depth
   - A pawn reaching the last rank is searched as four moves, one per piece it can become
   - `game.js` passes the positions the game has been through (`seen`); when the engine is better it avoids going back to one, so it does not shuffle into a draw by repetition
   - In the endgame the evaluation wants the king in the centre, and a clearly winning side is rewarded for driving the other king to the edge and bringing its own king up
   - `evaluatePosition()` counts material, plus small bonuses for central minor pieces, advanced pawns and a king kept at home
   - Moves within a few hundredths of a pawn of the best are treated as equal and one is picked at random; a forced mate always takes the quickest line
2. `setOpponent(level, humanColor)` in `game.js` turns the opponent on or off. `main.js` calls it from the "Opponent" and "Play as" selectors, which are saved like the other settings
3. `requestAIMove()` runs after every move, undo, reset and load. If it is the computer's turn it asks the engine through `askEngine()` in `engine-bridge.js`, which posts the position to `ai-worker.js`, and plays the answer with `makeMove()`. Where a Worker cannot be created (a page opened from a file, or the tests) the search runs on the main thread after a `setTimeout`
4. Each request has an id. Undo, New Game and changing the opponent call `dropEngineRequests()`, so an answer that arrives late is dropped (`isLatestEngineRequest()`). A worker cannot be interrupted, so if it is still searching at that moment `stopWorkerSearch()` terminates it and the next request starts a new one instead of waiting behind the abandoned search
5. In a game on the clock the request carries `budgetMs` from `searchBudget()`: a thirtieth of the computer's remaining time plus the increment, between 50 ms and three times the level's usual allowance. It replaces the level's thinking time, and under 150 ms `baseDepthFor()` lowers the depth that is always searched to two half-moves, under 75 ms to one. With less than ten seconds left the computer also skips its usual pause before moving
6. While it is the computer's turn `isBoardLocked()` is true: clicks and drags are ignored and the status line says the computer is thinking
7. Undo takes back the computer's reply together with the player's move

To make it stronger, the limit is speed: each extra half-move costs roughly an order of magnitude in time, and a second buys `hard` only about one half-move beyond its fixed depth. Faster move generation in `rules.js` (it copies the board for every move tried) and a transposition table are the next steps; raising `depth` or `timeMs` in `AI_LEVELS` only trades time for strength.

### 3. Promotion Choice UI

> **✅ Fully Implemented: `js/promotion.js`**

1. `makeMove()` takes an optional fifth argument, the piece type to promote to. It defaults to a queen, so tests and the computer opponent can call it directly
2. Clicks and drops both play their move through `playChosenMove()`. When the move would take a pawn to the last rank it does not play it; it calls `showPromotionChooser(color, onChoose)` and plays the move from the callback, once a piece has been picked
3. While the chooser is open the board ignores input. Escape or a click outside the panel cancels, leaving the pawn where it was; Undo and New Game also close it
4. The choices are `<button>` elements with labels. The first one takes focus, and Tab and the arrow keys cycle through them
5. With `PROMOTION_UI` set to `false` the chooser is skipped and the pawn becomes a queen

### 4. Chess Clock

> **✅ Fully Implemented: `js/game.js` (the "Clock" section), `js/config.js`**

1. `CONFIG.TIME_CONTROLS` lists the time controls: minutes each and seconds added per move. `main.js` fills the "Clock" selector from it and calls `setTimeControl()`. The choice applies to the next new game; a game with no move yet takes it at once
2. A timed game has a `clock` object: `{ control, base, increment, remaining: { w, b }, turnStartedAt }`, times in milliseconds. `turnStartedAt` is when the side to move was put on the clock, or `null` while no clock runs. `clockRemaining(color)` works out the time left from it, so nothing has to count down
3. `makeMove()` stops the mover's clock, adds the increment and starts the other side's. White's first move is not timed
4. `runClockTimer()` keeps an interval going (`CONFIG.CLOCK_TICK_MS`) only while a clock runs. `tickClock()` redraws it and, at zero, ends the game through `endGameWithoutMove()`: a loss, or a draw if the other side could never give mate (`canDeliverMate()`)
5. `warnIfTimeIsLow()` announces "White has 20 seconds left." and plays the `LOW_TIME` sound when the side to move goes down past a threshold in `CONFIG.LOW_TIME_WARNINGS`, once per threshold unless an increment takes the clock back above it
6. Undo is off in a timed game
7. The clock is saved with the game, as the times left and whether it was running, and the page saves again on `pagehide`. After a reload the side to move is put back on the clock from that moment
8. A game loaded from PGN has no clock
9. With `GAME_TIMER` off, `setTimeControl()` never chooses a clock and `main.js` hides the selector

### 5. Sound Effects

Sound effects are feature-flagged and user-toggleable:

1. Settings toggle updates `CONFIG.FEATURES.SOUND_EFFECTS` and persists preference
2. `game.js` triggers `playSound()` for move, capture, check, castle, promotion and game end
3. `playSound()` in `utils.js` synthesizes short tones with the Web Audio API from the definitions in `CONFIG.SOUNDS`, so no audio files are needed

### 6. Undo Move

Undo is implemented using a pre-move snapshot stack:

1. Before a move is applied, `playMove()` pushes `currentSnapshot()` (board, side to move, king positions, en passant target, half-move clock, status) to `positionHistory`. No copy is needed, because `applyMove()` builds a new position instead of changing the old one
2. `undoLastMove()` restores the previous snapshot with `restoreSnapshot()`, removes the last move from the move list and rerenders
3. The stack is saved with the game, so Undo still works after a reload
4. `index.html` includes an Undo button, which is disabled when there is nothing to undo

### 7. Past Games

There is one live game, saved under `chessGameState`, and an archive of the games before it:

1. `startGameFrom()` calls `archiveCurrentGame()` before it clears the game, so a game with moves that is replaced by New Game or by a loaded game goes into the archive, finished or not
2. An entry holds the game as PGN text (`buildPGN()`), which keeps it near a kilobyte; the newest `CONFIG.ARCHIVE_LIMIT` are kept
3. The Load dialog lists them (`showArchive()`). A click loads the entry with `importPGN()`, which restores its result
4. A game opened from the list and replaced again keeps its one entry and moves to the top

Not implemented: named slots, deleting entries, and keeping more than one game in progress with its clock and undo stack.

### 8. Draw Detection

After every move that is not checkmate or stalemate, `findDrawReason()` in `game.js` checks three rules and ends the game if one applies:

1. **Insufficient material**: bare kings, a single bishop or knight, or only bishops that all stand on squares of one colour
2. **Threefold repetition**: `positionKey()` turns a position into a string (placement, side to move, castling rights, and the en passant square if a pawn can capture there). The current key is compared with the snapshots on the undo stack back to the last pawn move or capture
3. **Fifty-move rule**: `halfmoveClock` counts half-moves since the last pawn move or capture; the game is drawn at 100

Draws are declared automatically; there is no claim button. The clock is part of the undo snapshot and the saved game, and repetition is counted from the undo stack, so both survive Undo and a reload.

### 9. SAN Generation

SAN generation with disambiguation is implemented:

1. `writeSAN()` in `notation.js` uses the position before the move to resolve conflicts (file first, then rank, then both). Only pieces that could legally have made the move count, so a pinned twin adds nothing
2. Includes capture markers, checks, mates, promotions, and en passant indicator
3. Future work: handle all edge cases for full SAN parity

### 10. Game Review

1. `viewPly` is the number of moves played in the position on screen, or `null` for the live game. `viewMove(ply)` sets it and redraws; nothing in the game changes
2. `shownPosition()` returns the position to draw: the live one, or the undo-stack snapshot taken before move `viewPly + 1`. The board, the captured pieces, the last-move highlight and Copy FEN all follow it
3. The moves in the list are buttons. A click, the arrow keys, Home and End in the list, and the four step buttons under it all call `viewMove()`; "Back to game" calls `returnToLiveGame()`
4. `showReviewScore()` writes what the engine makes of the position on screen under the move list. It calls `assessPosition()` in `ai.js`, a search two half-moves deep, on the page's own thread, so the worker and a computer move it may be working on are left alone. The line is not a live region
5. Once a game is over, `scoreFinishedGame()` sends every position of it to the engine on the `review-scores` channel (`askEngineForScores()`), once per game. `moveCost()` compares the score before and after each move from the mover's side; a move that lost at least `CONFIG.REVIEW_MISTAKE_DROP`, or allowed or missed a forced mate, gets the class `lost-ground` in the move list (a "?" from the stylesheet), a tooltip and an accessible name that say why, and a second sentence in the line under the list when it is looked at. The scores are dropped when the game goes on again (Undo, Play from here) or another game starts. Without a worker the scoring runs on the page: about 0.4 s for 120 positions
6. "Play from here" (`playFromHere()`, after a confirming second click) makes the position on screen the live one: it archives the game as it was, restores the undo-stack snapshot for that ply, cuts the move list and the undo stack to it, and clears the result and the clock
7. `isBoardLocked()` is true while looking back, except that a hint can still be asked. A move, such as the computer's reply, returns to the live game
8. A save from an older version without an undo stack has no positions to show, so its move buttons and the step buttons are disabled

### 11. Resign, Draw by Agreement and the Result

1. `endGameWithoutMove(result, status)` ends a game that no move ended: resignation, an agreed draw or a loss on time. It sets `gameResult` and `endedWithoutMove`
2. Resign needs a confirming second click (`confirmSecondClick()`, which New Game, Load and "Play from here" use as well; the question is withdrawn after `CONFIG.CONFIRM_MS` or when the game moves on). Against the computer it is the person who resigns
3. With two players "Offer draw" becomes "Accept draw?" for the other side, and playing a move declines. The computer accepts unless it is at least `CONFIG.AI_DRAW_MARGIN` ahead
4. Undo reopens a game ended this way without taking a move back
5. `gameResult` is `'1-0'`, `'0-1'` or `'1/2-1/2'` once the game is over. It is saved with the game and written to the PGN

### 12. Hint

1. `requestHint()` asks the engine, at `CONFIG.HINT_LEVEL`, for the move it would play for the side to move, through the same `askEngineAbout()` the computer opponent uses. While an earlier position is on the board it asks about that position instead, on the `review-hint` channel, so a computer move being worked out on the `play` channel is neither cancelled nor delayed. The hint remembers the position it was asked for (`hintPly`) and its marks show only there; asked while looking back, the announcement also gives the score
2. The move is not played. `showHintOnBoard()` has `renderHint()` mark its two squares and `announce()` reads it out
3. The hint is dropped when the position changes, and a hint still being worked out is cancelled with the engine request it shares

### 13. PGN and FEN

1. `buildPGN()` writes the seven standard tags, `TimeControl` for a timed game, `SetUp` and `FEN` for a game that did not begin from the usual position, the moves, and a comment before the result when the game ended without a move
2. `importPGN(text)` reads a game. `pgnMoveTokens()` drops tags, comments, variations and annotations, `findSANMove()` in `rules.js` finds the legal move each token stands for, and every move is checked before anything is changed; the first one that cannot be played is named in the dialog. Of several games in the text the first is loaded
3. The moves go in through `playMove()`. A draw nobody claimed in the loaded game is ignored until the last move, and `pgnResult()` restores a result the moves do not show
4. `buildFEN()` writes the position on screen with `positionToFEN()` from `rules.js`, also while looking back
5. `importFEN(text)` starts a game from a position: `positionFromFEN()` in `rules.js` reads it (castling rights become the `hasMoved` marks of kings and rooks) and says what is wrong with text it cannot use, and `startGameFrom()` begins the game. The Load dialog takes text that begins like a FEN as a position and anything else as PGN. A PGN with a `FEN` tag is read from that position
6. Copying goes through `copyOrDownload()`: the clipboard where it is available, otherwise a file download. "Save PGN" (`downloadPGN()`) always downloads; both use `downloadText()`
7. "Open file" and a file dropped on the Load dialog go through `readImportFile()`, which only puts the file's text in the box; the Load button then checks it like pasted text

### 14. Themes

1. `CONFIG.BOARD_THEMES` maps each board theme to the CSS custom properties it sets. `main.js` applies the saved one at startup and on change by setting them on the root element
2. The page theme is `dark`, `light` or `auto`, written to `data-theme` on the root element; `auto` follows `prefers-color-scheme`. `style.css` defines every colour as a token per theme

### 15. Offline Support and Install

1. `sw.js` is a service worker registered by `main.js` when the page is served over http(s). On install it saves the files in its `APP_FILES` list
2. It always tries the network first and saves a copy of each successful response, so a new release shows up at once when online. The request is made with `cache: 'no-cache'`: the server is asked every time, also while the browser's HTTP cache holds a fresh entry, so the scripts of two releases are never mixed; an unchanged file costs a `304`. The saved copy is used when the network fails, or when it has not answered after three seconds (`NETWORK_WAIT_MS`); an answer that arrives later is still saved for the next visit
3. `manifest.webmanifest` and the icons under `assets/icons/` make the page installable
4. When a file is added, renamed or removed, `APP_FILES` has to follow; see `docs/RELEASE.md`. `tests/unit/offline.test.js` checks the list against `index.html` and the files on disk, and `tests/unit/service-worker.test.js` runs the handlers

### 16. Captured Pieces

`updateCapturedDisplay()` in `game.js` works out what each side has taken, and the material lead, from the moves up to the position on screen; `renderCaptured()` in `game-ui.js` draws it. It is redrawn with the move list.

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

- Unit: rules (castling, en passant, pins, check, mate, stalemate, promotion, notation, perft counts), the engine and its Web Worker, undo, persistence, the clock, review and results, PGN and FEN, hint, board rendering, the settings and themes, mouse and touch input, the service worker, utilities, piece setup
- Integration: move flow updates status and history; `tests/integration/page.test.js` runs the real `index.html` with its scripts in page order
- Optional: Playwright E2E for browser-level scenarios

Manual testing:

- Cross-browser checks, responsive layout, accessibility (keyboard/ARIA)
