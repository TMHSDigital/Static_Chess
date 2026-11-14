# Release v0.2.0 - Computer Opponent, Full Rules and Accessibility

**Release Date:** November 13, 2026

You can now play against the computer, the game knows every way a game of chess can end in a draw, and the board works with a keyboard and a screen reader.

## What's New

- **Computer opponent**: Three levels, playable as White or Black. Pick a level under "Opponent" and a side under "Play as". The search runs in a Web Worker, so the page stays responsive. Undo takes back your move and the computer's reply
- **Promotion choice**: A pawn reaching the last rank asks for a queen, rook, bishop or knight, by mouse, touch or keyboard
- **Draw detection**: Insufficient material, threefold repetition and the fifty-move rule
- **Accessibility**: The board is a single Tab stop with arrow-key navigation; moves, checks and results are announced to screen readers; reduced-motion settings are respected
- **Sound effects**: Short synthesized tones for moves, captures, check, castling, promotion and game end
- **Copy PGN**: Copies the game to the clipboard in PGN format
- **Flip board**: Shows the board from Black's side
- **New Game confirmation**: A game in progress needs a second click before it is discarded
- Undo history is kept across page reloads

## Fixed

- An unmoved king could make illegal two-square moves that bypassed the castling rules
- Queenside castling was refused when only the b-file square was attacked
- Undo restored a wrong position after castling, en passant or a double pawn push
- Click-to-move and tap-to-move did not work while drag and drop was enabled
- A malformed saved game, or a browser that blocks storage, stopped the app from starting
- Move notation picked the wrong disambiguation when three or more pieces could reach a square
- Dragging a pawn to the last rank promoted it to a queen without asking

## For Contributors

- The rules of chess live in a DOM-free `js/rules.js`, checked against published perft counts
- 159 tests cover the rules, the computer opponent, undo, persistence, input, settings and accessibility
- CI installs from a lockfile and runs ESLint, the Prettier check and the tests; the release workflow runs lint and tests before publishing
- Development needs Node 22.22.2+ or 24.15+. The app itself still needs no build step: open `index.html` or serve the folder

## Links

- **Play Now**: https://tmhsdigital.github.io/Static_Chess/
- **Full Changelog**: [CHANGELOG.md](https://github.com/TMHSDigital/Static_Chess/blob/main/CHANGELOG.md)
- **Report Issues**: https://github.com/TMHSDigital/Static_Chess/issues
