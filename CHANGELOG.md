# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **Captured pieces**: The pieces each side has taken are shown with the material lead
- **Game review**: Click a move in the list, or use the arrow keys, Home and End there, to see the position after it; "Back to game" returns to the live position and nothing in the game is changed
- **Resign and draw by agreement**: Resign needs a second click; with two players a draw is offered and then accepted, and the computer accepts unless it is ahead. Undo reopens a game ended this way
- **Hint**: Marks the move the engine would play for the side to move, without playing it
- **Chess clock**: An optional clock with five time controls, chosen under "Clock" for the next new game. Running out of time loses (or draws if the opponent cannot checkmate); Undo is off in timed games; the times survive a reload and the PGN names the time control
- **Offline and installable**: After one visit the game opens and plays without a connection, and browsers offer to install it as an app. The page has a real icon
- **Load PGN**: Paste a game to load it; every move is checked first and a move that cannot be played is named, leaving the current game untouched
- **Copy FEN**: Copies the position on the board, also while looking back through the move list
- **Stronger computer opponent**: The hard level thinks for about a second, looking deeper when it can; the engine considers promoting to a knight, rook or bishop, plays won endings such as king and rook against king to mate, and avoids repeating positions when it is ahead
- **Themes**: Four board colour schemes (classic, green, blue, high contrast) and a light page theme that can also follow the system setting
- The result is stored with the game, and the PGN says when a game ended by resignation or agreement

### Fixed

- On narrow screens the side panel was wider than the screen and its edges were cut off

### Changed

- The display settings are folded under "Settings"; the opponent and side selectors stay in view
- The side panel may be taller than the board (up to the window height), and its buttons are slightly smaller, to make room for the new controls

## [0.2.0] - 2026-11-13

### Added

- **Sound Effects**: The settings toggle now plays short synthesized tones for moves, captures, check, castling, promotion and game end
- Undo is kept across page reloads, and the Undo button is disabled when there is nothing to undo
- Clicking another of your own pieces switches the selection to it
- **Copy PGN**: Copies the game to the clipboard in PGN format (downloads a file where the clipboard is unavailable)
- **Flip board**: A setting that shows the board from Black's side; arrow-key navigation follows the screen
- **New Game confirmation**: A game in progress needs a second click on New Game before it is discarded
- **Promotion choice**: A pawn reaching the last rank asks for a queen, rook, bishop or knight; the dialog works with mouse, touch and keyboard, and Escape takes the move back
- **Draw detection**: The game ends as a draw on insufficient material, threefold repetition and the fifty-move rule
- **Computer opponent**: Three levels (random, and alpha-beta search two or three half-moves deep), playable as White or Black; the search runs in a Web Worker
- **Accessibility**: The board is a single Tab stop; moves, checks and results are announced to screen readers; squares say when they are selected, a legal move or in check; `prefers-reduced-motion` is respected
- Tests for the rules engine, undo, persistence, and mouse and touch input

### Fixed

- An unmoved king could make illegal two-square moves that bypassed the castling rules
- Queenside castling was refused when only the b-file square was attacked
- Undo restored a wrong position after castling, en passant or a double pawn push
- Click-to-move with a mouse and tap-to-move on touch screens did not work while drag and drop was enabled
- A malformed saved game, or a browser that blocks storage, stopped the app from starting
- Move notation picked the wrong disambiguation when three or more pieces could reach a square
- Dragging a pawn to the last rank promoted it to a queen without asking

### Changed

- CI installs from a lockfile on Node 24 with pinned actions; the release workflow runs lint and tests first
- Dev tooling: ESLint 10, Jest 30, jsdom 31 (loaded through a small Jest environment, `tests/helpers/jsdom-environment.js`; Node 22.22.2+ or 24.15+ is needed for development); the ESLint config is now `eslint.config.mjs` and `package.json` no longer declares `"type": "module"`
- `config.js` is now the single source for feature flags, setting defaults and storage keys; debug output is off unless `CONFIG.DEBUG` is set
- The rules of chess moved from `game.js` into a DOM-free `rules.js`, checked against published perft counts
- The whole repository is formatted with Prettier, and CI checks it
- Scripts call each other directly instead of through `window` lookups with `typeof` guards; `board.js` no longer reads game state; the ESLint config lists shared names once instead of per file
- Removed unused notation helpers, duplicate path and check functions, and the legacy ESLint config

## [0.1.0] - 2025-11-02

### Added

- **Drag and Drop**: Fully functional drag-and-drop interface for moving pieces, integrated with click-based flow
- **Undo Move**: Ability to undo the last move with full state restoration
- **Accessibility**: ARIA roles, live regions, and keyboard navigation (arrow keys, Enter/Space)
- **Sound Effects**: Toggle and event wiring ready (audio files can be added to `assets/sounds/`)
- **SAN Improvements**: Standard Algebraic Notation with basic disambiguation for move history
- **Performance Optimizations**:
  - Diff-based rendering (only updates changed squares)
  - Optimized move simulation (lightweight board copies)
- **Testing Infrastructure**: Jest unit and integration tests with jsdom
- **CI/CD**: Automated linting and testing via GitHub Actions
- **Repository Hardening**:
  - CODE_OF_CONDUCT, SECURITY, CONTRIBUTING documentation
  - Issue and PR templates
  - CODEOWNERS file
  - Dependabot configuration
- **Code Quality**: ESLint, Prettier, and EditorConfig for consistent formatting
- **Documentation**: Comprehensive architecture docs, roadmap, and release process

### Changed

- Game state persistence improved with snapshot-based undo system
- Move history now uses proper SAN notation with disambiguation
- Board rendering performance significantly improved

### Fixed

- Fixed move validation edge cases
- Improved check/checkmate detection accuracy
