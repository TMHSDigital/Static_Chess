# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Links in the side panel to the GitHub source repository and issue tracker (#78)
- **Captured pieces**: The pieces each side has taken are shown with the material lead
- **Game review**: Click a move in the list, or use the arrow keys, Home and End there, to see the position after it; "Back to game" returns to the live position and nothing in the game is changed
- **Past games**: A game that is replaced by a new or a loaded one is kept. The last 20 are listed in the Load dialog with their date, opponent and result, and a click opens one again
- **Low time warning**: A player on the clock is warned at 20 and at 10 seconds, with an announcement for screen readers and, with sound effects on, a short double beep
- **Open and save files**: "Open file" in the Load dialog reads a PGN or FEN file (a file can also be dropped on the dialog), and "Save PGN" saves the game as a file
- **Play from here**: While an earlier position is on the board, "Play from here" drops the later moves and continues the game from that position, also in a finished game and in one played on the clock. The game as it was goes into the past games
- **Engine score in review**: While an earlier position is on the board, a line under the move list says who the engine thinks is ahead and by how much, or that a mate is there
- **Hint in review**: While an earlier position is on the board, Hint marks the move the engine would have played there and reads out the score with it. It does not disturb a move the computer is working out
- **Moves that lost ground**: Once a game is over, the engine goes through it and the move list marks with a "?" each move that, by its count, lost a pawn and a half or more or allowed a forced mate. The reason is in the move's tooltip and is shown under the list when the move is looked at
- **Link previews**: A link to the game shared in chat or on social media now shows a preview with an image of the board
- **404 page**: An address that does not exist on the site now shows a page in the game's style with a link back to the game
- **Step buttons**: Four buttons under the move list go to the starting position, the previous move, the next move and the latest move, so a game can be stepped through without a keyboard
- **Resign and draw by agreement**: Resign needs a second click; with two players a draw is offered and then accepted, and the computer accepts unless it is ahead. Undo reopens a game ended this way
- **Hint**: Marks the move the engine would play for the side to move, without playing it
- **Chess clock**: An optional clock with five time controls, chosen under "Clock" for the next new game. Running out of time loses (or draws if the opponent cannot checkmate); Undo is off in timed games; the times survive a reload and the PGN names the time control
- **Offline and installable**: After one visit the game opens and plays without a connection, and browsers offer to install it as an app. The page has a real icon
- **Load PGN**: Paste a game to load it; every move is checked first and a move that cannot be played is named, leaving the current game untouched
- **Copy FEN**: Copies the position on the board, also while looking back through the move list
- **Load a position from FEN**: Paste a FEN into the Load dialog to start a game from that position, with either side to move. Castling rights, the en passant square and the move counters are taken from it, the move list is numbered from there, and the PGN of such a game says where it began and loads back
- **Stronger computer opponent**: The hard level thinks for about a second, looking deeper when it can; the engine considers promoting to a knight, rook or bishop, plays won endings such as king and rook against king to mate, and avoids repeating positions when it is ahead
- **Themes**: Four board colour schemes (classic, green, blue, high contrast) and a light page theme that can also follow the system setting
- The result is stored with the game, and the PGN says when a game ended by resignation or agreement

### Fixed

- After a release, a returning visitor could get some scripts new and some from the browser's cache for up to ten minutes, which could leave the page without a board; the service worker now asks the server for every file
- On narrow screens the side panel was wider than the screen and its edges were cut off
- Light theme: the card around the board stayed black with an unreadable title, and the move list, status and settings boxes were grey
- The pawn promotion chooser ran off the edge of very narrow screens
- Switches showed no keyboard focus, and white text on the teal buttons and the running clock was below AA contrast
- Load PGN: text that cannot be played now shows its error on the first click, instead of first asking to discard the current game
- Offline support: on a connection that is up but delivers nothing, the app opens from its saved copy after three seconds instead of waiting for the browser to give up
- Load: damaged text, such as thousands of unclosed braces, nested parentheses or blank lines, no longer freezes the page, and text over 200,000 characters is refused with a message
- New Game: a "Discard game?" question that was still showing when a move was played (for example the computer's reply) is withdrawn, as it already was for Resign, so the next click no longer discards the game
- Copy FEN: where the clipboard is not available, the position is saved as a plain text file, not marked as a PGN file
- On the clock, two bishops on squares of one colour no longer count as enough to win when the other side runs out of time
- The computer's reply no longer waits for a search that was abandoned, for example a hint that was overtaken by a move or a move that was undone while the computer was thinking
- In a very narrow window with a scrollbar that takes up room, the board card no longer runs over the page padding or past the window edge, whatever the scrollbar's width, and the board on a phone is no smaller for it
- Offline support: a new version of the service worker removes only this app's own old caches, not those of other apps served from the same host
- Touch: when the browser cancels a touch in the middle of a drag (a system gesture, a call, a second finger), the piece goes back to its square instead of hanging in the air, and the next tap no longer plays its move
- Notation: a move no longer gets a file or rank because of a second piece of the same type that is pinned and could not have made it (for example "Ne4", not "Nge4")
- Load PGN: the result is kept, so a game that ended by resignation, agreement or on time loads as finished instead of in progress (Undo reopens it), and of several games in the pasted text the first is loaded
- Load PGN: a game that played on through a threefold repetition or another unclaimed draw loads in full and can be continued, instead of being marked drawn with the later moves still applied
- Load PGN with a clock selected: the loaded game is no longer put on a running clock with the increment added for every move, and Undo works in it
- Playing as Black against the computer: reopening the page no longer lets the computer play an extra move on the saved game
- Tests: a game left with a running clock or the computer thinking no longer keeps Jest alive or plays into the next test

### Changed

- "Show coordinates" labels the board edges only: the file letters along the rank nearest the player and the rank numbers down the left side, 16 labels instead of 126. They follow a flipped board and stay visible on the squares of the last move and on squares a piece can move to
- The page carries a Content-Security-Policy that lets it load only its own files
- The "Load PGN" button is now "Load", since it takes a FEN position as well
- The display settings are folded under "Settings"; the opponent and side selectors stay in view
- The status line sits above the board, and each player has a bar on their side of the board with their name, captured pieces and clock, so all of it is in view on a phone
- The side panel is as tall as the board and the move list takes the height that is left; its controls are grouped (this game, new game, copy or load) and every control is at least 44px tall
- Choosing a side under "Play as" turns the board to that side; "Flip board" still turns it by hand
- In a game on the clock the computer budgets its thinking time: it thinks longer when it has plenty of time and moves at once when it has little, instead of spending the same time on every move
- The computer works out its moves about three to four times faster, so the hard level and Hint look deeper in the same time
- The easy level is no longer random: it takes a piece left hanging and gives mate in one, but still plays a random move about three times in ten
- The last move is shown as a tint on both squares instead of corner marks, and the dots for possible moves no longer pulse

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
