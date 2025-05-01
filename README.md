# Static Chess

<div align="center">

![Chess Banner](https://i.imgur.com/jC5rGQc.png)

[![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-222222?style=for-the-badge&logo=GitHub%20Pages&logoColor=white)](https://tmhsdigital.github.io/Static_Chess/)

A lightweight chess game built with pure vanilla web technologies - no frameworks, no libraries, just clean code.

[Play Now](https://tmhsdigital.github.io/Static_Chess/) | [View Source](https://github.com/TMHSDigital/Static_Chess) | [Report Issue](https://github.com/TMHSDigital/Static_Chess/issues)

</div>

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Demo](#demo)
- [Setup and Installation](#setup-and-installation)
- [How to Play](#how-to-play)
- [Code Structure](#code-structure)
- [Deployment](#deployment)
- [Future Enhancements](#future-enhancements)
- [License](#license)

## Overview

Static Chess is a fully functional chess game playable in a web browser. It is built using pure vanilla JavaScript, HTML, and CSS, with no external frameworks or libraries. The game features standard chess rules, move validation, check/checkmate detection, move history, and game state persistence using `localStorage`.

It is designed to be simple, lightweight, and easily deployable on static hosting platforms like GitHub Pages.

## Features

<details open>
<summary><b>Core Features</b></summary>
<br>

- **Standard Chess Rules:** Implements all standard piece movements (Pawn, Rook, Knight, Bishop, Queen, King)
- **Special Moves:** Supports castling (kingside and queenside), en passant, and pawn promotion
- **Move Validation:** Prevents illegal moves based on piece movement, obstacles, and check rules
- **Check/Checkmate Detection:** Identifies check situations and declares checkmate when appropriate
- **Stalemate Detection:** Detects stalemate conditions (no legal moves, but not in check)
- **Local Multiplayer:** Two players can play against each other on the same device
- **Visual Feedback:**
  - Highlights the selected piece
  - Shows possible legal moves for the selected piece
  - Highlights the king when in check
  - Highlights the last move made
- **Move History:** Displays moves in standard algebraic notation (SAN)
- **Game Persistence:** Automatically saves game state to `localStorage`
- **Responsive Design:** Adapts layout for both desktop and mobile devices
- **Coordinate Toggle:** Option to display board coordinates

</details>

## Demo

<div align="center">
  <img src="https://i.imgur.com/XdatvSm.gif" alt="Static Chess Gameplay" width="600px">
</div>

## Setup and Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/TMHSDigital/Static_Chess.git
   cd Static_Chess
   ```

2. **Open `index.html`:** Simply open the file in your web browser.

That's it! No build process or dependencies are required.

## How to Play

1. Open `index.html` in your browser
2. The game starts with White's turn
3. Click on a piece to select it and see possible moves
4. Click on a highlighted square to move the selected piece
5. The board updates, move is added to the Move History, and turn switches
6. If a move results in check, the opponent's king will be highlighted in red
7. Game ends with checkmate or stalemate
8. Click "New Game" to reset the board
9. Toggle "Show coordinates" to display board coordinates
10. Game state is saved automatically to localStorage

## Code Structure

<details>
<summary><b>View Project Structure</b></summary>
<br>

```
Static_Chess/
├── index.html           # Main HTML entry point
├── css/
│   ├── style.css        # General page styles
│   ├── board.css        # Chessboard specific styles
│   └── pieces.css       # Chess pieces styles
├── js/
│   ├── utils.js         # Utility functions
│   ├── pieces.js        # Piece definitions and movement rules
│   ├── board.js         # Board rendering and interaction
│   ├── game.js          # Core game logic
│   └── main.js          # Application entry point
└── assets/              # For piece images (SVG)
```

The project follows a clear separation of concerns:

- **`index.html`:** Main structure and layout
- **CSS files:** Visual presentation and animations
- **JS files:** Game logic and behavior
  - `utils.js`: Helper functions like coordinate conversions
  - `pieces.js`: Piece objects and basic movement rules
  - `board.js`: DOM manipulation for the board interface
  - `game.js`: Core chess logic including special moves, check detection, etc.
  - `main.js`: Bootstraps the application

</details>

## Deployment

Since this is a purely static website, it can be easily deployed on any static hosting service.

**GitHub Pages Deployment:**

1. Push your project to GitHub
2. Go to repository settings
3. Navigate to "Pages" section
4. Set source to your preferred branch
5. Set folder to `/ (root)`
6. Your site will be available at `https://tmhsdigital.github.io/Static_Chess/`

## Future Enhancements

<details>
<summary><b>Planned Features</b></summary>
<br>

- **SVG Piece Graphics:** Replace Unicode characters with custom SVG images
- **Drag and Drop:** Allow moving pieces by dragging
- **AI Opponent:** Implement basic chess AI using minimax algorithm
- **Promotion Choice:** UI for selecting which piece to promote a pawn to
- **Game Timer:** Optional chess clock functionality
- **Sound Effects:** Audio feedback for moves and events
- **Undo Move:** Ability to take back the last move
- **Multiple Saved Games:** Save and load multiple games
- **Advanced Draw Detection:** Implement threefold repetition and fifty-move rule
- **Full SAN Implementation:** Complete algebraic notation with disambiguation

</details>

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
Made with ❤️ by <a href="https://github.com/TMHSDigital">TMHSDigital</a>
</div>