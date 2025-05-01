# Static Chess

## Project Overview

Static Chess is a fully functional chess game playable in a web browser. It is built using pure vanilla JavaScript, HTML, and CSS, with no external frameworks or libraries. The game features standard chess rules, move validation, check/checkmate detection, move history, and game state persistence using `localStorage`.

It is designed to be simple, lightweight, and easily deployable on static hosting platforms like GitHub Pages.

## Features

*   **Standard Chess Rules:** Implements all standard piece movements (Pawn, Rook, Knight, Bishop, Queen, King).
*   **Special Moves:** Supports castling (kingside and queenside), en passant, and pawn promotion (currently auto-promotes to Queen).
*   **Move Validation:** Prevents illegal moves based on piece movement, obstacles, and check rules.
*   **Check/Checkmate Detection:** Identifies check situations and declares checkmate when a player has no legal moves to escape check.
*   **Stalemate Detection:** Detects stalemate conditions (no legal moves, but not in check).
*   **Local Multiplayer:** Allows two players to play against each other on the same browser.
*   **Visual Feedback:**
    *   Highlights the selected piece.
    *   Shows possible legal moves for the selected piece.
    *   Highlights the king when in check.
*   **Move History:** Displays a list of moves made during the game in standard algebraic notation (SAN).
*   **Game Persistence:** Automatically saves the current game state to the browser's `localStorage` after each move and loads it on page refresh.
*   **Responsive Design:** Adapts layout for play on both desktop and mobile devices.
*   **Reset Game:** A button to start a new game.

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/TMHSDigital/Static_Chess.git
    cd Static_Chess
    ```
2.  **Open `index.html`:** Simply open the `index.html` file in your web browser.

That's it! No build process or dependencies are required.

## How to Play

1.  Open `index.html` in your browser.
2.  The game starts with White's turn.
3.  Click on a piece of the current player's color to select it. The square will be highlighted, and possible legal moves will be indicated by green dots.
4.  Click on one of the highlighted possible move squares to make the move.
5.  The board will update, the move will be added to the Move History, and the turn will switch to the other player.
6.  If a move results in check, the opponent's king will be highlighted in red.
7.  The game ends when checkmate or stalemate occurs. The status will be displayed below the move history.
8.  Click the "New Game" button at any time to reset the board and start over.
9.  The game state is saved automatically, so you can close the browser and resume later (within the same browser).

## Code Structure

The project follows a clear separation of concerns:

*   **`index.html`:** The main HTML file, providing the structure for the board, game info panel, and including the necessary CSS and JS files.
*   **`css/`:** Contains the stylesheets.
    *   `style.css`: General styles for the page layout, responsiveness, game info panel.
    *   `board.css`: Styles specific to the chessboard grid, squares, and visual highlights (selection, possible moves, check).
    *   `pieces.css`: Styles for the chess pieces. Uses Unicode characters by default but includes commented-out examples for using SVG background images.
*   **`js/`:** Contains the JavaScript logic.
    *   `utils.js`: Helper functions, primarily for coordinate conversions (algebraic <-> row/col) and boundary checks.
    *   `pieces.js`: Defines the `Piece` object structure, piece type constants, and the `isPseudoLegalMove` function (validates moves based *only* on piece type rules and start/end squares, ignoring board context) and the initial board setup `getInitialPieces`.
    *   `board.js`: Manages the DOM representation of the board. Includes functions to create the board (`createBoard`), render pieces (`renderPieces`), update visual highlights (`updateBoardVisuals`), handle click delegation (`delegateBoardClick`), and manage selection state (`setSelectedSquare`, `setPossibleMoves`, etc.).
    *   `game.js`: The core game engine. Manages game state (`boardState`, `currentPlayer`, `moveHistory`, `kingPositions`, `enPassantTarget`, `isGameOver`), handles player turns (`switchPlayer`), validates and executes moves (`makeMove`), generates legal moves considering all rules (`generateLegalMovesForPiece`, `generateAllLegalMoves`), checks for check/checkmate/stalemate (`isKingInCheck`, `isCheckmate`, `isStalemate`), handles special moves logic (castling, en passant, promotion), manages game state persistence (`saveGameState`, `loadGameState`), and updates the UI elements (status, move history).
    *   `main.js`: The main entry point. Waits for the DOM to load and then calls `initializeGame()` from `game.js` to start the application.
*   **`assets/`:** Intended for storing chess piece images (preferably SVG). Currently empty.
*   **`README.md`:** This file, providing documentation.

## Deployment

Since this is a purely static website (HTML, CSS, JS files only), it can be easily deployed on any static hosting service.

**Deploying to GitHub Pages:**

1.  Ensure your project is pushed to a GitHub repository.
2.  Go to your repository settings on GitHub.
3.  Navigate to the "Pages" section in the left sidebar.
4.  Under "Build and deployment", select "Deploy from a branch" as the source.
5.  Choose the branch you want to deploy from (e.g., `main` or `master`).
6.  Ensure the folder is set to `/ (root)`.
7.  Click "Save".
8.  GitHub will build and deploy your site. The URL will be displayed in the Pages settings (usually `https://tmhsdigital.github.io/Static_Chess/`). It might take a minute or two for the site to become live.

## Potential Future Enhancements (Bonus Features)

*   **Piece Graphics:** Replace Unicode characters with SVG images.
*   **Drag and Drop:** Allow moving pieces by dragging.
*   **AI Opponent:** Implement a basic AI using algorithms like Minimax or Negamax.
*   **Promotion Choice:** Allow the user to choose which piece to promote a pawn to.
*   **Game Timer:** Add optional timers for each player.
*   **Sound Effects:** Add sounds for moves, captures, checks, etc.
*   **Undo Move:** Implement functionality to take back the last move.
*   **Save/Load Games:** Allow saving multiple named games.
*   **Draw Conditions:** Implement detection for threefold repetition and the fifty-move rule.
*   **Improved SAN:** Implement full Standard Algebraic Notation, including disambiguation.